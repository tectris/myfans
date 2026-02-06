import { pgTable, uuid, varchar, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    recipientId: uuid('recipient_id').references(() => users.id),
    type: varchar('type', { length: 20 }).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
    platformFee: decimal('platform_fee', { precision: 10, scale: 2 }),
    creatorAmount: decimal('creator_amount', { precision: 10, scale: 2 }),
    paymentProvider: varchar('payment_provider', { length: 20 }),
    providerTxId: varchar('provider_tx_id', { length: 255 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_user_id').on(table.userId),
    index('idx_payments_recipient_id').on(table.recipientId),
    index('idx_payments_created_at').on(table.createdAt),
  ],
)

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .references(() => users.id)
    .notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
  method: varchar('method', { length: 20 }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  pixKey: varchar('pix_key', { length: 255 }),
  bankDetails: jsonb('bank_details'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type Payout = typeof payouts.$inferSelect
