import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import * as gamificationService from '../services/gamification.service'
import { FANCOIN_PACKAGES, FAN_TIERS, XP_REWARDS } from '@fandreams/shared'
import { success } from '../utils/response'

const gamification = new Hono()

gamification.get('/me', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const profile = await gamificationService.getGamificationProfile(userId)
  return success(c, profile)
})

gamification.post('/checkin', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const result = await gamificationService.checkIn(userId)
  return success(c, result)
})

gamification.get('/missions', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const missions = await gamificationService.getDailyMissions(userId)
  return success(c, missions)
})

gamification.get('/tiers', async (c) => {
  return success(c, FAN_TIERS)
})

gamification.get('/xp-rewards', async (c) => {
  return success(c, XP_REWARDS)
})

export default gamification
