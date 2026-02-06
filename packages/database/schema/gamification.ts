import { pgTable, uuid, varchar, text, integer, bigint, boolean, date, timestamp, primaryKey, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userGamification = pgTable('user_gamification', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: bigint('xp', { mode: 'number' }).default(0).notNull(),
  level: integer('level').default(1).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastActiveDate: date('last_active_date'),
  fanTier: varchar('fan_tier', { length: 20 }).default('bronze').notNull(),
  missionsCompleted: integer('missions_completed').default(0).notNull(),
  totalBadges: integer('total_badges').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url').notNull(),
  category: varchar('category', { length: 30 }),
  rarity: varchar('rarity', { length: 20 }).default('common').notNull(),
  xpReward: integer('xp_reward').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    badgeId: uuid('badge_id')
      .references(() => badges.id, { onDelete: 'cascade' })
      .notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.badgeId] })],
)

export const dailyMissions = pgTable('daily_missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  actionType: varchar('action_type', { length: 30 }),
  targetCount: integer('target_count').default(1).notNull(),
  xpReward: integer('xp_reward').default(10).notNull(),
  fancoinReward: integer('fancoin_reward').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userMissionProgress = pgTable(
  'user_mission_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    missionId: uuid('mission_id')
      .references(() => dailyMissions.id)
      .notNull(),
    date: date('date').defaultNow().notNull(),
    progress: integer('progress').default(0).notNull(),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [unique('unique_user_mission_date').on(table.userId, table.missionId, table.date)],
)

export const leaderboardSnapshots = pgTable(
  'leaderboard_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id').references(() => users.id),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    period: varchar('period', { length: 10 }).notNull(),
    score: bigint('score', { mode: 'number' }).default(0).notNull(),
    rank: integer('rank'),
    snapshotDate: date('snapshot_date').defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_leaderboard_period').on(table.period, table.snapshotDate, table.rank)],
)

export type UserGamification = typeof userGamification.$inferSelect
export type Badge = typeof badges.$inferSelect
export type DailyMission = typeof dailyMissions.$inferSelect
