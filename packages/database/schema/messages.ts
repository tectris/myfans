import { pgTable, uuid, varchar, text, boolean, decimal, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participant1: uuid('participant_1')
      .references(() => users.id)
      .notNull(),
    participant2: uuid('participant_2')
      .references(() => users.id)
      .notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastMessagePreview: text('last_message_preview'),
    isLocked: boolean('is_locked').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('unique_conversation').on(table.participant1, table.participant2)],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => users.id)
      .notNull(),
    content: text('content'),
    mediaUrl: text('media_url'),
    mediaType: varchar('media_type', { length: 10 }),
    isPpv: boolean('is_ppv').default(false).notNull(),
    ppvPrice: decimal('ppv_price', { precision: 10, scale: 2 }),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_messages_conversation').on(table.conversationId)],
)

export type Conversation = typeof conversations.$inferSelect
export type Message = typeof messages.$inferSelect
