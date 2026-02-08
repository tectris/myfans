import { eq, and, sql, lt, ne } from 'drizzle-orm'
import { subscriptions, creatorProfiles, subscriptionTiers, payments, users } from '@fandreams/database'
import { db } from '../config/database'
import { env } from '../config/env'
import { AppError } from './auth.service'
import { PLATFORM_FEES } from '@fandreams/shared'
import * as paymentService from './payment.service'

// ── Create subscription with MP checkout ──

export async function createSubscriptionCheckout(
  fanId: string,
  creatorId: string,
  tierId?: string,
  paymentMethod?: string,
) {
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

  // Get price
  let price: string
  let tierName: string | undefined
  if (tierId) {
    const [tier] = await db.select().from(subscriptionTiers).where(eq(subscriptionTiers.id, tierId)).limit(1)
    if (!tier) throw new AppError('NOT_FOUND', 'Tier nao encontrado', 404)
    price = tier.price
    tierName = tier.name
  } else {
    const [creator] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, creatorId))
      .limit(1)
    if (!creator) throw new AppError('NOT_FOUND', 'Criador nao encontrado', 404)
    price = creator.subscriptionPrice || '0'
  }

  const amount = Number(price)

  // Free subscription: activate directly
  if (amount <= 0) {
    return { subscription: await activateSubscription(fanId, creatorId, tierId, price), checkoutUrl: null }
  }

  // Get fan email and creator name for MP
  const [fan] = await db.select({ email: users.email }).from(users).where(eq(users.id, fanId)).limit(1)
  if (!fan) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  const [creator] = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1)
  const creatorName = creator?.displayName || creator?.username || 'Criador'

  // Create pending subscription record
  const now = new Date()
  const [sub] = await db
    .insert(subscriptions)
    .values({
      fanId,
      creatorId,
      tierId,
      status: 'pending',
      pricePaid: price,
      paymentProvider: 'mercadopago',
      currentPeriodStart: now,
      currentPeriodEnd: now, // will be set properly on activation
      autoRenew: true,
    })
    .onConflictDoUpdate({
      target: [subscriptions.fanId, subscriptions.creatorId],
      set: {
        status: 'pending',
        tierId,
        pricePaid: price,
        paymentProvider: 'mercadopago',
        cancelledAt: null,
        autoRenew: true,
        updatedAt: now,
      },
    })
    .returning()

  // Create pending payment record
  const platformFee = amount * PLATFORM_FEES.subscription
  const creatorAmount = amount - platformFee

  await db.insert(payments).values({
    userId: fanId,
    recipientId: creatorId,
    type: 'subscription',
    amount: price,
    platformFee: String(platformFee),
    creatorAmount: String(creatorAmount),
    paymentProvider: 'mercadopago',
    status: 'pending',
    metadata: { subscriptionId: sub.id, tierId, tierName, paymentMethod },
  })

  // Create MP preapproval
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const creatorUsername = creator?.username || creatorId

  const mpResult = await paymentService.createMpSubscription({
    subscriptionId: sub.id,
    payerEmail: fan.email,
    creatorName,
    tierName,
    amount,
    backUrl: `${appUrl}/creator/${creatorUsername}?subscription=pending`,
  })

  // Store preapproval ID
  await db
    .update(subscriptions)
    .set({ providerSubId: mpResult.preapprovalId })
    .where(eq(subscriptions.id, sub.id))

  return {
    subscription: sub,
    checkoutUrl: mpResult.checkoutUrl,
    preapprovalId: mpResult.preapprovalId,
    sandbox: mpResult.sandbox,
  }
}

// ── Activate subscription (from webhook or free) ──

async function activateSubscription(fanId: string, creatorId: string, tierId?: string, price?: string) {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const amount = Number(price || 0)
  const platformFee = amount * PLATFORM_FEES.subscription
  const creatorAmount = amount - platformFee

  const [sub] = await db
    .insert(subscriptions)
    .values({
      fanId,
      creatorId,
      tierId,
      pricePaid: price || '0',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: [subscriptions.fanId, subscriptions.creatorId],
      set: {
        status: 'active',
        tierId,
        pricePaid: price || '0',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
        autoRenew: true,
        updatedAt: now,
      },
    })
    .returning()

  if (amount > 0) {
    await db.insert(payments).values({
      userId: fanId,
      recipientId: creatorId,
      type: 'subscription',
      amount: price || '0',
      platformFee: String(platformFee),
      creatorAmount: String(creatorAmount),
      status: 'completed',
      metadata: { subscriptionId: sub?.id, tierId },
    })
  }

  await db
    .update(creatorProfiles)
    .set({
      totalSubscribers: sql`${creatorProfiles.totalSubscribers} + 1`,
      totalEarnings: sql`${creatorProfiles.totalEarnings} + ${creatorAmount}`,
    })
    .where(eq(creatorProfiles.userId, creatorId))

  return sub
}

// ── Webhook: activate pending subscription when MP confirms ──

export async function activateSubscriptionFromWebhook(
  preapprovalId: string,
  mpStatus: string,
) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.providerSubId, preapprovalId))
    .limit(1)

  if (!sub) {
    console.warn('Subscription webhook: no subscription found for preapproval', preapprovalId)
    return { processed: false }
  }

  if (mpStatus === 'authorized') {
    if (sub.status === 'active') {
      return { processed: true, status: 'already_active' }
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await db
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id))

    // Update creator stats
    const amount = Number(sub.pricePaid || 0)
    const platformFee = amount * PLATFORM_FEES.subscription
    const creatorAmount = amount - platformFee

    await db
      .update(creatorProfiles)
      .set({
        totalSubscribers: sql`${creatorProfiles.totalSubscribers} + 1`,
        totalEarnings: sql`${creatorProfiles.totalEarnings} + ${creatorAmount}`,
      })
      .where(eq(creatorProfiles.userId, sub.creatorId))

    // Mark pending payment as completed
    await db
      .update(payments)
      .set({ status: 'completed', providerTxId: preapprovalId })
      .where(
        and(
          eq(payments.userId, sub.fanId),
          eq(payments.recipientId, sub.creatorId),
          eq(payments.type, 'subscription'),
          eq(payments.status, 'pending'),
        ),
      )

    console.log(`Subscription ${sub.id} activated via MP preapproval ${preapprovalId}`)
    return { processed: true, status: 'activated', subscriptionId: sub.id }
  }

  if (mpStatus === 'paused') {
    await db
      .update(subscriptions)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id))
    return { processed: true, status: 'paused', subscriptionId: sub.id }
  }

  if (mpStatus === 'cancelled') {
    // If user already cancelled through our platform, keep access until period end
    if (sub.cancelledAt && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
      // Already handled — user keeps access until currentPeriodEnd
      return { processed: true, status: 'cancelled_graceful', subscriptionId: sub.id }
    }

    await db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date(), autoRenew: false, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id))
    return { processed: true, status: 'cancelled', subscriptionId: sub.id }
  }

  return { processed: true, status: mpStatus }
}

// ── Webhook: record recurring payment ──

export async function recordSubscriptionPayment(
  preapprovalId: string,
  mpPaymentStatus: string,
  amount: number,
) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.providerSubId, preapprovalId))
    .limit(1)

  if (!sub) {
    console.warn('Authorized payment webhook: no subscription for preapproval', preapprovalId)
    return { processed: false }
  }

  if (mpPaymentStatus === 'approved') {
    // Extend subscription period
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await db
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id))

    // Record payment
    const platformFee = amount * PLATFORM_FEES.subscription
    const creatorAmount = amount - platformFee

    await db.insert(payments).values({
      userId: sub.fanId,
      recipientId: sub.creatorId,
      type: 'subscription',
      amount: String(amount),
      platformFee: String(platformFee),
      creatorAmount: String(creatorAmount),
      paymentProvider: 'mercadopago',
      providerTxId: preapprovalId,
      status: 'completed',
      metadata: { subscriptionId: sub.id, recurring: true },
    })

    await db
      .update(creatorProfiles)
      .set({
        totalEarnings: sql`${creatorProfiles.totalEarnings} + ${creatorAmount}`,
      })
      .where(eq(creatorProfiles.userId, sub.creatorId))

    console.log(`Recurring payment recorded for subscription ${sub.id}`)
    return { processed: true, status: 'payment_recorded', subscriptionId: sub.id }
  }

  return { processed: true, status: mpPaymentStatus }
}

// ── Cancel subscription (keeps access until currentPeriodEnd) ──

export async function cancelSubscription(subscriptionId: string, fanId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.fanId, fanId)))
    .limit(1)

  if (!sub) throw new AppError('NOT_FOUND', 'Assinatura nao encontrada', 404)

  if (sub.status !== 'active') {
    throw new AppError('INVALID', 'Assinatura nao esta ativa', 400)
  }

  if (sub.cancelledAt) {
    throw new AppError('ALREADY_CANCELLED', 'Assinatura ja foi cancelada. Acesso ativo ate o fim do periodo.', 409)
  }

  // Cancel recurring billing on MP (stops future charges)
  if (sub.providerSubId && sub.paymentProvider === 'mercadopago') {
    try {
      await paymentService.cancelMpSubscription(sub.providerSubId)
    } catch (e) {
      console.error('Failed to cancel MP subscription:', e)
      // Continue with local cancellation even if MP fails
    }
  }

  // Keep status 'active' — user retains access until currentPeriodEnd
  // autoRenew = false prevents future charges
  // cancelledAt marks when cancellation was requested
  const [updated] = await db
    .update(subscriptions)
    .set({
      cancelledAt: new Date(),
      autoRenew: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning()

  return updated
}

// ── Expire subscriptions past their period ──

export async function expireOverdueSubscriptions() {
  const now = new Date()

  // Expire active subscriptions where:
  // - autoRenew is false (cancelled by user)
  // - currentPeriodEnd has passed
  const expired = await db
    .update(subscriptions)
    .set({
      status: 'expired',
      updatedAt: now,
    })
    .where(
      and(
        eq(subscriptions.status, 'active'),
        eq(subscriptions.autoRenew, false),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .returning({ id: subscriptions.id, fanId: subscriptions.fanId, creatorId: subscriptions.creatorId })

  // Decrement subscriber count for each expired subscription
  for (const sub of expired) {
    await db
      .update(creatorProfiles)
      .set({
        totalSubscribers: sql`GREATEST(${creatorProfiles.totalSubscribers} - 1, 0)`,
      })
      .where(eq(creatorProfiles.userId, sub.creatorId))
  }

  if (expired.length > 0) {
    console.log(`Expired ${expired.length} overdue subscriptions`)
  }

  return expired
}

// ── Queries ──

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

export async function getSubscriptionStatus(fanId: string, creatorId: string) {
  const [sub] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      pricePaid: subscriptions.pricePaid,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelledAt: subscriptions.cancelledAt,
      autoRenew: subscriptions.autoRenew,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.fanId, fanId),
        eq(subscriptions.creatorId, creatorId),
      ),
    )
    .limit(1)

  if (!sub) {
    return { isSubscribed: false, subscription: null }
  }

  const isActive = sub.status === 'active'
  const isCancelled = !!sub.cancelledAt && isActive
  const periodEnd = sub.currentPeriodEnd

  return {
    isSubscribed: isActive,
    subscription: {
      id: sub.id,
      status: sub.status,
      pricePaid: sub.pricePaid,
      currentPeriodEnd: periodEnd,
      cancelledAt: sub.cancelledAt,
      autoRenew: sub.autoRenew,
      isCancelled,
      createdAt: sub.createdAt,
    },
  }
}
