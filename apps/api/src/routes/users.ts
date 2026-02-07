import { Hono } from 'hono'
import { updateProfileSchema, updateSettingsSchema } from '@myfans/shared'
import { validateBody } from '../middleware/validation'
import { authMiddleware } from '../middleware/auth'
import * as userService from '../services/user.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const usersRoute = new Hono()

usersRoute.get('/me', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const profile = await userService.getProfile(userId)
    const dashboard = await userService.getDashboardData(userId)
    return success(c, { ...profile, ...dashboard })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

usersRoute.patch('/me', authMiddleware, validateBody(updateProfileSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const updated = await userService.updateProfile(userId, body)
    return success(c, updated)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

usersRoute.patch('/me/password', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const { currentPassword, newPassword } = await c.req.json()
    if (!currentPassword || !newPassword) {
      return error(c, 400, 'MISSING_FIELDS', 'Senha atual e nova senha obrigatorias')
    }
    if (newPassword.length < 6) {
      return error(c, 400, 'WEAK_PASSWORD', 'Nova senha deve ter pelo menos 6 caracteres')
    }
    const result = await userService.changePassword(userId, currentPassword, newPassword)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

usersRoute.get('/me/settings', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const settings = await userService.getSettings(userId)
  return success(c, settings)
})

usersRoute.patch('/me/settings', authMiddleware, validateBody(updateSettingsSchema), async (c) => {
  const { userId } = c.get('user')
  const body = c.req.valid('json')
  const updated = await userService.updateSettings(userId, body)
  return success(c, updated)
})

usersRoute.get('/:username', async (c) => {
  try {
    const username = c.req.param('username')
    const profile = await userService.getPublicProfile(username)
    return success(c, profile)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default usersRoute
