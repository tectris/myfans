import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  EMAIL_VERIFY_SECRET: z.string().min(32).optional(),
  PASSWORD_RESET_SECRET: z.string().min(32).optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('fandreams-media'),
  R2_PUBLIC_URL: z.string().optional(),
  BUNNY_API_KEY: z.string().optional(),
  BUNNY_LIBRARY_ID: z.string().optional(),
  BUNNY_CDN_HOSTNAME: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1, 'MERCADOPAGO_WEBHOOK_SECRET is required in production').optional(),
  MERCADOPAGO_SANDBOX: z.enum(['true', 'false']).default('true'),
  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  NOWPAYMENTS_SANDBOX: z.enum(['true', 'false']).default('true'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_SANDBOX: z.enum(['true', 'false']).default('true'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('FanDreams <noreply@fandreams.app>'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(12),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

// Enforce critical secrets in production
if (parsed.data.NODE_ENV === 'production') {
  const missing: string[] = []
  if (!parsed.data.MERCADOPAGO_WEBHOOK_SECRET) missing.push('MERCADOPAGO_WEBHOOK_SECRET')
  if (!parsed.data.UPSTASH_REDIS_REST_URL) missing.push('UPSTASH_REDIS_REST_URL')
  if (!parsed.data.UPSTASH_REDIS_REST_TOKEN) missing.push('UPSTASH_REDIS_REST_TOKEN')
  if (missing.length > 0) {
    console.error(`[SECURITY] Missing required production env vars: ${missing.join(', ')}`)
    console.error('[SECURITY] These variables are required for production security.')
    process.exit(1)
  }
}

export const env = parsed.data
