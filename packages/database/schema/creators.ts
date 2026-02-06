import { pgTable, uuid, varchar, text, boolean, decimal, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

export const creatorProfiles = pgTable('creator_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }),
  tags: text('tags').array(),
  subscriptionPrice: decimal('subscription_price', { precision: 10, scale: 2 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationDoc: text('verification_doc'),
  payoutMethod: varchar('payout_method', { length: 20 }),
  payoutDetails: jsonb('payout_details'),
  commissionRate: decimal('commission_rate', { precision: 4, scale: 2 }).default('12.00').notNull(),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSubscribers: integer('total_subscribers').default(0).notNull(),
  creatorScore: decimal('creator_score', { precision: 5, scale: 2 }).default('0').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  welcomeMessage: text('welcome_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const subscriptionTiers = pgTable('subscription_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  benefits: jsonb('benefits'),
  badgeUrl: text('badge_url'),
  maxSlots: integer('max_slots'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type CreatorProfile = typeof creatorProfiles.$inferSelect
export type NewCreatorProfile = typeof creatorProfiles.$inferInsert
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect
export type NewSubscriptionTier = typeof subscriptionTiers.$inferInsert
