import { pgTable, uuid, varchar, decimal, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { subscriptionTiers } from './creators'

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fanId: uuid('fan_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tierId: uuid('tier_id').references(() => subscriptionTiers.id),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    pricePaid: decimal('price_paid', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
    paymentProvider: varchar('payment_provider', { length: 20 }),
    providerSubId: varchar('provider_sub_id', { length: 255 }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    autoRenew: boolean('auto_renew').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('unique_fan_creator').on(table.fanId, table.creatorId),
    index('idx_subscriptions_fan_id').on(table.fanId),
    index('idx_subscriptions_creator_id').on(table.creatorId),
    index('idx_subscriptions_status').on(table.status),
  ],
)

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
