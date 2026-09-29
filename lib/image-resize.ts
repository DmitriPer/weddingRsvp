/**
 * Shrinks a photo ON THE PHONE before upload (docs/wedding-photos-PRD.md §3).
 * Browser-only: uses createImageBitmap and a canvas.
 *
 * Why here: an original is 3–12 MB, venue Wi-Fi is slow, and the photo passes
 * through our API route on its way to Drive, where a serverless request body
 * caps near 4.5 MB. 3200px at JPEG 0.88 is ~1.5–2 MB and still prints sharp.
 *
 * Two useful side effects of drawing to a canvas:
 *   - EXIF is gone, INCLUDING GPS LOCATION. A guest's photo never carries where
 *     their home is.
 *   - Whatever came in, a JPEG comes out — the only type the route accepts.
 *
 * HEIC: iOS converts a picked photo to JPEG for a web file input, and Safari
 * decodes HEIC natively anyway. A file that still can't be decoded throws, and
 * the uploader marks that one file as "not an image" rather than failing all.
 */

import { FULL_LONG_SIDE, FULL_QUALITY, MAX_UPLOAD_BYTES } from '@/lib/photos'

/** Lower qualities to try, in order, if a photo encodes over the size cap. */
const FALLBACK_QUALITIES = [0.8, 0.7, 0.6]

export async function resizePhoto(file: File): Promise<Blob> {
  // 'from-image' applies EXIF orientation, so a portrait shot isn't sideways
  // once the EXIF (and its rotation flag) is stripped by the canvas.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    for (const quality of [FULL_QUALITY, ...FALLBACK_QUALITIES]) {
      const blob = await drawJpeg(bitmap, FULL_LONG_SIDE, quality)
      if (blob.size <= MAX_UPLOAD_BYTES) return blob
    }
    // A very detailed photo can still be too big at 0.6: halve the size once.
    const smaller = await drawJpeg(bitmap, FULL_LONG_SIDE / 2, FULL_QUALITY)
    if (smaller.size <= MAX_UPLOAD_BYTES) return smaller
    throw new Error('Photo too large after resizing')
  } finally {
    // Phones hold several 12-megapixel bitmaps badly; free each one at once.
    bitmap.close()
  }
}

/** Scales so the long side is at most `longSide` — never up. */
function fitWithin(width: number, height: number, longSide: number): { width: number; height: number } {
  const scale = Math.min(1, longSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function drawJpeg(bitmap: ImageBitmap, longSide: number, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, longSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  // Release the pixel buffer: iOS Safari caps total canvas memory, and a
  // 50-photo batch would otherwise hit it.
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not encode JPEG')
  return blob
}
