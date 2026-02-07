import sharp from 'sharp'

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png' | 'avif'
}

const PRESETS = {
  avatar: { maxWidth: 400, maxHeight: 400, quality: 80, format: 'webp' as const },
  cover: { maxWidth: 1920, maxHeight: 600, quality: 80, format: 'webp' as const },
  post: { maxWidth: 1920, maxHeight: 1920, quality: 82, format: 'webp' as const },
  thumbnail: { maxWidth: 480, maxHeight: 480, quality: 70, format: 'webp' as const },
  message: { maxWidth: 1280, maxHeight: 1280, quality: 80, format: 'webp' as const },
}

export type PresetName = keyof typeof PRESETS

export interface CompressedImage {
  buffer: Buffer
  width: number
  height: number
  size: number
  format: string
  contentType: string
}

export async function compressImage(
  input: Buffer,
  preset: PresetName | CompressionOptions,
): Promise<CompressedImage> {
  const opts = typeof preset === 'string' ? PRESETS[preset] : preset
  const { maxWidth = 1920, maxHeight = 1920, quality = 80, format = 'webp' } = opts

  let pipeline = sharp(input).rotate() // auto-rotate based on EXIF

  // Resize maintaining aspect ratio, only if larger than max
  pipeline = pipeline.resize(maxWidth, maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  })

  // Strip EXIF/metadata for privacy
  pipeline = pipeline.withMetadata({ orientation: undefined })

  // Apply format-specific compression
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 4 })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 8 })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality, effort: 4 })
      break
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true })

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    size: result.info.size,
    format: result.info.format,
    contentType: `image/${format}`,
  }
}

export async function generateThumbnail(input: Buffer): Promise<CompressedImage> {
  return compressImage(input, 'thumbnail')
}

export async function getImageMetadata(input: Buffer) {
  const meta = await sharp(input).metadata()
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || 'unknown',
    size: meta.size || input.length,
    hasAlpha: meta.hasAlpha || false,
  }
}

export function isImageMimeType(mime: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'].includes(mime)
}

export function isVideoMimeType(mime: string): boolean {
  return ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'].includes(mime)
}

// Max file sizes in bytes
export const MAX_FILE_SIZES = {
  avatar: 5 * 1024 * 1024,       // 5MB
  cover: 10 * 1024 * 1024,       // 10MB
  postImage: 20 * 1024 * 1024,   // 20MB
  postVideo: 500 * 1024 * 1024,  // 500MB
  message: 20 * 1024 * 1024,     // 20MB
}
