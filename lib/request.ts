/**
 * The client side of the API contract (lib/api.ts): every route answers
 * `{ success: true, data }` or `{ success: false, error }`.
 *
 * One place that turns the second shape — and a network failure, and a body
 * that isn't JSON — into a thrown Error, so a caller has exactly one failure
 * path to handle (docs/error-loading-PRD.md §4.1). Before this, each component
 * checked `body.success` itself and several forgot the network case, which is
 * how a button got stuck on "שומר…" forever.
 *
 * Browser-safe: no server-only imports.
 */

type ApiBody<T> = { success: true; data: T } | { success: false; error?: string }

export async function requestJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  fallbackError = 'Request failed'
): Promise<T> {
  const response = await fetch(url, init)

  let body: ApiBody<T>
  try {
    body = (await response.json()) as ApiBody<T>
  } catch {
    throw new Error(fallbackError)
  }

  if (!body.success) throw new Error(body.error || fallbackError)
  return body.data
}

/** A JSON request body with the right header — the common case. */
export function jsonInit(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', payload?: unknown): RequestInit {
  return payload === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
}
