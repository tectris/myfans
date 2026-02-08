import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { posts } from './posts'

// Track individual post views for deduplication
export const postViews = pgTable(
  'post_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_post_views_post_user').on(table.postId, table.userId),
    index('idx_post_views_post_ip').on(table.postId, table.ipAddress),
    index('idx_post_views_viewed_at').on(table.viewedAt),
  ],
)

// Track individual profile views for deduplication
export const profileViewLogs = pgTable(
  'profile_view_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileUserId: uuid('profile_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    viewerUserId: uuid('viewer_user_id').references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_profile_views_profile_viewer').on(table.profileUserId, table.viewerUserId),
    index('idx_profile_views_profile_ip').on(table.profileUserId, table.ipAddress),
    index('idx_profile_views_viewed_at').on(table.viewedAt),
  ],
)

export type PostView = typeof postViews.$inferSelect
export type ProfileViewLog = typeof profileViewLogs.$inferSelect
