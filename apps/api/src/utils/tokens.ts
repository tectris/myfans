import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: '15m' })
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyRefreshToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string }
  } catch {
    return null
  }
}

// ── Refresh Token Blacklist (in-memory with rotation) ──

const blacklistedTokens = new Map<string, number>() // hash -> expiry timestamp

const blacklistCleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [hash, expiry] of blacklistedTokens) {
    if (now > expiry) {
      blacklistedTokens.delete(hash)
    }
  }
}, 10 * 60_000) // Cleanup every 10 minutes
if (blacklistCleanupInterval.unref) blacklistCleanupInterval.unref()

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32)
}

export function blacklistRefreshToken(token: string): void {
  const hash = hashToken(token)
  // Keep in blacklist for 7 days (refresh token TTL)
  blacklistedTokens.set(hash, Date.now() + 7 * 24 * 60 * 60 * 1000)
}

export function isRefreshTokenBlacklisted(token: string): boolean {
  const hash = hashToken(token)
  const expiry = blacklistedTokens.get(hash)
  if (!expiry) return false
  if (Date.now() > expiry) {
    blacklistedTokens.delete(hash)
    return false
  }
  return true
}
