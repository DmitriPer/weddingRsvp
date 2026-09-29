import 'server-only'

/**
 * Google Drive, the few calls the wedding-photos feature needs
 * (docs/wedding-photos-PRD.md). Plain fetch to Google's REST endpoints — no
 * SDK, which would be a large dependency for four requests.
 *
 * SCOPE `drive.file`: the app sees only files and folders it created itself,
 * never the rest of Dmitri's Drive. It is Google's non-sensitive Drive scope,
 * so the OAuth app can be published to production without verification —
 * which matters, because an app left in "testing" gets refresh tokens that
 * expire after 7 days, i.e. possibly mid-wedding.
 *
 * Server-only: GOOGLE_CLIENT_SECRET and every token stay on the server.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email']

/** The cookie that ties Google's callback to the admin who started the connect. */
export const OAUTH_STATE_COOKIE = 'google_oauth_state'

/** Thrown when Google no longer accepts the stored refresh token. */
export class DriveRevokedError extends Error {
  constructor() {
    super('Google Drive connection was revoked or expired')
  }
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set')
  }
  return { clientId, clientSecret }
}

export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/**
 * The consent URL. `access_type=offline` + `prompt=consent` make Google return
 * a refresh token every time — without `prompt=consent`, a reconnect after a
 * revoke would come back with no refresh token at all.
 */
export function authUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${params}`
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = await response.json().catch(() => null)
  // invalid_grant = the refresh token was revoked, expired, or the password changed.
  if (data?.error === 'invalid_grant') throw new DriveRevokedError()
  if (!response.ok || !data?.access_token) {
    throw new Error(`google token: ${data?.error ?? response.status}`)
  }
  return data as TokenResponse
}

/** Exchanges the callback's `code` for a refresh token and the account email. */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; email: string }> {
  const { clientId, clientSecret } = credentials()
  const tokens = await postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  if (!tokens.refresh_token) throw new Error('google did not return a refresh token')

  const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  const user = await info.json().catch(() => ({}))
  return { refreshToken: tokens.refresh_token, email: typeof user.email === 'string' ? user.email : '' }
}

/**
 * An access token, cached per refresh token until a minute before it expires.
 * A warm serverless instance serves a whole evening's uploads on a handful of
 * token calls; a cold one simply asks again.
 */
const cache = new Map<string, { token: string; expiresAt: number }>()

export async function accessToken(refreshToken: string): Promise<string> {
  const cached = cache.get(refreshToken)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const { clientId, clientSecret } = credentials()
  const tokens = await postToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })
  cache.set(refreshToken, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 })
  return tokens.access_token
}

async function driveError(response: Response, context: string): Promise<Error> {
  if (response.status === 401) return new DriveRevokedError()
  const data = await response.json().catch(() => null)
  return new Error(`${context}: ${data?.error?.message ?? response.status}`)
}

/** Creates the photos folder in the connected account's My Drive. */
export async function createFolder(token: string, name: string): Promise<string> {
  const response = await fetch(`${FILES_URL}?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!response.ok) throw await driveError(response, 'create folder')
  return (await response.json()).id as string
}

/**
 * One JPEG into the folder, as a single multipart request (metadata + bytes).
 * The photos are ≤ 4 MB, well inside the 5 MB multipart limit, so resumable
 * uploads aren't needed.
 */
export async function uploadJpeg(
  token: string,
  folderId: string,
  name: string,
  description: string,
  bytes: Uint8Array
): Promise<{ id: string; size: number }> {
  const boundary = `wedding-${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name, description, parents: [folderId], mimeType: 'image/jpeg' })
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`
  )
  const tail = new TextEncoder().encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)

  const response = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!response.ok) throw await driveError(response, 'upload photo')
  const file = await response.json()
  return { id: file.id as string, size: Number(file.size) || bytes.length }
}

/**
 * Whether the stored token still works — for admin's status card. A cheap
 * metadata read of the folder itself.
 */
export async function checkFolder(token: string, folderId: string): Promise<boolean> {
  const response = await fetch(`${FILES_URL}/${encodeURIComponent(folderId)}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) throw new DriveRevokedError()
  if (!response.ok) return false
  const folder = await response.json()
  return folder.trashed !== true
}

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`
}
