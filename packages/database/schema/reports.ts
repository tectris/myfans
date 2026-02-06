import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id')
    .references(() => users.id)
    .notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetId: uuid('target_id').notNull(),
  reason: varchar('reason', { length: 50 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const contentModerationLog = pgTable('content_moderation_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentType: varchar('content_type', { length: 20 }).notNull(),
  contentId: uuid('content_id').notNull(),
  provider: varchar('provider', { length: 20 }).notNull(),
  result: jsonb('result'),
  action: varchar('action', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Report = typeof reports.$inferSelect
