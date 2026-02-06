import { pgTable, uuid, varchar, text, boolean, date, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['fan', 'creator', 'admin'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  displayName: varchar('display_name', { length: 100 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  bio: text('bio'),
  role: userRoleEnum('role').default('fan').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  dateOfBirth: date('date_of_birth'),
  country: varchar('country', { length: 2 }),
  language: varchar('language', { length: 5 }).default('pt-BR'),
  timezone: varchar('timezone', { length: 50 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  notificationEmail: boolean('notification_email').default(true).notNull(),
  notificationPush: boolean('notification_push').default(true).notNull(),
  notificationMessages: boolean('notification_messages').default(true).notNull(),
  privacyShowOnline: boolean('privacy_show_online').default(true).notNull(),
  privacyShowActivity: boolean('privacy_show_activity').default(true).notNull(),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  theme: varchar('theme', { length: 10 }).default('dark'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserSettings = typeof userSettings.$inferSelect
