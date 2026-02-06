import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth'
import { success, error } from '../utils/response'

// In-memory media store (for testing - files lost on restart)
const mediaStore = new Map<string, { buffer: Buffer; contentType: string }>()

const media = new Hono()

media.post('/upload', authMiddleware, async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return error(c, 400, 'MISSING_FILE', 'Arquivo nao enviado')
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
  ]
  if (!allowedTypes.includes(file.type)) {
    return error(c, 400, 'INVALID_TYPE', 'Tipo de arquivo nao permitido')
  }

  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    return error(c, 400, 'FILE_TOO_LARGE', 'Arquivo muito grande (max 50MB)')
  }

  const key = randomUUID()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  mediaStore.set(key, { buffer, contentType: file.type })

  const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

  return success(c, {
    key,
    mediaType,
    fileSize: file.size,
  })
})

media.get('/:key', async (c) => {
  const key = c.req.param('key')
  const stored = mediaStore.get(key)

  if (!stored) {
    return error(c, 404, 'NOT_FOUND', 'Arquivo nao encontrado')
  }

  c.header('Content-Type', stored.contentType)
  c.header('Cache-Control', 'public, max-age=3600')
  return c.body(stored.buffer)
})

export default media
