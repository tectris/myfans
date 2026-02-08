import { createMiddleware } from 'hono/factory'

interface AuditEntry {
  timestamp: string
  method: string
  path: string
  ip: string
  userId?: string
  statusCode?: number
  duration_ms: number
}

const MAX_AUDIT_LOG_SIZE = 10_000
const auditEntries: AuditEntry[] = []

function getClientIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Audit log middleware — logs sensitive actions (auth, admin, payments, password changes).
 * Stores entries in memory and outputs to structured console logs.
 */
export const auditLog = createMiddleware(async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const ip = getClientIp(c)

  await next()

  const duration = Date.now() - start
  const statusCode = c.res.status

  // Extract userId from context if auth middleware has run
  let userId: string | undefined
  try {
    const user = c.get('user') as { userId?: string } | undefined
    userId = user?.userId
  } catch {}

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    method,
    path,
    ip,
    userId,
    statusCode,
    duration_ms: duration,
  }

  // Store in circular buffer
  if (auditEntries.length >= MAX_AUDIT_LOG_SIZE) {
    auditEntries.shift()
  }
  auditEntries.push(entry)

  // Structured log output
  const logLevel = statusCode >= 400 ? 'WARN' : 'INFO'
  console.log(
    `[AUDIT][${logLevel}] ${method} ${path} — IP:${ip} User:${userId || 'anon'} Status:${statusCode} ${duration}ms`,
  )
})

/** Get recent audit entries (for admin dashboard) */
export function getAuditEntries(limit: number = 100): AuditEntry[] {
  return auditEntries.slice(-limit)
}
