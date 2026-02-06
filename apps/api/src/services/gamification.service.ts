import { eq, sql } from 'drizzle-orm'
import { userGamification, userBadges, badges, dailyMissions, userMissionProgress } from '@myfans/database'
import { db } from '../config/database'
import { XP_REWARDS, FAN_TIERS, LEVEL_THRESHOLDS } from '@myfans/shared'
import { rewardEngagement } from './fancoin.service'

export async function getGamificationProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, userId))
    .limit(1)

  const userBadgesList = await db
    .select({
      code: badges.code,
      name: badges.name,
      description: badges.description,
      iconUrl: badges.iconUrl,
      category: badges.category,
      rarity: badges.rarity,
      earnedAt: userBadges.earnedAt,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId))

  return { ...profile, badges: userBadgesList }
}

export async function addXp(userId: string, action: keyof typeof XP_REWARDS) {
  const xpAmount = XP_REWARDS[action]

  const [profile] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, userId))
    .limit(1)

  if (!profile) return null

  const newXp = profile.xp + xpAmount
  const newLevel = calculateLevel(newXp)
  const newTier = calculateTier(newXp)

  await db
    .update(userGamification)
    .set({
      xp: newXp,
      level: newLevel,
      fanTier: newTier,
      updatedAt: new Date(),
    })
    .where(eq(userGamification.userId, userId))

  return { xp: newXp, level: newLevel, fanTier: newTier, xpGained: xpAmount }
}

export async function checkIn(userId: string) {
  const today = new Date().toISOString().split('T')[0]!

  const [profile] = await db
    .select()
    .from(userGamification)
    .where(eq(userGamification.userId, userId))
    .limit(1)

  if (!profile) return null

  if (profile.lastActiveDate === today) {
    return { alreadyCheckedIn: true, streak: profile.currentStreak }
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const isConsecutive = profile.lastActiveDate === yesterdayStr
  const newStreak = isConsecutive ? profile.currentStreak + 1 : 1
  const longestStreak = Math.max(newStreak, profile.longestStreak)

  const xpAmount = XP_REWARDS.daily_login + newStreak * XP_REWARDS.streak_bonus_per_day
  const newXp = profile.xp + xpAmount

  await db
    .update(userGamification)
    .set({
      xp: newXp,
      level: calculateLevel(newXp),
      fanTier: calculateTier(newXp),
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: today,
      updatedAt: new Date(),
    })
    .where(eq(userGamification.userId, userId))

  const coinReward = Math.min(newStreak * 5, 100)
  await rewardEngagement(userId, 'streak', coinReward)

  return { streak: newStreak, longestStreak, xpGained: xpAmount, coinsEarned: coinReward }
}

export async function getDailyMissions(userId: string) {
  const today = new Date().toISOString().split('T')[0]!

  const missions = await db.select().from(dailyMissions).where(eq(dailyMissions.isActive, true))

  const progress = await db
    .select()
    .from(userMissionProgress)
    .where(eq(userMissionProgress.userId, userId))

  const missionsWithProgress = missions.map((mission) => {
    const userProgress = progress.find(
      (p) => p.missionId === mission.id && p.date === today,
    )
    return {
      ...mission,
      progress: userProgress?.progress || 0,
      completed: userProgress?.completed || false,
    }
  })

  return missionsWithProgress
}

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]!.xpRequired) return LEVEL_THRESHOLDS[i]!.level
  }
  return 1
}

function calculateTier(xp: number): string {
  const tiers = Object.entries(FAN_TIERS).reverse()
  for (const [key, tier] of tiers) {
    if (xp >= tier.minXp) return key
  }
  return 'bronze'
}
