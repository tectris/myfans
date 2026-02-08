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
    console.warn('[@upstash/ratelimit] Not available — using in-memory rate limiting')
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
    prefix: config.prefix || 'fandreams_rl',
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

// ── In-Memory Rate Limiter (fallback when Redis unavailable) ──

interface MemoryBucket {
  tokens: number
  lastRefill: number
}

const memoryBuckets = new Map<string, MemoryBucket>()

// Cleanup stale buckets every 5 minutes
const memoryCleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of memoryBuckets) {
    if (now - bucket.lastRefill > 15 * 60 * 1000) {
      memoryBuckets.delete(key)
    }
  }
}, 5 * 60 * 1000)
if (memoryCleanupInterval.unref) memoryCleanupInterval.unref()

function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)\s*(ms|s|m|h|d)$/)
  if (!match) return 60_000
  const [, num, unit] = match
  const n = parseInt(num!, 10)
  switch (unit) {
    case 'ms': return n
    case 's': return n * 1000
    case 'm': return n * 60_000
    case 'h': return n * 3_600_000
    case 'd': return n * 86_400_000
    default: return 60_000
  }
}

function memoryRateLimit(identifier: string, maxRequests: number, windowMs: number): {
  success: boolean
  limit: number
  remaining: number
  reset: number
} {
  const now = Date.now()
  let bucket = memoryBuckets.get(identifier)

  if (!bucket || now - bucket.lastRefill >= windowMs) {
    bucket = { tokens: maxRequests, lastRefill: now }
    memoryBuckets.set(identifier, bucket)
  }

  const reset = bucket.lastRefill + windowMs

  if (bucket.tokens > 0) {
    bucket.tokens--
    return { success: true, limit: maxRequests, remaining: bucket.tokens, reset }
  }

  return { success: false, limit: maxRequests, remaining: 0, reset }
}

/**
 * Rate limiting middleware using Upstash Redis with in-memory fallback.
 * Never degrades to no-limit — always enforces rate limiting.
 */
export function rateLimit(config: RateLimitConfig) {
  const windowMs = parseWindowMs(config.window)

  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c)
    const identifier = `${config.prefix || 'global'}:${ip}`

    let limiter: any
    try {
      limiter = await getLimiter(config)
    } catch (err) {
      console.error('Rate limit setup error:', err)
    }

    // Try Redis-based rate limiting first
    if (limiter) {
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

        await next()
        return
      } catch (err) {
        console.error('Redis rate limit error, falling back to memory:', err)
      }
    }

    // In-memory fallback — always enforce rate limiting
    const result = memoryRateLimit(identifier, config.requests, windowMs)

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

// ── Account Lockout (brute-force protection) ──

const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>()

const lockoutCleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now > entry.lockedUntil && now - entry.firstAttempt > 60 * 60_000) {
      loginAttempts.delete(key)
    }
  }
}, 10 * 60_000)
if (lockoutCleanupInterval.unref) lockoutCleanupInterval.unref()

const LOCKOUT_THRESHOLDS = [
  { attempts: 5, lockMinutes: 5 },
  { attempts: 10, lockMinutes: 15 },
  { attempts: 20, lockMinutes: 60 },
]

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const entry = loginAttempts.get(key)

  if (!entry || now - entry.firstAttempt > 60 * 60_000) {
    loginAttempts.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 })
    return
  }

  entry.count++

  for (const threshold of LOCKOUT_THRESHOLDS) {
    if (entry.count >= threshold.attempts) {
      entry.lockedUntil = now + threshold.lockMinutes * 60_000
    }
  }
}

export function isAccountLocked(email: string): { locked: boolean; retryAfterSeconds: number } {
  const key = email.toLowerCase()
  const entry = loginAttempts.get(key)
  if (!entry) return { locked: false, retryAfterSeconds: 0 }

  const now = Date.now()
  if (entry.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) }
  }

  return { locked: false, retryAfterSeconds: 0 }
}

export function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase())
}
