/**
 * Records that the admin tapped wa.me: contact_attempts + 1,
 * last_contacted_at = now, and added → pending (PRD §6.10).
 *
 * This route does NOT send anything. It cannot — the app only ever opens
 * WhatsApp with text prepared, and a human taps send there (PRD §3.1).
 *
 * Tapping the button is the only thing that marks a guest as contacted; there
 * is deliberately no separate "mark contacted" toggle.
 *
 * The body names which template was sent (lib/send-kinds.ts), and THIS route
 * decides what that records: an invitation or reminder counts as an attempt,
 * a day-of or thank-you message only moves last_contacted_at. No body, or an
 * unknown name, is an invitation — what this route did before kinds existed.
 */

import type { NextRequest } from 'next/server'
import { fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { markContacted } from '@/lib/data'
import { countsAsAttempt, parseSendKind } from '@/lib/send-kinds'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const body = await readJson(request)
    const kind = parseSendKind(
      typeof body === 'object' && body !== null ? (body as { template?: unknown }).template : undefined
    )

    const invite = await markContacted(id, { countAttempt: countsAsAttempt(kind) })
    if (!invite) return notFound('Invite not found')

    return ok(invite)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
