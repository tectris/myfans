import { eq, and, gte, sql, desc, count } from 'drizzle-orm'
import { payouts, fancoinWallets, fancoinTransactions, platformSettings } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import { PAYOUT_CONFIG } from '@fandreams/shared'

// ── Platform Settings Helpers ──

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1)

    return row ? (row.value as T) : defaultValue
  } catch {
    return defaultValue
  }
}

export async function setSetting(key: string, value: any, updatedBy: string) {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    })
}

// ── Anti-Fraud Checks ──

type RiskResult = { score: number; flags: string[]; blocked: boolean }

async function assessWithdrawalRisk(creatorId: string, amount: number, fancoinAmount: number): Promise<RiskResult> {
  const flags: string[] = []
  let score = 0
  const now = new Date()

  // 1. Check daily withdrawal count
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const maxDaily = await getSetting('max_daily_withdrawals', PAYOUT_CONFIG.maxDailyWithdrawals)
  const [dailyCount] = await db
    .select({ count: count() })
    .from(payouts)
    .where(
      and(
        eq(payouts.creatorId, creatorId),
        gte(payouts.createdAt, dayStart),
      ),
    )

  if ((dailyCount?.count || 0) >= maxDaily) {
    flags.push('DAILY_LIMIT_EXCEEDED')
    score += 100 // Block
  }

  // 2. Check daily amount limit
  const maxDailyAmount = await getSetting('max_daily_amount', PAYOUT_CONFIG.maxDailyAmount)
  const [dailyTotal] = await db
    .select({ total: sql<string>`COALESCE(SUM(${payouts.amount}::numeric), 0)` })
    .from(payouts)
    .where(
      and(
        eq(payouts.creatorId, creatorId),
        gte(payouts.createdAt, dayStart),
      ),
    )

  if (Number(dailyTotal?.total || 0) + amount > maxDailyAmount) {
    flags.push('DAILY_AMOUNT_EXCEEDED')
    score += 100
  }

  // 3. Cooldown check (last withdrawal within X hours)
  const cooldownHours = await getSetting('cooldown_hours', PAYOUT_CONFIG.cooldownHours)
  const cooldownTime = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000)

  const [recentPayout] = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(
      and(
        eq(payouts.creatorId, creatorId),
        gte(payouts.createdAt, cooldownTime),
        eq(payouts.status, 'completed'),
      ),
    )
    .limit(1)

  if (recentPayout) {
    flags.push('COOLDOWN_ACTIVE')
    score += 50
  }

  // 4. Large withdrawal (above manual approval threshold)
  const manualThreshold = await getSetting('manual_approval_threshold', PAYOUT_CONFIG.manualApprovalThreshold)
  if (amount >= manualThreshold) {
    flags.push('ABOVE_MANUAL_THRESHOLD')
    score += 30
  }

  // 5. New account check (< 30 days)
  const [wallet] = await db
    .select({ updatedAt: fancoinWallets.updatedAt })
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, creatorId))
    .limit(1)

  if (wallet?.updatedAt) {
    const accountAge = (now.getTime() - new Date(wallet.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (accountAge < 7) {
      flags.push('VERY_NEW_ACCOUNT')
      score += 40
    } else if (accountAge < 30) {
      flags.push('NEW_ACCOUNT')
      score += 15
    }
  }

  // 6. Withdrawal amount vs total earned ratio (withdrawing > 80% of total earned is suspicious)
  const [walletData] = await db
    .select({ balance: fancoinWallets.balance, totalEarned: fancoinWallets.totalEarned })
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, creatorId))
    .limit(1)

  if (walletData && Number(walletData.totalEarned) > 0) {
    const ratio = fancoinAmount / Number(walletData.totalEarned)
    if (ratio > 0.9) {
      flags.push('HIGH_WITHDRAWAL_RATIO')
      score += 25
    }
  }

  return {
    score,
    flags,
    blocked: flags.includes('DAILY_LIMIT_EXCEEDED') || flags.includes('DAILY_AMOUNT_EXCEEDED'),
  }
}

// ── Withdrawal Creation ──

export async function requestWithdrawal(
  creatorId: string,
  method: 'pix' | 'bank_transfer' | 'crypto',
  fancoinAmount: number,
  details: {
    pixKey?: string
    bankDetails?: any
    cryptoAddress?: string
    cryptoNetwork?: string
  },
  ipAddress?: string,
) {
  // Validate minimum
  const minPayout = await getSetting('min_payout', PAYOUT_CONFIG.minPayout)
  const fancoinToBrl = await getSetting('fancoin_to_brl', PAYOUT_CONFIG.fancoinToBrl)
  const brlAmount = fancoinAmount * fancoinToBrl

  if (brlAmount < minPayout) {
    throw new AppError('MIN_PAYOUT', `Saque minimo: R$ ${minPayout.toFixed(2)}`, 400)
  }

  // Check balance
  const [wallet] = await db
    .select({ balance: fancoinWallets.balance })
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, creatorId))
    .limit(1)

  if (!wallet || Number(wallet.balance) < fancoinAmount) {
    throw new AppError('INSUFFICIENT_BALANCE', 'Saldo insuficiente de FanCoins', 400)
  }

  // Validate method-specific details
  if (method === 'pix' && !details.pixKey) {
    throw new AppError('MISSING_PIX_KEY', 'Chave PIX obrigatoria', 400)
  }
  if (method === 'crypto' && !details.cryptoAddress) {
    throw new AppError('MISSING_CRYPTO_ADDRESS', 'Endereco crypto obrigatorio', 400)
  }

  // Anti-fraud assessment
  const risk = await assessWithdrawalRisk(creatorId, brlAmount, fancoinAmount)

  if (risk.blocked) {
    const blockReason = risk.flags.includes('DAILY_LIMIT_EXCEEDED')
      ? 'Limite diario de saques atingido'
      : 'Limite diario de valor atingido'
    throw new AppError('WITHDRAWAL_BLOCKED', blockReason, 429)
  }

  const manualThreshold = await getSetting('manual_approval_threshold', PAYOUT_CONFIG.manualApprovalThreshold)
  const needsApproval = brlAmount >= manualThreshold || risk.score >= 50

  // Deduct from wallet
  await db
    .update(fancoinWallets)
    .set({
      balance: sql`${fancoinWallets.balance} - ${fancoinAmount}`,
      totalSpent: sql`${fancoinWallets.totalSpent} + ${fancoinAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, creatorId))

  // Record transaction
  const [updatedWallet] = await db
    .select({ balance: fancoinWallets.balance })
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, creatorId))
    .limit(1)

  await db.insert(fancoinTransactions).values({
    userId: creatorId,
    type: 'withdrawal',
    amount: -fancoinAmount,
    balanceAfter: Number(updatedWallet?.balance || 0),
    description: `Saque de R$ ${brlAmount.toFixed(2)} via ${method}`,
  })

  // Create payout record
  const [payout] = await db
    .insert(payouts)
    .values({
      creatorId,
      amount: String(brlAmount),
      fancoinAmount,
      currency: 'BRL',
      method,
      status: needsApproval ? 'pending_approval' : 'pending',
      pixKey: details.pixKey,
      bankDetails: details.bankDetails,
      cryptoAddress: details.cryptoAddress,
      cryptoNetwork: details.cryptoNetwork,
      requiresManualApproval: needsApproval,
      riskScore: risk.score,
      riskFlags: risk.flags,
      ipAddress,
    })
    .returning()

  return {
    payout,
    needsApproval,
    riskScore: risk.score,
    estimatedBrl: brlAmount,
  }
}

// ── Creator Earnings ──

export async function getCreatorEarnings(creatorId: string) {
  const [wallet] = await db
    .select()
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, creatorId))
    .limit(1)

  const fancoinToBrl = await getSetting('fancoin_to_brl', PAYOUT_CONFIG.fancoinToBrl)

  const myPayouts = await db
    .select()
    .from(payouts)
    .where(eq(payouts.creatorId, creatorId))
    .orderBy(desc(payouts.createdAt))
    .limit(50)

  const [totalWithdrawn] = await db
    .select({ total: sql<string>`COALESCE(SUM(${payouts.amount}::numeric), 0)` })
    .from(payouts)
    .where(and(eq(payouts.creatorId, creatorId), eq(payouts.status, 'completed')))

  return {
    wallet: wallet || { balance: 0, totalEarned: 0, totalSpent: 0 },
    fancoinToBrl,
    balanceBrl: Number(wallet?.balance || 0) * fancoinToBrl,
    totalWithdrawnBrl: Number(totalWithdrawn?.total || 0),
    payouts: myPayouts,
  }
}

// ── Admin Functions ──

export async function getPayoutsPendingApproval(page = 1, limit = 20) {
  const offset = (page - 1) * limit

  const items = await db
    .select()
    .from(payouts)
    .where(eq(payouts.status, 'pending_approval'))
    .orderBy(desc(payouts.createdAt))
    .limit(limit)
    .offset(offset)

  const [totalResult] = await db
    .select({ count: count() })
    .from(payouts)
    .where(eq(payouts.status, 'pending_approval'))

  return {
    items,
    total: totalResult?.count || 0,
    page,
    limit,
  }
}

export async function getAllPayouts(page = 1, limit = 20, status?: string) {
  const offset = (page - 1) * limit

  const conditions = status ? eq(payouts.status, status) : undefined

  const items = await db
    .select()
    .from(payouts)
    .where(conditions)
    .orderBy(desc(payouts.createdAt))
    .limit(limit)
    .offset(offset)

  const [totalResult] = await db
    .select({ count: count() })
    .from(payouts)
    .where(conditions)

  return {
    items,
    total: totalResult?.count || 0,
    page,
    limit,
  }
}

export async function approvePayout(payoutId: string, adminId: string) {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new AppError('NOT_FOUND', 'Saque nao encontrado', 404)
  if (payout.status !== 'pending_approval') {
    throw new AppError('INVALID_STATUS', 'Saque nao esta pendente de aprovacao', 400)
  }

  await db
    .update(payouts)
    .set({ status: 'pending', approvedBy: adminId, processedAt: new Date() })
    .where(eq(payouts.id, payoutId))

  return { approved: true }
}

export async function rejectPayout(payoutId: string, adminId: string, reason: string) {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new AppError('NOT_FOUND', 'Saque nao encontrado', 404)
  if (payout.status !== 'pending_approval' && payout.status !== 'pending') {
    throw new AppError('INVALID_STATUS', 'Saque nao pode ser rejeitado', 400)
  }

  // Refund FanCoins to creator
  await db
    .update(fancoinWallets)
    .set({
      balance: sql`${fancoinWallets.balance} + ${payout.fancoinAmount}`,
      totalSpent: sql`${fancoinWallets.totalSpent} - ${payout.fancoinAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(fancoinWallets.userId, payout.creatorId))

  const [updatedWallet] = await db
    .select({ balance: fancoinWallets.balance })
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, payout.creatorId))
    .limit(1)

  await db.insert(fancoinTransactions).values({
    userId: payout.creatorId,
    type: 'withdrawal_refund',
    amount: payout.fancoinAmount,
    balanceAfter: Number(updatedWallet?.balance || 0),
    description: `Saque rejeitado: ${reason}`,
  })

  await db
    .update(payouts)
    .set({ status: 'rejected', approvedBy: adminId, rejectedReason: reason, processedAt: new Date() })
    .where(eq(payouts.id, payoutId))

  return { rejected: true }
}

export async function getPaymentSettings() {
  const keys = [
    'manual_approval_threshold',
    'max_daily_withdrawals',
    'max_daily_amount',
    'cooldown_hours',
    'min_payout',
    'fancoin_to_brl',
  ]

  const settings: Record<string, any> = {
    manual_approval_threshold: PAYOUT_CONFIG.manualApprovalThreshold,
    max_daily_withdrawals: PAYOUT_CONFIG.maxDailyWithdrawals,
    max_daily_amount: PAYOUT_CONFIG.maxDailyAmount,
    cooldown_hours: PAYOUT_CONFIG.cooldownHours,
    min_payout: PAYOUT_CONFIG.minPayout,
    fancoin_to_brl: PAYOUT_CONFIG.fancoinToBrl,
  }

  try {
    const rows = await db.select().from(platformSettings)
    for (const row of rows) {
      if (keys.includes(row.key)) {
        settings[row.key] = row.value
      }
    }
  } catch {
    // Table may not exist yet — return defaults
    console.warn('platform_settings table not available, using defaults')
  }

  return settings
}

export async function updatePaymentSettings(updates: Record<string, any>, adminId: string) {
  const allowedKeys = [
    'manual_approval_threshold',
    'max_daily_withdrawals',
    'max_daily_amount',
    'cooldown_hours',
    'min_payout',
    'fancoin_to_brl',
  ]

  try {
    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.includes(key)) {
        await setSetting(key, value, adminId)
      }
    }
  } catch (e) {
    console.warn('Failed to update platform_settings:', e)
    throw new AppError('SETTINGS_UPDATE_FAILED', 'Tabela platform_settings nao existe. Execute db:push para criar.', 500)
  }

  return getPaymentSettings()
}
