import { eq, and, sql } from 'drizzle-orm'
import { subscriptions, creatorProfiles, subscriptionTiers, payments } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import { PLATFORM_FEES } from '@fandreams/shared'

export async function subscribe(fanId: string, creatorId: string, tierId?: string) {
  if (fanId === creatorId) {
    throw new AppError('INVALID', 'Voce nao pode assinar a si mesmo', 400)
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.fanId, fanId), eq(subscriptions.creatorId, creatorId)))
    .limit(1)

  if (existing && existing.status === 'active') {
    throw new AppError('ALREADY_SUBSCRIBED', 'Voce ja esta inscrito neste criador', 409)
  }

  let price: string
  if (tierId) {
    const [tier] = await db.select().from(subscriptionTiers).where(eq(subscriptionTiers.id, tierId)).limit(1)
    if (!tier) throw new AppError('NOT_FOUND', 'Tier nao encontrado', 404)
    price = tier.price
  } else {
    const [creator] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, creatorId))
      .limit(1)
    if (!creator) throw new AppError('NOT_FOUND', 'Criador nao encontrado', 404)
    price = creator.subscriptionPrice || '0'
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const platformFee = Number(price) * PLATFORM_FEES.subscription
  const creatorAmount = Number(price) - platformFee

  const [sub] = await db
    .insert(subscriptions)
    .values({
      fanId,
      creatorId,
      tierId,
      pricePaid: price,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: [subscriptions.fanId, subscriptions.creatorId],
      set: {
        status: 'active',
        tierId,
        pricePaid: price,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
        autoRenew: true,
        updatedAt: now,
      },
    })
    .returning()

  await db.insert(payments).values({
    userId: fanId,
    recipientId: creatorId,
    type: 'subscription',
    amount: price,
    platformFee: String(platformFee),
    creatorAmount: String(creatorAmount),
    status: 'completed',
    metadata: { subscriptionId: sub?.id, tierId },
  })

  await db
    .update(creatorProfiles)
    .set({
      totalSubscribers: sql`${creatorProfiles.totalSubscribers} + 1`,
      totalEarnings: sql`${creatorProfiles.totalEarnings} + ${creatorAmount}`,
    })
    .where(eq(creatorProfiles.userId, creatorId))

  return sub
}

export async function cancelSubscription(subscriptionId: string, fanId: string) {
  const [sub] = await db
    .update(subscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      autoRenew: false,
      updatedAt: new Date(),
    })
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.fanId, fanId)))
    .returning()

  if (!sub) throw new AppError('NOT_FOUND', 'Assinatura nao encontrada', 404)
  return sub
}

export async function getUserSubscriptions(fanId: string) {
  const subs = await db
    .select({
      id: subscriptions.id,
      creatorId: subscriptions.creatorId,
      status: subscriptions.status,
      pricePaid: subscriptions.pricePaid,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      autoRenew: subscriptions.autoRenew,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.fanId, fanId))

  return subs
}

export async function checkSubscription(fanId: string, creatorId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.fanId, fanId),
        eq(subscriptions.creatorId, creatorId),
        eq(subscriptions.status, 'active'),
      ),
    )
    .limit(1)

  return !!sub
}
