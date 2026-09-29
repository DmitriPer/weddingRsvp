import { fromThrown, ok, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { regeneratePhotoKey } from '@/lib/data'

/**
 * ADMIN — a new QR key. Every printed QR code stops working; the admin screen
 * confirms that before calling this. The new key is not returned: the page
 * refreshes and draws the new QR server-side.
 */
export async function POST() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    await regeneratePhotoKey()
    return ok({ regenerated: true })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
