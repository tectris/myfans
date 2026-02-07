import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { serve } from '@hono/node-server'
import { env } from './config/env'

import auth from './routes/auth'
import usersRoute from './routes/users'
import creators from './routes/creators'
import postsRoute from './routes/posts'
import subscriptionsRoute from './routes/subscriptions'
import fancoins from './routes/fancoins'
import gamification from './routes/gamification'
import discovery from './routes/discovery'
import feed from './routes/feed'
import media from './routes/media'
import kyc from './routes/kyc'
import admin from './routes/admin'

const app = new Hono().basePath('/api/v1')

function normalizeOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return trimmed
  if (/^https?:\/\//.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function buildAllowedOrigins(): string[] {
  const raw = [
    env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    ...(env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : []),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)

  // Auto-add www/non-www variants
  const withVariants = new Set(raw)
  for (const origin of raw) {
    try {
      const url = new URL(origin)
      if (url.hostname.startsWith('www.')) {
        withVariants.add(origin.replace('://www.', '://'))
      } else {
        withVariants.add(origin.replace('://', '://www.'))
      }
    } catch {}
  }

  return Array.from(withVariants)
}

const allowedOrigins = buildAllowedOrigins()
console.log('CORS allowed origins:', allowedOrigins)

app.use('*', logger())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) return origin
      console.warn(`CORS: origin "${origin}" not in allowed list`)
      return allowedOrigins[0]
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.route('/auth', auth)
app.route('/users', usersRoute)
app.route('/creators', creators)
app.route('/posts', postsRoute)
app.route('/subscriptions', subscriptionsRoute)
app.route('/fancoins', fancoins)
app.route('/gamification', gamification)
app.route('/discover', discovery)
app.route('/feed', feed)
app.route('/media', media)
app.route('/kyc', kyc)
app.route('/admin', admin)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production' ? 'Erro interno' : err.message,
      },
    },
    500,
  )
})

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Rota nao encontrada' } }, 404)
})

const port = Number(process.env.PORT) || env.PORT
console.log(`MyFans API running on 0.0.0.0:${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })

export default app
