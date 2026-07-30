/**
 * The guest's submission. The ONE route with no auth — the token is the
 * credential (PRD §7.1).
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, gone, notFound, ok, readJson } from '@/lib/api'
import { parseRsvpSubmission } from '@/lib/validation'
import { getConfig, submitRsvp } from '@/lib/data'
import { isRsvpOpen } from '@/lib/datetime'

export async function POST(request: NextRequest) {
  try {
    const parsed = parseRsvpSubmission(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    // The deadline is enforced HERE, not only by disabling the form (PRD §6.3).
    // A disabled form is bypassed with one curl, and the whole point is that
    // numbers cannot move after the caterer has been committed to.
    const config = await getConfig()
    if (!isRsvpOpen(config.rsvp_deadline)) {
      return gone('RSVP has closed')
    }

    const result = await submitRsvp(parsed.value)
    if (!result) return notFound('Invalid invite link')

    return ok(result)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
