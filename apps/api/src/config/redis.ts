import { Redis } from '@upstash/redis'
import { env } from './env'

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (redis) return redis
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
  return redis
}
