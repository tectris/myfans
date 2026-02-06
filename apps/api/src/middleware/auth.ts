import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export type AuthUser = {
  userId: string
  role: string
}

type AuthEnv = {
  Variables: {
    user: AuthUser
  }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')

  if (!header?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token nao fornecido' } }, 401)
  }

  const token = header.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; role: string }
    c.set('user', { userId: payload.sub, role: payload.role })
    await next()
  } catch {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token invalido ou expirado' } }, 401)
  }
})

export const adminMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Acesso restrito' } }, 403)
  }
  await next()
})

export const creatorMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'creator' && user.role !== 'admin') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Apenas criadores podem acessar' } },
      403,
    )
  }
  await next()
})
