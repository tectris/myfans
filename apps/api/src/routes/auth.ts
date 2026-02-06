import { Hono } from 'hono'
import { registerSchema, loginSchema } from '@myfans/shared'
import { validateBody } from '../middleware/validation'
import * as authService from '../services/auth.service'
import { success, error } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const auth = new Hono()

auth.post('/register', validateBody(registerSchema), async (c) => {
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

auth.post('/login', validateBody(loginSchema), async (c) => {
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
  const user = c.get('user')
  return success(c, { userId: user.userId, role: user.role })
})

export default auth
