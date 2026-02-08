import { eq, and, sql } from 'drizzle-orm'
import { fancoinWallets, fancoinTransactions, creatorProfiles, users, posts, payments } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import { FANCOIN_PACKAGES, PLATFORM_FEES } from '@fandreams/shared'

export async function getWallet(userId: string) {
  const [wallet] = await db
    .select()
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, userId))
    .limit(1)

  if (!wallet) {
    const [created] = await db
      .insert(fancoinWallets)
      .values({ userId })
      .returning()
    return created
  }

  return wallet
}

export async function getTransactions(userId: string, limit = 50) {
  const txs = await db
    .select()
    .from(fancoinTransactions)
    .where(eq(fancoinTransactions.userId, userId))
    .orderBy(sql`${fancoinTransactions.createdAt} DESC`)
    .limit(limit)

  return txs
}

export async function purchaseFancoins(userId: string, packageId: string) {
  const pkg = FANCOIN_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) throw new AppError('NOT_FOUND', 'Pacote nao encontrado', 404)

  const wallet = await getWallet(userId)
  const newBalance = wallet.balance + pkg.coins

  await db
    .update(fancoinWallets)
    .set({
      balance: newBalance,
      totalEarned: sql`${fancoinWallets.totalEarned} + ${pkg.coins}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, userId))

  const [tx] = await db
    .insert(fancoinTransactions)
    .values({
      userId,
      type: 'purchase',
      amount: pkg.coins,
      balanceAfter: newBalance,
      description: `Compra de ${pkg.label}`,
    })
    .returning()

  return { transaction: tx, newBalance, package: pkg }
}

export async function sendTip(fromUserId: string, toCreatorId: string, amount: number, referenceId?: string) {
  if (amount <= 0) throw new AppError('INVALID', 'Valor invalido', 400)

  // Look up both usernames for descriptions
  const [sender] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, fromUserId))
    .limit(1)
  const [receiver] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, toCreatorId))
    .limit(1)

  const wallet = await getWallet(fromUserId)
  if (wallet.balance < amount) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Saldo insuficiente de FanCoins', 400)
  }

  const newSenderBalance = wallet.balance - amount

  await db
    .update(fancoinWallets)
    .set({
      balance: newSenderBalance,
      totalSpent: sql`${fancoinWallets.totalSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, fromUserId))

  const platformCut = Math.floor(amount * PLATFORM_FEES.tip)
  const creatorAmount = amount - platformCut

  const creatorWallet = await getWallet(toCreatorId)
  const newCreatorBalance = creatorWallet.balance + creatorAmount

  await db
    .update(fancoinWallets)
    .set({
      balance: newCreatorBalance,
      totalEarned: sql`${fancoinWallets.totalEarned} + ${creatorAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, toCreatorId))

  const senderUsername = sender?.username || 'usuario'
  const receiverUsername = receiver?.username || 'usuario'

  await db.insert(fancoinTransactions).values([
    {
      userId: fromUserId,
      type: 'tip_sent',
      amount: -amount,
      balanceAfter: newSenderBalance,
      referenceId,
      description: `Tip enviado para @${receiverUsername}`,
    },
    {
      userId: toCreatorId,
      type: 'tip_received',
      amount: creatorAmount,
      balanceAfter: newCreatorBalance,
      referenceId,
      description: `Tip recebido de @${senderUsername}`,
    },
  ])

  if (referenceId) {
    await db.update(posts).set({ tipCount: sql`${posts.tipCount} + 1` }).where(eq(posts.id, referenceId))
  }

  return { sent: amount, creatorReceived: creatorAmount, platformFee: platformCut }
}

/**
 * Credit FanCoins after a confirmed payment.
 * Called by the payment webhook handler.
 */
export async function creditPurchase(userId: string, totalCoins: number, label: string, paymentId: string) {
  const wallet = await getWallet(userId)
  const newBalance = wallet.balance + totalCoins

  await db
    .update(fancoinWallets)
    .set({
      balance: newBalance,
      totalEarned: sql`${fancoinWallets.totalEarned} + ${totalCoins}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, userId))

  await db.insert(fancoinTransactions).values({
    userId,
    type: 'purchase',
    amount: totalCoins,
    balanceAfter: newBalance,
    referenceId: paymentId,
    description: `Compra de ${label}`,
  })

  return { newBalance, credited: totalCoins }
}

export async function unlockPpv(userId: string, postId: string) {
  // Get post info
  const [post] = await db
    .select({ id: posts.id, creatorId: posts.creatorId, ppvPrice: posts.ppvPrice, visibility: posts.visibility })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1)

  if (!post) throw new AppError('NOT_FOUND', 'Post nao encontrado', 404)
  if (post.visibility !== 'ppv' || !post.ppvPrice) {
    throw new AppError('INVALID', 'Este post nao e PPV', 400)
  }
  if (post.creatorId === userId) {
    throw new AppError('INVALID', 'Voce ja tem acesso a este post', 400)
  }

  // Check if already unlocked
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.type, 'ppv'),
        eq(payments.status, 'completed'),
        sql`${payments.metadata}->>'postId' = ${postId}`,
      ),
    )
    .limit(1)

  if (existing) throw new AppError('ALREADY_UNLOCKED', 'Voce ja desbloqueou este post', 409)

  // Convert ppvPrice (BRL) to FanCoins: R$0.01 = 1 FanCoin → R$1 = 100 FanCoins
  const priceInCoins = Math.ceil(Number(post.ppvPrice) * 100)

  const wallet = await getWallet(userId)
  if (wallet.balance < priceInCoins) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Saldo insuficiente de FanCoins', 400)
  }

  const newBalance = wallet.balance - priceInCoins
  const platformCut = Math.floor(priceInCoins * PLATFORM_FEES.ppv)
  const creatorAmount = priceInCoins - platformCut

  // Deduct from buyer
  await db
    .update(fancoinWallets)
    .set({
      balance: newBalance,
      totalSpent: sql`${fancoinWallets.totalSpent} + ${priceInCoins}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, userId))

  // Credit creator
  const creatorWallet = await getWallet(post.creatorId)
  const newCreatorBalance = creatorWallet.balance + creatorAmount
  await db
    .update(fancoinWallets)
    .set({
      balance: newCreatorBalance,
      totalEarned: sql`${fancoinWallets.totalEarned} + ${creatorAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, post.creatorId))

  // FanCoin transactions
  const [sender] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1)
  const [creator] = await db.select({ username: users.username }).from(users).where(eq(users.id, post.creatorId)).limit(1)

  await db.insert(fancoinTransactions).values([
    {
      userId,
      type: 'ppv_unlock',
      amount: -priceInCoins,
      balanceAfter: newBalance,
      referenceId: postId,
      description: `Desbloqueio PPV - post de @${creator?.username || 'criador'}`,
    },
    {
      userId: post.creatorId,
      type: 'ppv_received',
      amount: creatorAmount,
      balanceAfter: newCreatorBalance,
      referenceId: postId,
      description: `PPV recebido de @${sender?.username || 'usuario'}`,
    },
  ])

  // Record in payments table for access tracking
  await db.insert(payments).values({
    userId,
    recipientId: post.creatorId,
    type: 'ppv',
    amount: post.ppvPrice,
    platformFee: String(Number(post.ppvPrice) * PLATFORM_FEES.ppv),
    creatorAmount: String(Number(post.ppvPrice) - Number(post.ppvPrice) * PLATFORM_FEES.ppv),
    paymentProvider: 'fancoins',
    status: 'completed',
    metadata: { postId, method: 'fancoins', fancoinsSpent: priceInCoins },
  })

  // Update creator earnings
  const creatorAmountBrl = Number(post.ppvPrice) - Number(post.ppvPrice) * PLATFORM_FEES.ppv
  await db
    .update(creatorProfiles)
    .set({ totalEarnings: sql`${creatorProfiles.totalEarnings} + ${creatorAmountBrl}` })
    .where(eq(creatorProfiles.userId, post.creatorId))

  return { unlocked: true, fancoinsSpent: priceInCoins, newBalance }
}

export async function rewardEngagement(userId: string, type: string, amount: number) {
  const wallet = await getWallet(userId)
  const newBalance = wallet.balance + amount

  await db
    .update(fancoinWallets)
    .set({
      balance: newBalance,
      totalEarned: sql`${fancoinWallets.totalEarned} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, userId))

  await db.insert(fancoinTransactions).values({
    userId,
    type: `reward_${type}`,
    amount,
    balanceAfter: newBalance,
    description: `Recompensa: ${type}`,
  })

  return newBalance
}
