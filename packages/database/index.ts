import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as users from './schema/users'
import * as creators from './schema/creators'
import * as posts from './schema/posts'
import * as subscriptions from './schema/subscriptions'
import * as payments from './schema/payments'
import * as fancoins from './schema/fancoins'
import * as gamification from './schema/gamification'
import * as messages from './schema/messages'
import * as notifications from './schema/notifications'
import * as reports from './schema/reports'

export const schema = {
  ...users,
  ...creators,
  ...posts,
  ...subscriptions,
  ...payments,
  ...fancoins,
  ...gamification,
  ...messages,
  ...notifications,
  ...reports,
}

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export type Database = ReturnType<typeof createDb>

export * from './schema/users'
export * from './schema/creators'
export * from './schema/posts'
export * from './schema/subscriptions'
export * from './schema/payments'
export * from './schema/fancoins'
export * from './schema/gamification'
export * from './schema/messages'
export * from './schema/notifications'
export * from './schema/reports'
