import { eq, and, sql, desc } from 'drizzle-orm'
import { notifications, users } from '@fandreams/database'
import { db } from '../config/database'

export async function createNotification(userId: string, type: string, title: string, body?: string, data?: Record<string, unknown>) {
  const [notif] = await db
    .insert(notifications)
    .values({ userId, type, title, body, data })
    .returning()
  return notif
}

export async function getNotifications(userId: string, limit = 30) {
  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
  return notifs
}

export async function getUnreadCount(userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
  return result?.count || 0
}

export async function markAsRead(userId: string, notificationId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()
  return updated
}

export async function markAllAsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
}
