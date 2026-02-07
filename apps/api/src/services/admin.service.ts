import { eq, desc, like, or, count, sql } from 'drizzle-orm'
import { users, posts, creatorProfiles } from '@myfans/database'
import { db } from '../config/database'
import { AppError } from './auth.service'

export async function getDashboardStats() {
  const [userCount] = await db.select({ count: count() }).from(users)
  const [postCount] = await db.select({ count: count() }).from(posts)

  let totalCreators = 0
  try {
    const [creatorCount] = await db.select({ count: count() }).from(creatorProfiles)
    totalCreators = creatorCount.count
  } catch {
    // creatorProfiles table may not exist yet
  }

  const recentUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10)

  return {
    totalUsers: userCount.count,
    totalPosts: postCount.count,
    totalCreators,
    recentUsers,
  }
}

export async function getUsers(page: number, limit: number, search: string) {
  const offset = (page - 1) * limit

  const whereClause = search
    ? or(like(users.username, `%${search}%`), like(users.email, `%${search}%`))
    : undefined

  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause)

  return { users: userList, total: totalResult.count }
}

export async function updateUser(
  userId: string,
  updates: { role?: string; isActive?: boolean },
) {
  const validRoles = ['fan', 'creator', 'admin']
  if (updates.role && !validRoles.includes(updates.role)) {
    throw new AppError('INVALID_ROLE', 'Role invalido', 400)
  }

  // Protect admin users from being deactivated
  if (updates.isActive === false) {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (target?.role === 'admin') {
      throw new AppError('FORBIDDEN', 'Nao e possivel desativar um admin', 403)
    }
  }

  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.role !== undefined) setData.role = updates.role
  if (updates.isActive !== undefined) setData.isActive = updates.isActive

  const [updated] = await db
    .update(users)
    .set(setData)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
    })

  if (!updated) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)
  return updated
}

export async function deactivateUser(userId: string) {
  const [updated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id })

  if (!updated) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)
  return updated
}
