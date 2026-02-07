import { env } from './env'

let redis: any = null
let RedisClass: any = null

async function loadRedis() {
  try {
    const mod = await import('@upstash/redis')
    RedisClass = mod.Redis
  } catch {
    console.warn('[@upstash/redis] Not available — rate limiting disabled')
  }
}

const redisReady = loadRedis()

export async function getRedis(): Promise<any> {
  await redisReady
  if (!RedisClass) return null
  if (redis) return redis
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    redis = new RedisClass({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch (err) {
    console.error('Failed to create Redis client:', err)
    return null
  }
  return redis
}
