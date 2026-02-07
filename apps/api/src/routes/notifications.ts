import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import * as notificationService from '../services/notification.service'
import { success } from '../utils/response'

const notificationsRoute = new Hono()

notificationsRoute.get('/', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const limit = Number(c.req.query('limit') || 30)
  const notifs = await notificationService.getNotifications(userId, limit)
  return success(c, notifs)
})

notificationsRoute.get('/unread-count', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const count = await notificationService.getUnreadCount(userId)
  return success(c, { count })
})

notificationsRoute.patch('/:id/read', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const id = c.req.param('id')
  const notif = await notificationService.markAsRead(userId, id)
  return success(c, notif)
})

notificationsRoute.post('/read-all', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  await notificationService.markAllAsRead(userId)
  return success(c, { success: true })
})

export default notificationsRoute
