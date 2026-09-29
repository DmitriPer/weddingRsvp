import { fromThrown, ok, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { clearDriveConnection, updateConfig } from '@/lib/data'

/**
 * ADMIN — forgets the Drive connection. The folder and every photo in it stay
 * in Dmitri's Drive; only this app's access is dropped.
 *
 * Uploads are closed in the same step: with no Drive, an open switch would
 * just show guests "not ready" on every photo.
 *
 * To revoke Google's side too, Dmitri removes the app at
 * myaccount.google.com/permissions — the stored token is deleted here either way.
 */
export async function POST() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    await clearDriveConnection()
    await updateConfig({ photo_upload_open: false })
    return ok({ disconnected: true })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
