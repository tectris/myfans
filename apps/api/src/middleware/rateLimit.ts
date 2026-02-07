import { createMiddleware } from 'hono/factory'
import { getRedis } from '../config/redis'

type RateLimitConfig = {
  /** Max requests per window */
  requests: number
  /** Window duration string, e.g. "60 s", "10 m", "1 h" */
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
  /** Prefix for the rate limit key */
  prefix?: string
}

let RatelimitClass: any = null
let ratelimitLoaded = false

async function loadRatelimit() {
  if (ratelimitLoaded) return
  ratelimitLoaded = true
  try {
    const mod = await import('@upstash/ratelimit')
    RatelimitClass = mod.Ratelimit
  } catch {
    console.warn('[@upstash/ratelimit] Not available — rate limiting disabled')
  }
}

const limiters = new Map<string, any>()

async function getLimiter(config: RateLimitConfig): Promise<any> {
  await loadRatelimit()
  if (!RatelimitClass) return null

  const redis = await getRedis()
  if (!redis) return null

  const key = `${config.prefix || 'rl'}:${config.requests}:${config.window}`
  if (limiters.has(key)) return limiters.get(key)!

  const limiter = new RatelimitClass({
    redis,
    limiter: RatelimitClass.slidingWindow(config.requests, config.window),
    prefix: config.prefix || 'myfans_rl',
    analytics: true,
  })

  limiters.set(key, limiter)
  return limiter
}

function getClientIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Rate limiting middleware using Upstash Redis.
 * Gracefully degrades if Redis is not configured or packages unavailable.
 */
export function rateLimit(config: RateLimitConfig) {
  return createMiddleware(async (c, next) => {
    let limiter: any
    try {
      limiter = await getLimiter(config)
    } catch (err) {
      console.error('Rate limit setup error:', err)
    }

    // Graceful degradation: if Redis not configured, skip rate limiting
    if (!limiter) {
      await next()
      return
    }

    const ip = getClientIp(c)
    const identifier = `${config.prefix || 'global'}:${ip}`

    try {
      const result = await limiter.limit(identifier)

      c.header('X-RateLimit-Limit', String(result.limit))
      c.header('X-RateLimit-Remaining', String(result.remaining))
      c.header('X-RateLimit-Reset', String(result.reset))

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Muitas requisicoes. Tente novamente em alguns minutos.',
            },
          },
          429,
        )
      }
    } catch (err) {
      // If Redis fails, don't block the request
      console.error('Rate limit error:', err)
    }

    await next()
  })
}

/** Strict rate limit for auth endpoints (login, register) */
export const authRateLimit = rateLimit({
  requests: 10,
  window: '15 m',
  prefix: 'auth',
})

/** Moderate rate limit for general API usage */
export const apiRateLimit = rateLimit({
  requests: 100,
  window: '1 m',
  prefix: 'api',
})

/** Strict rate limit for password-sensitive operations */
export const sensitiveRateLimit = rateLimit({
  requests: 5,
  window: '15 m',
  prefix: 'sensitive',
})

/** Upload rate limit */
export const uploadRateLimit = rateLimit({
  requests: 20,
  window: '1 m',
  prefix: 'upload',
})
