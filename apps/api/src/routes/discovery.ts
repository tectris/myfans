import { Hono } from 'hono'
import * as discoveryService from '../services/discovery.service'
import { success } from '../utils/response'

const discovery = new Hono()

discovery.get('/', async (c) => {
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const category = c.req.query('category')
  const creators = await discoveryService.discoverCreators({ page, limit, category: category || undefined })
  return success(c, creators)
})

discovery.get('/trending', async (c) => {
  const limit = Number(c.req.query('limit') || 10)
  const creators = await discoveryService.getTrendingCreators(limit)
  return success(c, creators)
})

discovery.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q || q.length < 2) return success(c, [])
  const results = await discoveryService.searchCreators(q)
  return success(c, results)
})

discovery.get('/categories', async (c) => {
  const categories = await discoveryService.getCategories()
  return success(c, categories)
})

export default discovery
