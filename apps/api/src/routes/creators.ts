import { Hono } from 'hono'
import { z } from 'zod'
import { createTierSchema } from '@myfans/shared'
import { validateBody } from '../middleware/validation'
import { authMiddleware, creatorMiddleware } from '../middleware/auth'
import * as creatorService from '../services/creator.service'
import { success, error, paginated } from '../utils/response'
import { AppError } from '../services/auth.service'

const creators = new Hono()

const applySchema = z.object({
  category: z.string().min(1),
  subscriptionPrice: z.number().min(5).max(5000),
  tags: z.array(z.string()).optional(),
})

creators.post('/apply', authMiddleware, validateBody(applySchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const profile = await creatorService.applyAsCreator(userId, body)
    return success(c, profile)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

creators.get('/me', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const profile = await creatorService.getCreatorProfile(userId)
    return success(c, profile)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

creators.get('/me/earnings', authMiddleware, creatorMiddleware, async (c) => {
  const { userId } = c.get('user')
  const earnings = await creatorService.getCreatorEarnings(userId)
  return success(c, earnings)
})

creators.get('/me/subscribers', authMiddleware, creatorMiddleware, async (c) => {
  const { userId } = c.get('user')
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const result = await creatorService.getCreatorSubscribers(userId, page, limit)
  return paginated(c, result.subscribers, { page, limit, total: result.total })
})

creators.post('/me/tiers', authMiddleware, creatorMiddleware, validateBody(createTierSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const tier = await creatorService.createTier(userId, body)
    return success(c, tier)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default creators
