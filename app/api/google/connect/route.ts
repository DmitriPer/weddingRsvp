import { NextResponse } from 'next/server'
import { fromThrown, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { authUrl, OAUTH_STATE_COOKIE } from '@/lib/google-drive'
import { buildAbsoluteUrl } from '@/lib/links'

/**
 * ADMIN — starts "חיבור ל-Google Drive" (docs/wedding-photos-PRD.md §4).
 *
 * A random `state` goes to Google and into an httpOnly cookie; the callback
 * refuses to store anything unless the two match. Without that, anyone could
 * send the admin a crafted callback link and connect THEIR Drive, collecting
 * the guests' photos.
 */
export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const state = crypto.randomUUID()
    const response = NextResponse.redirect(authUrl(buildAbsoluteUrl('/api/google/callback'), state))
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax', // must survive the top-level redirect back from Google
      secure: process.env.NODE_ENV === 'production',
      path: '/api/google',
      maxAge: 10 * 60,
    })
    return response
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
