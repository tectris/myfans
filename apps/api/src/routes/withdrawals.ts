import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { sensitiveRateLimit } from '../middleware/rateLimit'
import * as withdrawalService from '../services/withdrawal.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const withdrawals = new Hono()

// ── Creator endpoints ──

// Get earnings overview + payout history
withdrawals.get('/earnings', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const result = await withdrawalService.getCreatorEarnings(userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Request a withdrawal
withdrawals.post('/request', authMiddleware, sensitiveRateLimit, async (c) => {
  try {
    const { userId } = c.get('user')
    const { method, fancoinAmount, pixKey, bankDetails, cryptoAddress, cryptoNetwork } = await c.req.json()

    if (!method || !fancoinAmount) {
      return error(c, 400, 'MISSING_FIELDS', 'method e fancoinAmount obrigatorios')
    }

    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    const result = await withdrawalService.requestWithdrawal(
      userId,
      method,
      fancoinAmount,
      { pixKey, bankDetails, cryptoAddress, cryptoNetwork },
      ip,
    )
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// ── Admin endpoints ──

// Get all payouts (admin)
withdrawals.get('/admin/all', authMiddleware, adminMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || 1)
    const limit = Number(c.req.query('limit') || 20)
    const status = c.req.query('status')
    const result = await withdrawalService.getAllPayouts(page, limit, status)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Get pending approval payouts (admin)
withdrawals.get('/admin/pending', authMiddleware, adminMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || 1)
    const limit = Number(c.req.query('limit') || 20)
    const result = await withdrawalService.getPayoutsPendingApproval(page, limit)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Approve a payout (admin)
withdrawals.post('/admin/:id/approve', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const payoutId = c.req.param('id')
    const result = await withdrawalService.approvePayout(payoutId, userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Reject a payout (admin)
withdrawals.post('/admin/:id/reject', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const payoutId = c.req.param('id')
    const { reason } = await c.req.json()
    if (!reason) return error(c, 400, 'MISSING_REASON', 'Motivo obrigatorio')
    const result = await withdrawalService.rejectPayout(payoutId, userId, reason)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Get payment settings (admin)
withdrawals.get('/admin/settings', authMiddleware, adminMiddleware, async (c) => {
  try {
    const result = await withdrawalService.getPaymentSettings()
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Update payment settings (admin)
withdrawals.patch('/admin/settings', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const updates = await c.req.json()
    const result = await withdrawalService.updatePaymentSettings(updates, userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default withdrawals
