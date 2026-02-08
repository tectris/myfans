import { Hono } from 'hono'
import { z } from 'zod'
import { purchaseFancoinsSchema, FANCOIN_PACKAGES } from '@fandreams/shared'
import { validateBody } from '../middleware/validation'
import { authMiddleware } from '../middleware/auth'
import * as fancoinService from '../services/fancoin.service'
import * as gamificationService from '../services/gamification.service'
import * as notificationService from '../services/notification.service'
import { db } from '../config/database'
import { users } from '@fandreams/database'
import { eq } from 'drizzle-orm'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const fancoins = new Hono()

fancoins.get('/wallet', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const wallet = await fancoinService.getWallet(userId)
  return success(c, wallet)
})

fancoins.get('/transactions', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const limit = Number(c.req.query('limit') || 50)
  const txs = await fancoinService.getTransactions(userId, limit)
  return success(c, txs)
})

fancoins.get('/packages', async (c) => {
  return success(c, FANCOIN_PACKAGES)
})

fancoins.post('/purchase', authMiddleware, validateBody(purchaseFancoinsSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const result = await fancoinService.purchaseFancoins(userId, body.packageId)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

const tipSchema = z.object({
  creatorId: z.string().uuid(),
  amount: z.number().int().positive(),
  referenceId: z.string().uuid().optional(),
})

fancoins.post('/tip', authMiddleware, validateBody(tipSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const result = await fancoinService.sendTip(userId, body.creatorId, body.amount, body.referenceId)
    await gamificationService.addXp(userId, 'tip_sent')

    // Send notification to the creator (non-blocking — tip already succeeded)
    try {
      const [sender] = await db
        .select({ username: users.username, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const senderName = sender?.displayName || sender?.username || 'Alguem'
      await notificationService.createNotification(
        body.creatorId,
        'tip_received',
        `${senderName} enviou ${body.amount} FanCoins!`,
        `@${sender?.username} enviou um tip de ${body.amount} FanCoins para voce.`,
        { fromUserId: userId, amount: body.amount, referenceId: body.referenceId },
      )
    } catch (notifErr) {
      console.error('Failed to create tip notification:', notifErr)
    }

    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default fancoins
