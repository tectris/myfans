import { eq, and } from 'drizzle-orm'
import { payments } from '@myfans/database'
import { db } from '../config/database'
import { env } from '../config/env'
import { AppError } from './auth.service'
import { FANCOIN_PACKAGES, PLATFORM_FEES } from '@myfans/shared'
import * as fancoinService from './fancoin.service'

// ── MercadoPago ──

function getMpApi() {
  return env.MERCADOPAGO_SANDBOX === 'true'
    ? 'https://api.mercadopago.com'
    : 'https://api.mercadopago.com'
}

function isMpSandbox() {
  return env.MERCADOPAGO_SANDBOX === 'true'
}

async function mpFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new AppError('PAYMENT_UNAVAILABLE', 'MercadoPago nao configurado', 503)
  }

  const res = await fetch(`${getMpApi()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('MercadoPago API error:', data)
    throw new AppError('PAYMENT_ERROR', data.message || 'Erro no processamento do pagamento', 502)
  }

  return data as T
}

type MpPreference = { id: string; init_point: string; sandbox_init_point: string }
type MpPaymentInfo = {
  id: number
  status: string
  status_detail: string
  external_reference: string
  transaction_amount: number
  payment_method_id: string
}

// ── NOWPayments ──

function getNowPaymentsApi() {
  return env.NOWPAYMENTS_SANDBOX === 'true'
    ? 'https://api-sandbox.nowpayments.io/v1'
    : 'https://api.nowpayments.io/v1'
}

async function npFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.NOWPAYMENTS_API_KEY) {
    throw new AppError('PAYMENT_UNAVAILABLE', 'NOWPayments nao configurado', 503)
  }

  const res = await fetch(`${getNowPaymentsApi()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.NOWPAYMENTS_API_KEY,
      ...(options.headers || {}),
    },
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('NOWPayments API error:', data)
    throw new AppError('PAYMENT_ERROR', data.message || 'Erro no processamento crypto', 502)
  }

  return data as T
}

// ── PayPal ──

function getPaypalApi() {
  return env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

async function getPaypalAccessToken(): Promise<string> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new AppError('PAYMENT_UNAVAILABLE', 'PayPal nao configurado', 503)
  }

  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${getPaypalApi()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('PayPal auth error:', data)
    throw new AppError('PAYMENT_ERROR', 'Falha na autenticacao PayPal', 502)
  }

  return data.access_token
}

async function ppFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getPaypalAccessToken()
  const res = await fetch(`${getPaypalApi()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('PayPal API error:', data)
    throw new AppError('PAYMENT_ERROR', data.message || 'Erro PayPal', 502)
  }

  return data as T
}

// ── Unified Payment Creation ──

export type PaymentProvider = 'mercadopago' | 'nowpayments' | 'paypal'
export type PaymentMethod = 'pix' | 'credit_card' | 'crypto' | 'paypal'

export async function createFancoinPayment(
  userId: string,
  packageId: string,
  paymentMethod: PaymentMethod,
  provider: PaymentProvider,
) {
  const pkg = FANCOIN_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) throw new AppError('NOT_FOUND', 'Pacote nao encontrado', 404)

  // Create internal payment record
  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      type: 'fancoin_purchase',
      amount: String(pkg.price),
      currency: provider === 'nowpayments' ? 'USD' : 'BRL',
      platformFee: String(pkg.price * PLATFORM_FEES.fancoin_purchase),
      paymentProvider: provider,
      status: 'pending',
      metadata: { packageId, coins: pkg.coins, bonus: pkg.bonus, paymentMethod, provider },
    })
    .returning()

  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  switch (provider) {
    case 'mercadopago':
      return createMpPayment(payment, pkg, paymentMethod, appUrl)
    case 'nowpayments':
      return createNpPayment(payment, pkg, appUrl)
    case 'paypal':
      return createPpPayment(payment, pkg, appUrl)
    default:
      throw new AppError('INVALID_PROVIDER', 'Provedor de pagamento invalido', 400)
  }
}

// ── MercadoPago Payment ──

async function createMpPayment(payment: any, pkg: any, paymentMethod: string, appUrl: string) {
  const apiUrl = env.NEXT_PUBLIC_APP_URL?.replace('://www.', '://api.').replace('://', '://api.') || 'https://api.myfans.my'

  const preference = await mpFetch<MpPreference>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          title: `${pkg.coins.toLocaleString()} FanCoins${pkg.bonus > 0 ? ` (+${pkg.bonus} bonus)` : ''}`,
          description: `Pacote ${pkg.label} - MyFans`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: pkg.price,
        },
      ],
      external_reference: payment.id,
      payment_methods: {
        excluded_payment_types: paymentMethod === 'pix' ? [{ id: 'credit_card' }] : [],
        installments: paymentMethod === 'credit_card' ? 12 : 1,
      },
      back_urls: {
        success: `${appUrl}/wallet?payment=success&provider=mercadopago`,
        failure: `${appUrl}/wallet?payment=failure&provider=mercadopago`,
        pending: `${appUrl}/wallet?payment=pending&provider=mercadopago`,
      },
      auto_return: 'approved',
      notification_url: `https://api.myfans.my/api/v1/payments/webhook/mercadopago`,
      statement_descriptor: 'MYFANS',
    }),
  })

  await db
    .update(payments)
    .set({ providerTxId: preference.id })
    .where(eq(payments.id, payment.id))

  return {
    paymentId: payment.id,
    provider: 'mercadopago' as const,
    checkoutUrl: isMpSandbox() ? preference.sandbox_init_point : preference.init_point,
    preferenceId: preference.id,
    package: pkg,
    sandbox: isMpSandbox(),
  }
}

// ── NOWPayments Payment ──

async function createNpPayment(payment: any, pkg: any, appUrl: string) {
  const priceUsd = pkg.price / 5.0 // Approximate BRL to USD (configurable later via admin)

  const invoice = await npFetch<{
    id: string
    invoice_url: string
    token_id: string
  }>('/invoice', {
    method: 'POST',
    body: JSON.stringify({
      price_amount: priceUsd,
      price_currency: 'usd',
      order_id: payment.id,
      order_description: `${pkg.coins.toLocaleString()} FanCoins - MyFans`,
      ipn_callback_url: `https://api.myfans.my/api/v1/payments/webhook/nowpayments`,
      success_url: `${appUrl}/wallet?payment=success&provider=nowpayments`,
      cancel_url: `${appUrl}/wallet?payment=failure&provider=nowpayments`,
    }),
  })

  await db
    .update(payments)
    .set({ providerTxId: invoice.id, metadata: { ...(payment.metadata as any), invoiceId: invoice.id } })
    .where(eq(payments.id, payment.id))

  return {
    paymentId: payment.id,
    provider: 'nowpayments' as const,
    checkoutUrl: invoice.invoice_url,
    invoiceId: invoice.id,
    package: pkg,
    sandbox: env.NOWPAYMENTS_SANDBOX === 'true',
  }
}

// ── PayPal Payment ──

async function createPpPayment(payment: any, pkg: any, appUrl: string) {
  const order = await ppFetch<{
    id: string
    links: Array<{ href: string; rel: string }>
  }>('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: payment.id,
          description: `${pkg.coins.toLocaleString()} FanCoins - MyFans`,
          amount: {
            currency_code: 'BRL',
            value: pkg.price.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'MyFans',
        return_url: `${appUrl}/wallet?payment=success&provider=paypal&orderId=${payment.id}`,
        cancel_url: `${appUrl}/wallet?payment=failure&provider=paypal`,
        user_action: 'PAY_NOW',
      },
    }),
  })

  const approvalLink = order.links.find((l) => l.rel === 'approve')

  await db
    .update(payments)
    .set({ providerTxId: order.id })
    .where(eq(payments.id, payment.id))

  return {
    paymentId: payment.id,
    provider: 'paypal' as const,
    checkoutUrl: approvalLink?.href || '',
    orderId: order.id,
    package: pkg,
    sandbox: env.PAYPAL_SANDBOX === 'true',
  }
}

// ── Webhooks ──

export async function handleMercadoPagoWebhook(type: string, dataId: string) {
  if (type !== 'payment') return { processed: false }

  const mpPayment = await mpFetch<MpPaymentInfo>(`/v1/payments/${dataId}`)

  if (!mpPayment.external_reference) {
    console.warn('MP Webhook: no external_reference', dataId)
    return { processed: false }
  }

  return processPaymentConfirmation(
    mpPayment.external_reference,
    mpPayment.status === 'approved' ? 'completed' : mpPayment.status,
    String(mpPayment.id),
    {
      mpStatus: mpPayment.status,
      mpStatusDetail: mpPayment.status_detail,
      mpPaymentMethod: mpPayment.payment_method_id,
    },
  )
}

export async function handleNowPaymentsWebhook(body: any) {
  const orderId = body.order_id
  if (!orderId) return { processed: false }

  const statusMap: Record<string, string> = {
    finished: 'completed',
    confirmed: 'completed',
    sending: 'pending',
    waiting: 'pending',
    partially_paid: 'pending',
    failed: 'failed',
    refunded: 'refunded',
    expired: 'expired',
  }

  const status = statusMap[body.payment_status] || body.payment_status

  return processPaymentConfirmation(orderId, status, String(body.payment_id), {
    npStatus: body.payment_status,
    payCurrency: body.pay_currency,
    payAmount: body.pay_amount,
    actuallyPaid: body.actually_paid,
  })
}

export async function handlePaypalWebhook(body: any) {
  const resource = body.resource
  if (!resource) return { processed: false }

  const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id
  const referenceId = resource.purchase_units?.[0]?.reference_id

  if (!referenceId) return { processed: false }

  const statusMap: Record<string, string> = {
    COMPLETED: 'completed',
    APPROVED: 'completed',
    VOIDED: 'failed',
    DECLINED: 'failed',
  }

  const status = statusMap[resource.status] || 'pending'

  return processPaymentConfirmation(referenceId, status, orderId, {
    ppStatus: resource.status,
    ppOrderId: orderId,
  })
}

export async function capturePaypalOrder(orderId: string, paymentId: string) {
  const capture = await ppFetch<{ id: string; status: string }>(`/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
  })

  return processPaymentConfirmation(paymentId, capture.status === 'COMPLETED' ? 'completed' : 'pending', orderId, {
    ppStatus: capture.status,
    ppCaptureId: capture.id,
  })
}

// ── Shared confirmation logic ──

async function processPaymentConfirmation(
  paymentId: string,
  status: string,
  providerTxId: string,
  extraMeta: Record<string, any>,
) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)

  if (!payment) {
    console.warn('Webhook: payment not found', paymentId)
    return { processed: false }
  }

  if (payment.status === 'completed') {
    return { processed: true, status: 'already_completed' }
  }

  await db
    .update(payments)
    .set({
      status,
      providerTxId,
      metadata: { ...(payment.metadata as any), ...extraMeta },
    })
    .where(eq(payments.id, payment.id))

  if (status === 'completed') {
    const meta = payment.metadata as any
    const packageId = meta?.packageId
    if (packageId) {
      const pkg = FANCOIN_PACKAGES.find((p) => p.id === packageId)
      if (pkg) {
        await fancoinService.creditPurchase(payment.userId, pkg.coins + (pkg.bonus || 0), pkg.label, payment.id)
      }
    }
  }

  return { processed: true, status }
}

// ── Status ──

export function getAvailableProviders() {
  const providers: Array<{ id: PaymentProvider; label: string; methods: string[]; sandbox: boolean }> = []

  if (env.MERCADOPAGO_ACCESS_TOKEN) {
    providers.push({
      id: 'mercadopago',
      label: 'MercadoPago',
      methods: ['pix', 'credit_card'],
      sandbox: isMpSandbox(),
    })
  }

  if (env.NOWPAYMENTS_API_KEY) {
    providers.push({
      id: 'nowpayments',
      label: 'Crypto (Bitcoin, USDT, ETH...)',
      methods: ['crypto'],
      sandbox: env.NOWPAYMENTS_SANDBOX === 'true',
    })
  }

  if (env.PAYPAL_CLIENT_ID) {
    providers.push({
      id: 'paypal',
      label: 'PayPal',
      methods: ['paypal'],
      sandbox: env.PAYPAL_SANDBOX === 'true',
    })
  }

  return providers
}

export async function getPaymentStatus(paymentId: string, userId: string) {
  const [payment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      amount: payments.amount,
      paymentProvider: payments.paymentProvider,
      metadata: payments.metadata,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
    .limit(1)

  if (!payment) throw new AppError('NOT_FOUND', 'Pagamento nao encontrado', 404)
  return payment
}
