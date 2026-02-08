import { pgTable, uuid, varchar, decimal, timestamp, jsonb, index, integer, boolean, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    recipientId: uuid('recipient_id').references(() => users.id),
    type: varchar('type', { length: 30 }).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
    platformFee: decimal('platform_fee', { precision: 10, scale: 2 }),
    creatorAmount: decimal('creator_amount', { precision: 10, scale: 2 }),
    paymentProvider: varchar('payment_provider', { length: 30 }),
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

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .references(() => users.id)
      .notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    fancoinAmount: integer('fancoin_amount').notNull(),
    currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
    method: varchar('method', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    pixKey: varchar('pix_key', { length: 255 }),
    bankDetails: jsonb('bank_details'),
    cryptoAddress: varchar('crypto_address', { length: 255 }),
    cryptoNetwork: varchar('crypto_network', { length: 30 }),
    // Anti-fraud
    requiresManualApproval: boolean('requires_manual_approval').default(false).notNull(),
    approvedBy: uuid('approved_by').references(() => users.id),
    rejectedReason: text('rejected_reason'),
    riskScore: integer('risk_score').default(0),
    riskFlags: jsonb('risk_flags'),
    ipAddress: varchar('ip_address', { length: 45 }),
    // Processing
    providerTxId: varchar('provider_tx_id', { length: 255 }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payouts_creator_id').on(table.creatorId),
    index('idx_payouts_status').on(table.status),
    index('idx_payouts_created_at').on(table.createdAt),
  ],
)

export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type Payout = typeof payouts.$inferSelect
export type NewPayout = typeof payouts.$inferInsert
export type PlatformSetting = typeof platformSettings.$inferSelect
