/**
 * Guest photo uploads — the rules (docs/wedding-photos-PRD.md). Pure: shared
 * by the upload page (browser), the public API routes and the admin screen.
 */

import type { WeddingConfig } from '@/lib/types'

/**
 * What the phone produces before anything is sent. 3200px on the long side at
 * JPEG 0.88 is ~1.5–2 MB: sharp for print, and small enough to pass through
 * our API route (serverless bodies cap near 4.5 MB) on its way to Drive.
 */
export const FULL_LONG_SIDE = 3200
export const FULL_QUALITY = 0.88

/**
 * The hard ceiling per photo. If a photo still encodes above this, the phone
 * re-encodes at lower quality (lib/image-resize.ts); the upload route refuses
 * anything larger.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Per selection. A guest with more just picks again. */
export const MAX_FILES_PER_BATCH = 50

/**
 * A GLOBAL limit, not per guest. Every guest shares one QR key, so a per-key
 * limit would throttle the whole room at once. This only stops a script: a
 * real wedding produces nowhere near 600 photos a minute.
 */
export const RATE_WINDOW_SECONDS = 60
export const MAX_PHOTOS_PER_WINDOW = 600

/** The uploader's optional name — long enough for "סבתא רחל ודוד משה". */
export const MAX_NAME_LENGTH = 60

/** Parallel uploads per phone. More gains nothing on one Wi-Fi connection. */
export const UPLOAD_CONCURRENCY = 3

export type UploadGate = 'ok' | 'invalid' | 'closed'

/**
 * Whether the upload page and API accept this key right now.
 *
 * `invalid` is checked before `closed` on purpose, and the page shows the two
 * alike in tone: a stranger with a guessed key learns nothing about whether
 * uploads happen to be open.
 */
export function uploadGate(
  config: Pick<WeddingConfig, 'photo_upload_key' | 'photo_upload_open'>,
  key: string | null | undefined
): UploadGate {
  // Before migration 017 the column doesn't exist; treat that as no key at all.
  if (!key || !config.photo_upload_key || key !== config.photo_upload_key) return 'invalid'
  return config.photo_upload_open ? 'ok' : 'closed'
}

export function isRateLimited(recentCount: number, requested: number): boolean {
  return recentCount + requested > MAX_PHOTOS_PER_WINDOW
}

/** "12.4 MB" — the admin's storage line. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A photo's name in Drive: "דנה · 17.jpg", or "17.jpg" when the guest left no
 * name (docs/wedding-photos-PRD.md §5). The number is the photo's running
 * number from the database (migration 019), so every name is unique and the
 * folder can be matched back to its row. No date: Drive shows when each file
 * was created, and the number already keeps upload order.
 *
 * Characters Windows forbids in file names are dropped, so a downloaded
 * folder unzips anywhere.
 */
export function driveFileName(uploaderName: string, photoNumber: number): string {
  const safe = uploaderName.replace(/[\\/:*?"<>|]/g, '').trim()
  return safe ? `${safe} · ${photoNumber}.jpg` : `${photoNumber}.jpg`
}
