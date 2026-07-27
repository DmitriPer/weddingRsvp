export const MOCK_SESSION_COOKIE = 'mock_admin_session'

export interface MockUser {
  id: string
  email: string
}

// encodeURIComponent/JSON instead of Buffer so this works identically in the browser,
// Node API routes, and the edge-ish proxy.ts context.
export function encodeMockSession(email: string): string {
  return encodeURIComponent(JSON.stringify({ id: 'mock-admin-user', email }))
}

export function decodeMockSession(raw: string | undefined | null): MockUser | null {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as MockUser
  } catch {
    return null
  }
}
