import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import * as postService from '../services/post.service'
import { success } from '../utils/response'

const feed = new Hono()

feed.get('/', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const result = await postService.getFeed(userId, page, limit)
  return success(c, result)
})

feed.get('/public', async (c) => {
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const result = await postService.getPublicFeed(page, limit)
  return success(c, result)
})

export default feed
