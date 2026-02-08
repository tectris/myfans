import { eq, desc, sql, ilike, or, and } from 'drizzle-orm'
import { users, creatorProfiles, posts } from '@fandreams/database'
import { db } from '../config/database'

export async function discoverCreators(opts: { page?: number; limit?: number; category?: string }) {
  const page = opts.page || 1
  const limit = opts.limit || 20
  const offset = (page - 1) * limit

  let query = db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      bio: users.bio,
      category: creatorProfiles.category,
      subscriptionPrice: creatorProfiles.subscriptionPrice,
      isVerified: creatorProfiles.isVerified,
      totalSubscribers: creatorProfiles.totalSubscribers,
      creatorScore: creatorProfiles.creatorScore,
      tags: creatorProfiles.tags,
    })
    .from(users)
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(and(eq(users.isActive, true), eq(users.role, 'creator')))
    .orderBy(desc(creatorProfiles.creatorScore))
    .limit(limit)
    .offset(offset)

  const creators = await query

  return creators
}

export async function getTrendingCreators(limit = 10) {
  const creators = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      category: creatorProfiles.category,
      subscriptionPrice: creatorProfiles.subscriptionPrice,
      isVerified: creatorProfiles.isVerified,
      totalSubscribers: creatorProfiles.totalSubscribers,
      creatorScore: creatorProfiles.creatorScore,
    })
    .from(users)
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.isActive, true))
    .orderBy(desc(creatorProfiles.totalSubscribers))
    .limit(limit)

  return creators
}

export async function searchCreators(query: string, limit = 20) {
  const searchTerm = `%${query}%`

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      category: creatorProfiles.category,
      isVerified: creatorProfiles.isVerified,
      totalSubscribers: creatorProfiles.totalSubscribers,
      subscriptionPrice: creatorProfiles.subscriptionPrice,
    })
    .from(users)
    .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(
      and(
        eq(users.isActive, true),
        or(ilike(users.username, searchTerm), ilike(users.displayName, searchTerm), ilike(users.bio, searchTerm)),
      ),
    )
    .limit(limit)

  return results
}

export async function searchUsers(query: string, limit = 20) {
  const searchTerm = `%${query}%`

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        or(ilike(users.username, searchTerm), ilike(users.displayName, searchTerm)),
      ),
    )
    .limit(limit)

  return results
}

export async function getCategories() {
  const result = await db
    .select({
      category: creatorProfiles.category,
      count: sql<number>`count(*)::int`,
    })
    .from(creatorProfiles)
    .innerJoin(users, eq(users.id, creatorProfiles.userId))
    .where(eq(users.isActive, true))
    .groupBy(creatorProfiles.category)
    .orderBy(sql`count(*) DESC`)

  return result.filter((r) => r.category !== null)
}
