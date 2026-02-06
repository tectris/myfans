import { eq } from 'drizzle-orm'
import { users, userSettings, creatorProfiles, userGamification, fancoinWallets } from '@myfans/database'
import { db } from '../config/database'
import { AppError } from './auth.service'
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

export async function getPublicProfile(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)

  let creator = null
  if (user.role === 'creator') {
    const [profile] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, user.id))
      .limit(1)
    creator = profile || null
  }

  const [gamification] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, user.id))
    .limit(1)

  return { ...user, creator, gamification }
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
