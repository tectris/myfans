import { eq, and, sql } from 'drizzle-orm'
import { follows, users } from '@fandreams/database'
import { db } from '../config/database'
import { AppError } from './auth.service'

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new AppError('INVALID', 'Voce nao pode seguir a si mesmo', 400)
  }

  // Check target user exists
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followingId))
    .limit(1)
  if (!target) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  // Check if already following
  const [existing] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1)

  if (existing) {
    throw new AppError('ALREADY_FOLLOWING', 'Voce ja segue este usuario', 409)
  }

  await db.insert(follows).values({ followerId, followingId })
  return { following: true }
}

export async function unfollowUser(followerId: string, followingId: string) {
  const [deleted] = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .returning()

  if (!deleted) throw new AppError('NOT_FOUND', 'Voce nao segue este usuario', 404)
  return { following: false }
}

export async function checkFollow(followerId: string, followingId: string) {
  const [existing] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1)

  return !!existing
}

export async function getFollowerCount(userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, userId))

  return result?.count || 0
}

export async function getFollowingCount(userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, userId))

  return result?.count || 0
}
