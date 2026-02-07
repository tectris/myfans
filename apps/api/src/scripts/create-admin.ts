import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { users, userSettings, fancoinWallets, userGamification } from '@myfans/database'
import bcrypt from 'bcryptjs'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@myfans.com'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2024!'
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'MyFans Admin'

const sql = neon(process.env.DATABASE_URL)
const db = drizzle(sql)

async function createAdmin() {
  console.log('Creating superadmin user...')

  // Check if admin already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1)

  if (existing.length > 0) {
    console.log(`Admin user already exists (${ADMIN_EMAIL}). Updating role and KYC to admin...`)
    await db
      .update(users)
      .set({ role: 'admin', kycStatus: 'approved' })
      .where(eq(users.email, ADMIN_EMAIL))
    console.log('Admin role and KYC updated!')
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      displayName: ADMIN_DISPLAY_NAME,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      isActive: true,
      kycStatus: 'approved',
      dateOfBirth: '1990-01-01',
    })
    .returning({ id: users.id, email: users.email, username: users.username })

  if (!admin) {
    console.error('Failed to create admin user')
    process.exit(1)
  }

  // Create related records
  await Promise.all([
    db.insert(userSettings).values({ userId: admin.id }),
    db.insert(fancoinWallets).values({ userId: admin.id }),
    db.insert(userGamification).values({ userId: admin.id }),
  ])

  console.log('')
  console.log('=== Superadmin created! ===')
  console.log(`Email:    ${ADMIN_EMAIL}`)
  console.log(`Username: ${ADMIN_USERNAME}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log('')
  console.log('IMPORTANTE: Troque a senha após o primeiro login!')
  console.log('')
}

createAdmin().catch((err) => {
  console.error('Failed to create admin:', err)
  process.exit(1)
})
