import { pgTable, uuid, varchar, bigint, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const fancoinWallets = pgTable('fancoin_wallets', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: bigint('balance', { mode: 'number' }).default(0).notNull(),
  totalEarned: bigint('total_earned', { mode: 'number' }).default(0).notNull(),
  totalSpent: bigint('total_spent', { mode: 'number' }).default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const fancoinTransactions = pgTable(
  'fancoin_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    type: varchar('type', { length: 30 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    referenceId: uuid('reference_id'),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_fancoin_tx_user_id').on(table.userId)],
)

export type FancoinWallet = typeof fancoinWallets.$inferSelect
export type FancoinTransaction = typeof fancoinTransactions.$inferSelect
