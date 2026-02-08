import { createDb } from '@fandreams/database'
import { env } from './env'

export const db = createDb(env.DATABASE_URL)
