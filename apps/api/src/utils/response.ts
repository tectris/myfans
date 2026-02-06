import type { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'

export function success<T>(c: Context, data: T, meta?: Record<string, unknown>) {
  return c.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function paginated<T>(
  c: Context,
  data: T[],
  opts: { page: number; limit: number; total: number },
) {
  return c.json({
    success: true,
    data,
    meta: {
      page: opts.page,
      limit: opts.limit,
      total: opts.total,
      hasMore: opts.page * opts.limit < opts.total,
    },
  })
}

export function error(
  c: Context,
  status: StatusCode,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, status)
}
