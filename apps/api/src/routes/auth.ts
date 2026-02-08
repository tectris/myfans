import { Hono } from 'hono'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@fandreams/shared'
import { validateBody } from '../middleware/validation'
import * as authService from '../services/auth.service'
import { success, error } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { authRateLimit, sensitiveRateLimit } from '../middleware/rateLimit'

const auth = new Hono()

auth.post('/register', authRateLimit, validateBody(registerSchema), async (c) => {
  try {
    const body = c.req.valid('json')
    const result = await authService.register(body)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

auth.post('/login', authRateLimit, validateBody(loginSchema), async (c) => {
  try {
    const body = c.req.valid('json')
    const result = await authService.login(body)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

auth.post('/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json()
    if (!refreshToken) return error(c, 400, 'MISSING_TOKEN', 'Refresh token obrigatorio')
    const result = await authService.refreshTokens(refreshToken)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

auth.get('/me', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const result = await authService.getMe(userId)
  return success(c, result)
})

// ── Password Reset ──

auth.post('/forgot-password', sensitiveRateLimit, validateBody(forgotPasswordSchema), async (c) => {
  try {
    const { email } = c.req.valid('json')
    const result = await authService.forgotPassword(email)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

auth.post('/reset-password', sensitiveRateLimit, validateBody(resetPasswordSchema), async (c) => {
  try {
    const { token, password } = c.req.valid('json')
    const result = await authService.resetPassword(token, password)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

// ── Email Verification ──

auth.post('/verify-email', async (c) => {
  try {
    const { token } = await c.req.json()
    if (!token) return error(c, 400, 'MISSING_TOKEN', 'Token obrigatorio')
    const result = await authService.verifyEmail(token)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

auth.post('/resend-verification', authMiddleware, sensitiveRateLimit, async (c) => {
  try {
    const { userId } = c.get('user')
    const result = await authService.sendEmailVerification(userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof authService.AppError) {
      return error(c, e.status as any, e.code, e.message)
    }
    throw e
  }
})

export default auth
