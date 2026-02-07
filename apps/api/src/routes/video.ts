import { Hono } from 'hono'
import { authMiddleware, creatorMiddleware } from '../middleware/auth'
import { success, error } from '../utils/response'
import { AppError } from '../services/auth.service'
import * as bunny from '../services/bunny.service'
import * as postService from '../services/post.service'

const videoRoute = new Hono()

// Check if Bunny is configured
videoRoute.use('*', async (c, next) => {
  if (!bunny.isBunnyConfigured()) {
    return error(c, 503, 'STREAMING_NOT_CONFIGURED', 'Servico de streaming nao configurado')
  }
  await next()
})

/**
 * Upload video to Bunny Stream
 * Flow: 1) Create video placeholder -> 2) Upload binary -> 3) Bunny encodes automatically
 * The video is linked to a post via postId
 */
videoRoute.post('/upload', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const { userId } = c.get('user')
    const body = await c.req.parseBody()
    const file = body['file']
    const title = (body['title'] as string) || 'Untitled'
    const postId = body['postId'] as string
    const isPreview = body['isPreview'] === 'true'
    const sortOrder = Number(body['sortOrder'] || 0)

    if (!file || !(file instanceof File)) {
      return error(c, 400, 'NO_FILE', 'Envie um arquivo de video')
    }

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/x-matroska']
    if (!allowedTypes.includes(file.type)) {
      return error(c, 400, 'INVALID_TYPE', 'Formato de video nao suportado. Use MP4, WebM, MOV ou MKV')
    }

    const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
    if (file.size > maxSize) {
      return error(c, 400, 'FILE_TOO_LARGE', 'Video deve ter no maximo 2GB')
    }

    // Step 1: Create video in Bunny
    const video = await bunny.createVideo(title)

    // Step 2: Upload binary
    const buffer = Buffer.from(await file.arrayBuffer())
    await bunny.uploadVideo(video.guid, buffer)

    // Step 3: Save to database if postId provided
    let mediaRecord = null
    if (postId) {
      mediaRecord = await postService.addMediaToPost(postId, {
        mediaType: 'video',
        storageKey: video.guid, // Store Bunny video GUID
        thumbnailUrl: bunny.getThumbnailUrl(video.guid),
        fileSize: file.size,
        isPreview,
        sortOrder,
      })
    }

    return success(c, {
      videoId: video.guid,
      status: 'uploaded',
      message: 'Video enviado. Encoding em andamento...',
      thumbnailUrl: bunny.getThumbnailUrl(video.guid),
      previewUrl: bunny.getPreviewUrl(video.guid),
      media: mediaRecord,
    })
  } catch (e) {
    if (e instanceof AppError) return error(c, e.status as any, e.code, e.message)
    console.error('Video upload error:', e)
    throw e
  }
})

/**
 * Check video encoding status
 * Poll this endpoint until status = 'finished'
 */
videoRoute.get('/status/:videoId', authMiddleware, async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const video = await bunny.getVideo(videoId)
    return success(c, bunny.formatVideoStatus(video))
  } catch (e) {
    console.error('Video status error:', e)
    throw e
  }
})

/**
 * Get signed/tokenized play URL for protected content
 * Used for subscriber-only videos to prevent URL sharing
 */
videoRoute.get('/play/:videoId', authMiddleware, async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const video = await bunny.getVideo(videoId)

    if (video.status !== 4) {
      return error(c, 400, 'NOT_READY', 'Video ainda esta sendo processado')
    }

    const expiresIn = Number(c.req.query('expires') || 3600)
    const signedUrl = bunny.getSignedUrl(videoId, expiresIn)

    return success(c, {
      playUrl: signedUrl,
      mp4Url: video.hasMP4Fallback ? bunny.getMp4Url(videoId) : null,
      thumbnailUrl: bunny.getThumbnailUrl(videoId, video.thumbnailFileName),
      duration: video.length,
      resolutions: video.availableResolutions ? video.availableResolutions.split(',') : [],
      expiresIn,
    })
  } catch (e) {
    console.error('Video play error:', e)
    throw e
  }
})

/**
 * Get public (unsigned) play URL - for public posts only
 */
videoRoute.get('/public/:videoId', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const video = await bunny.getVideo(videoId)

    if (video.status !== 4) {
      return error(c, 400, 'NOT_READY', 'Video ainda esta sendo processado')
    }

    return success(c, {
      playUrl: bunny.getPlayUrl(videoId),
      mp4Url: video.hasMP4Fallback ? bunny.getMp4Url(videoId) : null,
      thumbnailUrl: bunny.getThumbnailUrl(videoId, video.thumbnailFileName),
      previewUrl: bunny.getPreviewUrl(videoId),
      duration: video.length,
    })
  } catch (e) {
    console.error('Video public error:', e)
    throw e
  }
})

/**
 * Delete a video from Bunny Stream
 */
videoRoute.delete('/:videoId', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const videoId = c.req.param('videoId')
    await bunny.deleteVideo(videoId)
    return success(c, { deleted: true, videoId })
  } catch (e) {
    console.error('Video delete error:', e)
    throw e
  }
})

/**
 * List all videos (admin/creator dashboard)
 */
videoRoute.get('/list', authMiddleware, creatorMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || 1)
    const perPage = Number(c.req.query('limit') || 20)
    const result = await bunny.listVideos(page, perPage)

    return success(c, {
      videos: result.items.map(bunny.formatVideoStatus),
      total: result.totalItems,
      page: result.currentPage,
      perPage: result.itemsPerPage,
    })
  } catch (e) {
    console.error('Video list error:', e)
    throw e
  }
})

/**
 * Webhook endpoint for Bunny encoding status updates
 * Configure in Bunny Dashboard → Stream → Webhooks → URL: https://api.myfans.my/api/v1/video/webhook
 */
videoRoute.post('/webhook', async (c) => {
  try {
    const body = await c.req.json()
    const { VideoGuid, Status, VideoLibraryId } = body

    console.log(`Bunny webhook: video=${VideoGuid} status=${Status} library=${VideoLibraryId}`)

    // Status 3 = transcoding complete, 4 = finished, 5 = error
    if (Status === 4 || Status === 5) {
      const video = await bunny.getVideo(VideoGuid)
      console.log(`Video ${VideoGuid} encoding ${Status === 4 ? 'complete' : 'failed'}:`, {
        duration: video.length,
        resolutions: video.availableResolutions,
        size: video.storageSize,
      })
    }

    return c.json({ received: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return c.json({ received: false, error: 'Processing failed' }, 500)
  }
})

export default videoRoute
