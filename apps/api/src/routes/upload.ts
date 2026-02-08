import { Hono } from 'hono'
import { authMiddleware, creatorMiddleware } from '../middleware/auth'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'
import * as storage from '../services/storage.service'
import * as media from '../services/media.service'
import * as bunny from '../services/bunny.service'
import * as postService from '../services/post.service'
import { db } from '../config/database'
import { users } from '@fandreams/database'
import { eq } from 'drizzle-orm'

const uploadRoute = new Hono()

// Check if R2 is configured
uploadRoute.use('*', async (c, next) => {
  if (!storage.isR2Configured()) {
    return error(c, 503, 'STORAGE_NOT_CONFIGURED', 'Servico de storage nao configurado')
  }
  await next()
})

// Upload avatar
uploadRoute.post('/avatar', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return error(c, 400, 'NO_FILE', 'Envie um arquivo de imagem')
    }

    if (!media.isImageMimeType(file.type)) {
      return error(c, 400, 'INVALID_TYPE', 'Apenas imagens sao aceitas (JPEG, PNG, WebP)')
    }

    if (file.size > media.MAX_FILE_SIZES.avatar) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Imagem deve ter no maximo 5MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const compressed = await media.compressImage(buffer, 'avatar')

    const key = storage.generateKey('avatars', userId, `avatar.${compressed.format}`)
    const result = await storage.uploadFile(compressed.buffer, key, compressed.contentType)

    // Update user avatar
    await db.update(users).set({ avatarUrl: result.url, updatedAt: new Date() }).where(eq(users.id, userId))

    return success(c, {
      url: result.url,
      key: result.key,
      size: result.size,
      width: compressed.width,
      height: compressed.height,
      originalSize: file.size,
      compressedSize: compressed.size,
      savings: `${Math.round((1 - compressed.size / file.size) * 100)}%`,
    })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Upload cover image
uploadRoute.post('/cover', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return error(c, 400, 'NO_FILE', 'Envie um arquivo de imagem')
    }

    if (!media.isImageMimeType(file.type)) {
      return error(c, 400, 'INVALID_TYPE', 'Apenas imagens sao aceitas')
    }

    if (file.size > media.MAX_FILE_SIZES.cover) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Imagem deve ter no maximo 10MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const compressed = await media.compressImage(buffer, 'cover')

    const key = storage.generateKey('covers', userId, `cover.${compressed.format}`)
    const result = await storage.uploadFile(compressed.buffer, key, compressed.contentType)

    // Update user cover
    await db.update(users).set({ coverUrl: result.url, updatedAt: new Date() }).where(eq(users.id, userId))

    return success(c, {
      url: result.url,
      key: result.key,
      size: result.size,
      width: compressed.width,
      height: compressed.height,
      originalSize: file.size,
      compressedSize: compressed.size,
      savings: `${Math.round((1 - compressed.size / file.size) * 100)}%`,
    })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Upload post media (images)
uploadRoute.post('/post/:postId/media', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const postId = c.req.param('postId')
    const body = await c.req.parseBody()
    const file = body['file']
    const isPreview = body['isPreview'] === 'true'
    const sortOrder = Number(body['sortOrder'] || 0)

    if (!file || !(file instanceof File)) {
      return error(c, 400, 'NO_FILE', 'Envie um arquivo')
    }

    const isImage = media.isImageMimeType(file.type)
    const isVideo = media.isVideoMimeType(file.type)

    if (!isImage && !isVideo) {
      return error(c, 400, 'INVALID_TYPE', 'Apenas imagens e videos sao aceitos')
    }

    if (isImage && file.size > media.MAX_FILE_SIZES.postImage) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Imagem deve ter no maximo 20MB')
    }

    if (isVideo && file.size > media.MAX_FILE_SIZES.postVideo) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Video deve ter no maximo 500MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let uploadResult: storage.UploadResult
    let thumbnailUrl: string | undefined
    let width: number | undefined
    let height: number | undefined

    if (isImage) {
      // Compress image
      const compressed = await media.compressImage(buffer, 'post')
      const key = storage.generateKey('posts/images', userId, `${postId}.${compressed.format}`)
      uploadResult = await storage.uploadFile(compressed.buffer, key, compressed.contentType)
      width = compressed.width
      height = compressed.height

      // Generate thumbnail
      const thumb = await media.generateThumbnail(buffer)
      const thumbKey = storage.generateKey('thumbnails', userId, `${postId}-thumb.${thumb.format}`)
      const thumbResult = await storage.uploadFile(thumb.buffer, thumbKey, thumb.contentType)
      thumbnailUrl = thumbResult.url
    } else if (bunny.isBunnyConfigured()) {
      // Video: upload to Bunny Stream for HLS encoding
      const video = await bunny.createVideo(`post-${postId}`)
      await bunny.uploadVideo(video.guid, buffer)

      // Save media record with Bunny GUID
      const mediaRecord = await postService.addMediaToPost(postId, {
        mediaType: 'video',
        storageKey: video.guid,
        thumbnailUrl: bunny.getThumbnailUrl(video.guid),
        fileSize: file.size,
        isPreview,
        sortOrder,
      })

      return success(c, {
        media: mediaRecord,
        upload: {
          videoId: video.guid,
          status: 'uploaded',
          message: 'Video enviado ao Bunny Stream. Encoding em andamento...',
          thumbnailUrl: bunny.getThumbnailUrl(video.guid),
          originalSize: file.size,
        },
      })
    } else {
      // Fallback: upload raw video to R2
      const ext = file.name?.split('.').pop() || 'mp4'
      const key = storage.generateKey('posts/videos', userId, `${postId}.${ext}`)
      uploadResult = await storage.uploadFile(buffer, key, file.type)
    }

    // Save media record
    const mediaRecord = await postService.addMediaToPost(postId, {
      mediaType: isImage ? 'image' : 'video',
      storageKey: uploadResult.url,
      thumbnailUrl,
      width,
      height,
      fileSize: uploadResult.size,
      isPreview,
      sortOrder,
    })

    return success(c, {
      media: mediaRecord,
      upload: {
        url: uploadResult.url,
        originalSize: file.size,
        compressedSize: uploadResult.size,
        savings: isImage ? `${Math.round((1 - uploadResult.size / file.size) * 100)}%` : 'N/A (video)',
      },
    })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Upload message media
uploadRoute.post('/message', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return error(c, 400, 'NO_FILE', 'Envie um arquivo')
    }

    if (!media.isImageMimeType(file.type) && !media.isVideoMimeType(file.type)) {
      return error(c, 400, 'INVALID_TYPE', 'Apenas imagens e videos sao aceitos')
    }

    if (file.size > media.MAX_FILE_SIZES.message) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Arquivo deve ter no maximo 20MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let uploadResult: storage.UploadResult

    if (media.isImageMimeType(file.type)) {
      const compressed = await media.compressImage(buffer, 'message')
      const key = storage.generateKey('messages', userId, `msg.${compressed.format}`)
      uploadResult = await storage.uploadFile(compressed.buffer, key, compressed.contentType)
    } else {
      const ext = file.name?.split('.').pop() || 'mp4'
      const key = storage.generateKey('messages', userId, `msg.${ext}`)
      uploadResult = await storage.uploadFile(buffer, key, file.type)
    }

    return success(c, {
      url: uploadResult.url,
      key: uploadResult.key,
      size: uploadResult.size,
      originalSize: file.size,
    })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

// Delete a file — ownership verified by checking userId in storage key
uploadRoute.delete('/:key{.+}', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const key = c.req.param('key')

    // Storage keys follow pattern: {folder}/{userId}/{timestamp}-{filename}
    // Verify the key belongs to this user to prevent IDOR
    const keyParts = key.split('/')
    const ownerSegment = keyParts.length >= 2 ? keyParts[keyParts.length - 2] : null
    if (ownerSegment !== userId) {
      return error(c, 403, 'FORBIDDEN', 'Voce nao tem permissao para deletar este arquivo')
    }

    await storage.deleteFile(key)
    return success(c, { deleted: true })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    throw e
  }
})

export default uploadRoute
