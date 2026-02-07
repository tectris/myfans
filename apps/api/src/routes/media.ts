import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { success, error } from '../utils/response'
import * as storage from '../services/storage.service'
import * as mediaService from '../services/media.service'
import * as bunny from '../services/bunny.service'

const media = new Hono()

/**
 * Upload media file to R2 (images) or Bunny Stream (videos)
 * Returns the public URL as `key` for use in post creation
 */
media.post('/upload', authMiddleware, async (c) => {
  const { userId } = c.get('user')
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return error(c, 400, 'MISSING_FILE', 'Arquivo nao enviado')
  }

  const isImage = mediaService.isImageMimeType(file.type)
  const isVideo = mediaService.isVideoMimeType(file.type)

  if (!isImage && !isVideo) {
    return error(c, 400, 'INVALID_TYPE', 'Tipo de arquivo nao permitido. Use JPEG, PNG, WebP, GIF, MP4, WebM, MOV')
  }

  const maxSize = isVideo ? 500 * 1024 * 1024 : 20 * 1024 * 1024
  if (file.size > maxSize) {
    return error(c, 400, 'FILE_TOO_LARGE', `Arquivo muito grande (max ${isVideo ? '500MB' : '20MB'})`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const mediaType = isVideo ? 'video' : 'image'

  if (isImage && storage.isR2Configured()) {
    // Compress and upload to R2
    const compressed = await mediaService.compressImage(buffer, 'post')
    const key = storage.generateKey('posts/images', userId, `upload.${compressed.format}`)
    const result = await storage.uploadFile(compressed.buffer, key, compressed.contentType)

    return success(c, {
      key: result.url,
      mediaType,
      fileSize: compressed.size,
      originalSize: file.size,
      savings: `${Math.round((1 - compressed.size / file.size) * 100)}%`,
    })
  }

  if (isVideo && bunny.isBunnyConfigured()) {
    // Upload to Bunny Stream
    const video = await bunny.createVideo(`upload-${Date.now()}`)
    await bunny.uploadVideo(video.guid, buffer)

    return success(c, {
      key: bunny.getPlayUrl(video.guid),
      mediaType,
      fileSize: file.size,
      videoId: video.guid,
      status: 'encoding',
      thumbnailUrl: bunny.getThumbnailUrl(video.guid),
    })
  }

  if (isVideo && storage.isR2Configured()) {
    // Fallback: upload video to R2 raw
    const ext = file.name?.split('.').pop() || 'mp4'
    const key = storage.generateKey('posts/videos', userId, `upload.${ext}`)
    const result = await storage.uploadFile(buffer, key, file.type)

    return success(c, {
      key: result.url,
      mediaType,
      fileSize: file.size,
    })
  }

  return error(c, 503, 'STORAGE_NOT_CONFIGURED', 'Nenhum servico de storage configurado')
})

export default media
