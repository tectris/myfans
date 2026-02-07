import { eq } from 'drizzle-orm'
import { users, userSettings, fancoinWallets, userGamification } from '@myfans/database'
import { db } from '../config/database'
import { hashPassword, verifyPassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokens'
import type { RegisterInput, LoginInput } from '@myfans/shared'

export async function register(input: RegisterInput) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (existing.length > 0) {
    throw new AppError('EMAIL_EXISTS', 'Este email ja esta cadastrado', 409)
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1)

  if (existingUsername.length > 0) {
    throw new AppError('USERNAME_EXISTS', 'Este username ja esta em uso', 409)
  }

  const passwordHash = await hashPassword(input.password)

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      displayName: input.displayName || input.username,
      passwordHash,
      dateOfBirth: input.dateOfBirth,
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      kycStatus: users.kycStatus,
    })

  if (!user) throw new AppError('INTERNAL', 'Erro ao criar usuario', 500)

  await Promise.all([
    db.insert(userSettings).values({ userId: user.id }),
    db.insert(fancoinWallets).values({ userId: user.id }),
    db.insert(userGamification).values({ userId: user.id }),
  ])

  const accessToken = generateAccessToken(user.id, user.role)
  const refreshToken = generateRefreshToken(user.id)

  return { user, accessToken, refreshToken }
}

export async function login(input: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 'Email ou senha incorretos', 401)
  }

  if (!user.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Conta desativada', 403)
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Email ou senha incorretos', 401)
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  const accessToken = generateAccessToken(user.id, user.role)
  const refreshToken = generateRefreshToken(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      kycStatus: user.kycStatus,
    },
    accessToken,
    refreshToken,
  }
}

export async function getMe(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      kycStatus: users.kycStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404)
  return user
}

export async function refreshTokens(token: string) {
  const payload = verifyRefreshToken(token)
  if (!payload) {
    throw new AppError('INVALID_TOKEN', 'Refresh token invalido', 401)
  }

  const [user] = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1)

  if (!user || !user.isActive) {
    throw new AppError('INVALID_TOKEN', 'Usuario nao encontrado', 401)
  }

  const accessToken = generateAccessToken(user.id, user.role)
  const newRefreshToken = generateRefreshToken(user.id)

  return { accessToken, refreshToken: newRefreshToken }
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
