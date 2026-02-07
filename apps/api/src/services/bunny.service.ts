import crypto from 'crypto'
import { env } from '../config/env'

const BUNNY_STREAM_API = 'https://video.bunnycdn.com/library'

function getHeaders() {
  if (!env.BUNNY_API_KEY) {
    throw new Error('BUNNY_API_KEY not configured')
  }
  return {
    'AccessKey': env.BUNNY_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

function getLibraryId(): string {
  if (!env.BUNNY_LIBRARY_ID) {
    throw new Error('BUNNY_LIBRARY_ID not configured')
  }
  return env.BUNNY_LIBRARY_ID
}

export function isBunnyConfigured(): boolean {
  return !!(env.BUNNY_API_KEY && env.BUNNY_LIBRARY_ID && env.BUNNY_CDN_HOSTNAME)
}

// ---- Video Management ----

export interface BunnyVideo {
  guid: string
  libraryId: number
  title: string
  dateUploaded: string
  views: number
  isPublic: boolean
  length: number          // duration in seconds
  status: number          // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
  storageSize: number
  encodeProgress: number  // 0-100
  width: number
  height: number
  thumbnailFileName: string
  averageWatchTime: number
  hasMP4Fallback: boolean
  availableResolutions: string  // comma-separated: "240p,360p,480p,720p,1080p"
}

export type VideoStatus = 'created' | 'uploaded' | 'processing' | 'transcoding' | 'finished' | 'error'

const STATUS_MAP: Record<number, VideoStatus> = {
  0: 'created',
  1: 'uploaded',
  2: 'processing',
  3: 'transcoding',
  4: 'finished',
  5: 'error',
}

/**
 * Create a video placeholder in Bunny Stream (step 1 of upload)
 */
export async function createVideo(title: string): Promise<BunnyVideo> {
  const libraryId = getLibraryId()
  const res = await fetch(`${BUNNY_STREAM_API}/${libraryId}/videos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bunny createVideo failed: ${res.status} ${err}`)
  }

  return res.json()
}

/**
 * Upload video binary to Bunny Stream (step 2 of upload)
 */
export async function uploadVideo(videoId: string, buffer: Buffer): Promise<{ success: boolean }> {
  const libraryId = getLibraryId()
  const res = await fetch(`${BUNNY_STREAM_API}/${libraryId}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      'AccessKey': env.BUNNY_API_KEY!,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bunny uploadVideo failed: ${res.status} ${err}`)
  }

  return { success: true }
}

/**
 * Get video details and encoding status
 */
export async function getVideo(videoId: string): Promise<BunnyVideo> {
  const libraryId = getLibraryId()
  const res = await fetch(`${BUNNY_STREAM_API}/${libraryId}/videos/${videoId}`, {
    headers: getHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bunny getVideo failed: ${res.status} ${err}`)
  }

  return res.json()
}

/**
 * Delete a video from Bunny Stream
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const libraryId = getLibraryId()
  const res = await fetch(`${BUNNY_STREAM_API}/${libraryId}/videos/${videoId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bunny deleteVideo failed: ${res.status} ${err}`)
  }
}

/**
 * List videos with pagination
 */
export async function listVideos(page = 1, perPage = 100, orderBy = 'date'): Promise<{
  totalItems: number
  currentPage: number
  itemsPerPage: number
  items: BunnyVideo[]
}> {
  const libraryId = getLibraryId()
  const res = await fetch(
    `${BUNNY_STREAM_API}/${libraryId}/videos?page=${page}&itemsPerPage=${perPage}&orderBy=${orderBy}`,
    { headers: getHeaders() },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bunny listVideos failed: ${res.status} ${err}`)
  }

  return res.json()
}

// ---- URL Generation ----

/**
 * Get HLS playlist URL for streaming
 */
export function getPlayUrl(videoId: string): string {
  return `https://${env.BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`
}

/**
 * Get MP4 direct download URL (for fallback)
 */
export function getMp4Url(videoId: string, resolution = '720p'): string {
  return `https://${env.BUNNY_CDN_HOSTNAME}/${videoId}/play_${resolution}.mp4`
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(videoId: string, fileName?: string): string {
  const thumb = fileName || 'thumbnail.jpg'
  return `https://${env.BUNNY_CDN_HOSTNAME}/${videoId}/${thumb}`
}

/**
 * Get preview/animated GIF URL
 */
export function getPreviewUrl(videoId: string): string {
  return `https://${env.BUNNY_CDN_HOSTNAME}/${videoId}/preview.webp`
}

/**
 * Generate a signed/tokenized URL for protected content
 * Prevents direct URL sharing of subscriber-only videos
 */
export function getSignedUrl(
  videoId: string,
  expiresInSeconds = 3600,
): string {
  if (!env.BUNNY_API_KEY) throw new Error('BUNNY_API_KEY required for signed URLs')

  const hostname = env.BUNNY_CDN_HOSTNAME!
  const path = `/${videoId}/playlist.m3u8`
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds

  // Bunny token authentication
  const hashableBase = env.BUNNY_API_KEY + path + expires
  const token = crypto
    .createHash('sha256')
    .update(hashableBase)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `https://${hostname}${path}?token=${token}&expires=${expires}`
}

/**
 * Format video status for API response
 */
export function formatVideoStatus(video: BunnyVideo) {
  return {
    id: video.guid,
    title: video.title,
    status: STATUS_MAP[video.status] || 'unknown',
    encodeProgress: video.encodeProgress,
    duration: video.length,
    width: video.width,
    height: video.height,
    size: video.storageSize,
    views: video.views,
    resolutions: video.availableResolutions ? video.availableResolutions.split(',') : [],
    hasMP4Fallback: video.hasMP4Fallback,
    thumbnailUrl: getThumbnailUrl(video.guid, video.thumbnailFileName),
    previewUrl: getPreviewUrl(video.guid),
    playUrl: video.status === 4 ? getPlayUrl(video.guid) : null,
    mp4Url: video.status === 4 && video.hasMP4Fallback ? getMp4Url(video.guid) : null,
    createdAt: video.dateUploaded,
  }
}
