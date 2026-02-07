import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import * as adminService from '../services/admin.service'
import { success, error, paginated } from '../utils/response'
import { AppError } from '../services/auth.service'

const admin = new Hono()

admin.use('*', authMiddleware, adminMiddleware)

admin.get('/dashboard', async (c) => {
  const stats = await adminService.getDashboardStats()
  return success(c, stats)
})

admin.get('/users', async (c) => {
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const search = c.req.query('search') || ''
  const result = await adminService.getUsers(page, limit, search)
  return paginated(c, result.users, { page, limit, total: result.total })
})

admin.patch('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id')
    const body = await c.req.json()
    const updated = await adminService.updateUser(userId, body)
    return success(c, updated)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default admin
