/**
 * API route response helpers, so every route answers in the same shape and
 * routes stay four steps long: auth → validate → data → respond.
 */

import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/lib/types'

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data })
}

export function badRequest(error: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error }, { status: 400 })
}

export function unauthorized(): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

export function notFound(error = 'Not found'): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error }, { status: 404 })
}

/** The RSVP deadline has passed (PRD §6.3). Enforced here, not just in the UI. */
export function gone(error: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error }, { status: 410 })
}

export function serverError(error = 'Something went wrong'): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error }, { status: 500 })
}

/** Never let a raw driver error reach the client — it leaks schema details. */
export function fromThrown(thrown: unknown): NextResponse<ApiResponse<never>> {
  console.error('[api]', thrown)
  return serverError()
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
