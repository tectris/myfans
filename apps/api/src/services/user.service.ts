import { eq, and, gt, sql } from 'drizzle-orm'
import { users, userSettings, creatorProfiles, userGamification, fancoinWallets, follows, posts, profileViewLogs } from '@myfans/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
import { hashPassword, verifyPassword } from '../utils/password'
import type { UpdateProfileInput, UpdateSettingsInput } from '@myfans/shared'

export async function getProfile(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      bio: users.bio,
      role: users.role,
      country: users.country,
      language: users.language,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)
  return user
}

const PROFILE_VIEW_DEDUP_HOURS = 24

export async function getPublicProfile(username: string, viewerUserId?: string, ipAddress?: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      bio: users.bio,
      role: users.role,
      profileViews: users.profileViews,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  let creator = null
  // Always try to fetch creator profile (admin users can also be creators)
  const [profile] = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, user.id))
    .limit(1)
  creator = profile || null

  const [gamification] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, user.id))
    .limit(1)

  // Stats: followers, following, total posts
  const [followerCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, user.id))

  const [postCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.creatorId, user.id), eq(posts.isArchived, false), eq(posts.isVisible, true)))

  // Deduplicated profile view tracking (fire and forget)
  if (viewerUserId || ipAddress) {
    const isOwnProfile = viewerUserId === user.id
    if (!isOwnProfile) {
      const cutoff = new Date(Date.now() - PROFILE_VIEW_DEDUP_HOURS * 60 * 60 * 1000)
      const conditions = [eq(profileViewLogs.profileUserId, user.id), gt(profileViewLogs.viewedAt, cutoff)]
      if (viewerUserId) {
        conditions.push(eq(profileViewLogs.viewerUserId, viewerUserId))
      } else {
        conditions.push(eq(profileViewLogs.ipAddress, ipAddress!))
      }

      db.select({ id: profileViewLogs.id })
        .from(profileViewLogs)
        .where(and(...conditions))
        .limit(1)
        .then(([existing]) => {
          if (!existing) {
            return Promise.all([
              db.insert(profileViewLogs).values({
                profileUserId: user.id,
                viewerUserId: viewerUserId || null,
                ipAddress: ipAddress || null,
              }),
              db.update(users)
                .set({ profileViews: sql`${users.profileViews} + 1` })
                .where(eq(users.id, user.id)),
            ])
          }
        })
        .catch(() => {})
    }
  }

  return {
    ...user,
    creator,
    gamification,
    followerCount: followerCount?.count || 0,
    postCount: postCount?.count || 0,
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const [updated] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      country: users.country,
      language: users.language,
    })

  if (!updated) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)
  return updated
}

export async function getSettings(userId: string) {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  return settings
}

export async function updateSettings(userId: string, input: UpdateSettingsInput) {
  const [updated] = await db
    .update(userSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning()

  return updated
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  const valid = await verifyPassword(currentPassword, user.passwordHash)
  if (!valid) throw new AppError('INVALID_PASSWORD', 'Senha atual incorreta', 400)

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId))
  return { changed: true }
}

export async function getDashboardData(userId: string) {
  const [wallet] = await db
    .select()
    .from(fancoinWallets)
    .where(eq(fancoinWallets.userId, userId))
    .limit(1)

  const [gamification] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, userId))
    .limit(1)

  return { wallet, gamification }
}
