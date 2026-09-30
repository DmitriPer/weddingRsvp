import { NextResponse, type NextRequest } from 'next/server'
import { badRequest, fromThrown, gone, ok, tooMany } from '@/lib/api'
import { attachDriveFile, countRecentPhotos, getConfig, getDriveConnection, releasePhoto, reservePhoto } from '@/lib/data'
import { accessToken, DriveRevokedError, uploadJpeg } from '@/lib/google-drive'
import { isRateLimited, MAX_NAME_LENGTH, MAX_UPLOAD_BYTES, RATE_WINDOW_SECONDS, uploadGate } from '@/lib/photos'
import { driveFileName } from '@/lib/photos'

/**
 * PUBLIC — one guest photo, into Google Drive (docs/wedding-photos-PRD.md §5).
 *
 * No session: the only gate is the QR key, plus the open switch. The phone has
 * already shrunk the photo to ≤ 4 MB JPEG (lib/image-resize.ts), so it fits a
 * serverless request body; this route passes it on to Drive with the stored
 * token, which never leaves the server.
 *
 * Statuses the page tells apart (lib/photo-upload.ts):
 *   400 bad key or bad file · 410 closed · 429 rate limit · 503 Drive not ready
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData().catch(() => null)
    if (!form) return badRequest('Invalid upload')

    const key = form.get('k')
    const gate = uploadGate(await getConfig(), typeof key === 'string' ? key : null)
    if (gate === 'invalid') return badRequest('Invalid link')
    if (gate === 'closed') return gone('Uploads are closed')

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return badRequest('No photo')
    if (file.type !== 'image/jpeg') return badRequest('Photo must be JPEG')
    if (file.size > MAX_UPLOAD_BYTES) return badRequest('Photo too large')

    if (isRateLimited(await countRecentPhotos(RATE_WINDOW_SECONDS), 1)) {
      return tooMany('Too many uploads right now — try again in a minute')
    }

    const connection = await getDriveConnection()
    if (!connection) return notReady()

    const rawName = form.get('name')
    const uploaderName = typeof rawName === 'string' ? rawName.trim().slice(0, MAX_NAME_LENGTH) : ''
    const bytes = new Uint8Array(await file.arrayBuffer())

    // The row comes FIRST: its running number is part of the Drive file name
    // ("דנה · 17.jpg"). If the upload then fails, the reservation is released
    // so the counter never counts a photo that isn't in Drive.
    const reserved = await reservePhoto(uploaderName, bytes.length)
    try {
      const driveFile = await uploadJpeg(
        await accessToken(connection.refresh_token),
        connection.folder_id,
        driveFileName(uploaderName, reserved.photo_number),
        uploaderName,
        bytes
      )
      await attachDriveFile(reserved.id, driveFile.id, driveFile.size)
    } catch (thrown) {
      await releasePhoto(reserved.id).catch(() => {})
      throw thrown
    }
    return ok({ uploaded: true })
  } catch (thrown) {
    // Admin sees "reconnect" on the photos tab; the guest sees "not ready".
    if (thrown instanceof DriveRevokedError) {
      console.error('[api] photo upload: Google Drive connection revoked')
      return notReady()
    }
    return fromThrown(thrown)
  }
}

function notReady(): NextResponse {
  return NextResponse.json({ success: false, error: 'Photo uploads are not ready' }, { status: 503 })
}
