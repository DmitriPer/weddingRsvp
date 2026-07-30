/**
 * Records that the admin tapped wa.me: contact_attempts + 1,
 * last_contacted_at = now, and added → pending (PRD §6.10).
 *
 * This route does NOT send anything. It cannot — the app only ever opens
 * WhatsApp with text prepared, and a human taps send there (PRD §3.1).
 *
 * Tapping the button is the only thing that marks a guest as contacted; there
 * is deliberately no separate "mark contacted" toggle.
 */

import type { NextRequest } from 'next/server'
import { fromThrown, notFound, ok, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { markContacted } from '@/lib/data'

type Context = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const invite = await markContacted(id)
    if (!invite) return notFound('Invite not found')

    return ok(invite)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
