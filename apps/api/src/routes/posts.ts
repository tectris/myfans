import { Hono } from 'hono'
import { createPostSchema, updatePostSchema, createCommentSchema } from '@myfans/shared'
import { validateBody } from '../middleware/validation'
import { authMiddleware, creatorMiddleware } from '../middleware/auth'
import * as postService from '../services/post.service'
import * as gamificationService from '../services/gamification.service'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'

const postsRoute = new Hono()

postsRoute.post('/', authMiddleware, creatorMiddleware, validateBody(createPostSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const body = c.req.valid('json')
    const post = await postService.createPost(userId, body)
    return success(c, post)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

postsRoute.get('/creator/:creatorId', async (c) => {
  try {
    const creatorId = c.req.param('creatorId')
    const page = Number(c.req.query('page') || 1)
    const limit = Number(c.req.query('limit') || 20)

    let viewerId: string | undefined
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken')
        const { env } = await import('../config/env')
        const payload = jwt.default.verify(authHeader.slice(7), env.JWT_SECRET) as { sub: string }
        viewerId = payload.sub
      } catch {}
    }

    const result = await postService.getCreatorPosts(creatorId, viewerId, page, limit)
    return success(c, result)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

postsRoute.get('/:id', async (c) => {
  try {
    const postId = c.req.param('id')
    const authHeader = c.req.header('Authorization')
    let viewerId: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken')
        const { env } = await import('../config/env')
        const payload = jwt.default.verify(authHeader.slice(7), env.JWT_SECRET) as { sub: string }
        viewerId = payload.sub
      } catch {}
    }

    const post = await postService.getPost(postId, viewerId)
    return success(c, post)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

postsRoute.patch('/:id', authMiddleware, creatorMiddleware, validateBody(updatePostSchema), async (c) => {
  try {
    const { userId } = c.get('user')
    const postId = c.req.param('id')
    const body = c.req.valid('json')
    const post = await postService.updatePost(postId, userId, body)
    return success(c, post)
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

postsRoute.delete('/:id', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const postId = c.req.param('id')
    await postService.deletePost(postId, userId)
    return success(c, { deleted: true })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

postsRoute.post('/:id/like', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const postId = c.req.param('id')
  const result = await postService.likePost(postId, userId)
  if (result.liked) {
    await gamificationService.addXp(userId, 'like_post')
  }
  return success(c, result)
})

postsRoute.post('/:id/bookmark', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const postId = c.req.param('id')
  const result = await postService.bookmarkPost(postId, userId)
  return success(c, result)
})

postsRoute.get('/:id/comments', async (c) => {
  const postId = c.req.param('id')
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const comments = await postService.getComments(postId, page, limit)
  return success(c, comments)
})

postsRoute.post('/:id/comments', authMiddleware, validateBody(createCommentSchema), async (c) => {
  const { userId } = c.get('user')
  const postId = c.req.param('id')
  const body = c.req.valid('json')
  const comment = await postService.addComment(postId, userId, body.content, body.parentId)
  await gamificationService.addXp(userId, 'comment_post')
  return success(c, comment)
})

export default postsRoute
