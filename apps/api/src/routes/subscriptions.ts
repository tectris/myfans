import { Hono } from 'hono'
import { createSubscriptionSchema } from '@myfans/shared'
import { validateBody } from '../middleware/validation'
import { authMiddleware } from '../middleware/auth'
import * as subscriptionService from '../services/subscription.service'
import * as gamificationService from '../services/gamification.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const subscriptionsRoute = new Hono()

subscriptionsRoute.post('/', authMiddleware, validateBody(createSubscriptionSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const sub = await subscriptionService.subscribe(userId, body.creatorId, body.tierId)
    await gamificationService.addXp(userId, 'subscription_made')
    return success(c, sub)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

subscriptionsRoute.get('/', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const subs = await subscriptionService.getUserSubscriptions(userId)
  return success(c, subs)
})

subscriptionsRoute.delete('/:id', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const subId = c.req.param('id')
    const result = await subscriptionService.cancelSubscription(subId, userId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

subscriptionsRoute.get('/check/:creatorId', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const creatorId = c.req.param('creatorId')
  const isSubscribed = await subscriptionService.checkSubscription(userId, creatorId)
  return success(c, { isSubscribed })
})

export default subscriptionsRoute
