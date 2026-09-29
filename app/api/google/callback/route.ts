import { NextResponse, type NextRequest } from 'next/server'
import { unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { getDriveConnection, saveDriveConnection } from '@/lib/data'
import { accessToken, checkFolder, createFolder, exchangeCode, OAUTH_STATE_COOKIE } from '@/lib/google-drive'
import { buildAbsoluteUrl } from '@/lib/links'

/** The Drive folder the photos go into. */
const FOLDER_NAME = 'תמונות מהחתונה'

/**
 * ADMIN — Google sends the browser back here after consent.
 *
 * Checks the admin session AND the state cookie, exchanges the code for a
 * refresh token, and makes sure the photos folder exists. A reconnect reuses
 * the existing folder when the new token can still see it, so photos don't
 * scatter across several folders.
 *
 * Always ends in a redirect to the photos tab, with `?drive=` saying how it
 * went — this is a browser navigation, not an API call.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) return unauthorized()

  const params = request.nextUrl.searchParams
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value
  const state = params.get('state')
  const code = params.get('code')

  if (params.get('error') || !code) return back('denied')
  if (!expected || !state || state !== expected) return back('failed')

  try {
    const { refreshToken, email } = await exchangeCode(code, buildAbsoluteUrl('/api/google/callback'))
    const token = await accessToken(refreshToken)

    const previous = await getDriveConnection()
    const reusable = previous ? await checkFolder(token, previous.folder_id).catch(() => false) : false
    const folderId = reusable && previous ? previous.folder_id : await createFolder(token, FOLDER_NAME)

    await saveDriveConnection({ refresh_token: refreshToken, folder_id: folderId, account_email: email })
    return back('connected')
  } catch (thrown) {
    console.error('[api] google callback:', thrown instanceof Error ? thrown.message : thrown)
    return back('failed')
  }
}

function back(result: 'connected' | 'denied' | 'failed'): NextResponse {
  const response = NextResponse.redirect(buildAbsoluteUrl(`/admin/photos?drive=${result}`))
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/google' })
  return response
}
