import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import * as paymentService from '../services/payment.service'
import * as subscriptionService from '../services/subscription.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'
import { env } from '../config/env'
import crypto from 'crypto'

const paymentsRoute = new Hono()

// Get available payment providers
paymentsRoute.get('/providers', async (c) => {
  const providers = paymentService.getAvailableProviders()
  return success(c, providers)
})

// Create a FanCoin purchase checkout (multi-provider)
paymentsRoute.post('/checkout/fancoins', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const { packageId, paymentMethod, provider } = await c.req.json()

    if (!packageId) {
      return error(c, 400, 'MISSING_PACKAGE', 'Package ID obrigatorio')
    }

    const result = await paymentService.createFancoinPayment(
      userId,
      packageId,
      paymentMethod || 'pix',
      provider || 'mercadopago',
    )
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Get payment status (for polling)
paymentsRoute.get('/status/:id', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const paymentId = c.req.param('id')
    const result = await paymentService.getPaymentStatus(paymentId, userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// PayPal capture (called when user returns from PayPal)
paymentsRoute.post('/paypal/capture', authMiddleware, async (c) => {
  try {
    const { orderId, paymentId } = await c.req.json()
    if (!orderId || !paymentId) {
      return error(c, 400, 'MISSING_DATA', 'orderId e paymentId obrigatorios')
    }
    const result = await paymentService.capturePaypalOrder(orderId, paymentId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Create a PPV checkout (MercadoPago)
paymentsRoute.post('/checkout/ppv', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const { postId, paymentMethod } = await c.req.json()
    if (!postId) return error(c, 400, 'MISSING_POST', 'Post ID obrigatorio')

    const result = await paymentService.createPpvPayment(userId, postId, paymentMethod || 'pix')
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// ── Webhooks (no auth) ──

async function processMpWebhookEvent(type: string, dataId: string) {
  // Route payment service first (handles payment + preapproval + authorized_payment)
  const result = await paymentService.handleMercadoPagoWebhook(type, String(dataId))

  // If it's a subscription event, also update the subscription
  if (result.processed && (result as any).type === 'preapproval') {
    const preapprovalResult = result as any
    const subResult = await subscriptionService.activateSubscriptionFromWebhook(
      preapprovalResult.preapprovalId,
      preapprovalResult.status,
    )
    return { ...result, subscription: subResult }
  }

  if (result.processed && (result as any).type === 'authorized_payment') {
    const authResult = result as any
    const subResult = await subscriptionService.recordSubscriptionPayment(
      authResult.preapprovalId,
      authResult.status,
      authResult.amount,
    )
    return { ...result, subscription: subResult }
  }

  return result
}

// MercadoPago webhook
paymentsRoute.post('/webhook/mercadopago', async (c) => {
  try {
    const isProduction = env.NODE_ENV === 'production'

    // In production, signature verification is MANDATORY
    if (env.MERCADOPAGO_WEBHOOK_SECRET) {
      const signature = c.req.header('x-signature')
      const requestId = c.req.header('x-request-id')

      if (!signature || !requestId) {
        if (isProduction) {
          console.warn('MP Webhook: missing signature headers in production — rejecting')
          return c.json({ received: true, error: 'missing_signature' }, 200)
        }
      } else {
        const parts = signature.split(',')
        const tsRaw = parts.find((p) => p.trim().startsWith('ts='))
        const hashRaw = parts.find((p) => p.trim().startsWith('v1='))
        const ts = tsRaw?.split('=')[1]
        const hash = hashRaw?.split('=')[1]

        if (ts && hash) {
          const body = await c.req.text()
          const bodyJson = JSON.parse(body)
          const dataId = bodyJson?.data?.id

          const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
          const computed = crypto
            .createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET)
            .update(manifest)
            .digest('hex')

          if (computed !== hash) {
            console.warn('MP Webhook: invalid signature — rejecting')
            return c.json({ received: true, error: 'invalid_signature' }, 200)
          }

          const result = await processMpWebhookEvent(bodyJson.type, String(dataId))
          return c.json({ received: true, ...result }, 200)
        } else if (isProduction) {
          console.warn('Webhook: malformed signature in production — rejecting')
          return c.json({ received: true, error: 'malformed_signature' }, 200)
        }
      }
    } else if (isProduction) {
      console.error('Webhook: MERCADOPAGO_WEBHOOK_SECRET not set in production!')
      return c.json({ received: true, error: 'not_configured' }, 200)
    }

    // Without signature verification (dev/testing only)
    const body = await c.req.json()
    const dataId = body?.data?.id
    const type = body?.type || body?.action

    if (dataId) {
      const result = await processMpWebhookEvent(type, String(dataId))
      return c.json({ received: true, ...result }, 200)
    }

    return c.json({ received: true }, 200)
  } catch (err) {
    console.error('MP Webhook error:', err)
    return c.json({ received: true, error: 'processing_error' }, 200)
  }
})

// Legacy webhook path (backwards compatibility)
paymentsRoute.post('/webhook', async (c) => {
  try {
    const body = await c.req.json()
    const dataId = body?.data?.id
    const type = body?.type || body?.action
    if (dataId) {
      const result = await processMpWebhookEvent(type, String(dataId))
      return c.json({ received: true, ...result }, 200)
    }
    return c.json({ received: true }, 200)
  } catch (err) {
    console.error('Legacy webhook error:', err)
    return c.json({ received: true }, 200)
  }
})

// NOWPayments IPN webhook
paymentsRoute.post('/webhook/nowpayments', async (c) => {
  try {
    const body = await c.req.json()

    // Verify IPN signature if secret is configured
    if (env.NOWPAYMENTS_IPN_SECRET) {
      const sig = c.req.header('x-nowpayments-sig')
      if (sig) {
        const sorted = JSON.stringify(body, Object.keys(body).sort())
        const computed = crypto.createHmac('sha512', env.NOWPAYMENTS_IPN_SECRET).update(sorted).digest('hex')
        if (computed !== sig) {
          console.warn('NP Webhook: invalid signature')
          return c.json({ received: true }, 200)
        }
      }
    }

    const result = await paymentService.handleNowPaymentsWebhook(body)
    return c.json({ received: true, ...result }, 200)
  } catch (err) {
    console.error('NP Webhook error:', err)
    return c.json({ received: true }, 200)
  }
})

// PayPal webhook
paymentsRoute.post('/webhook/paypal', async (c) => {
  try {
    const body = await c.req.json()
    const result = await paymentService.handlePaypalWebhook(body)
    return c.json({ received: true, ...result }, 200)
  } catch (err) {
    console.error('PP Webhook error:', err)
    return c.json({ received: true }, 200)
  }
})

export default paymentsRoute
