/**
 * The admin records a household's answer, usually after a phone call
 * (docs/admin-answer-and-calls-PRD.md §5). Same effects as the guest's own
 * answer — status, history, seats — with history marked 'admin'.
 *
 * NO deadline check, unlike /api/rsvp. The deadline stops numbers moving
 * behind the couple's back; an answer the couple took on the phone after it
 * is exactly what they need recorded.
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { getInvite, setAnswerAsAdmin } from '@/lib/data'
import { fitAdminAnswer, parseAdminAnswer } from '@/lib/validation'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseAdminAnswer(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const invite = await getInvite(id)
    if (!invite) return notFound('Invite not found')

    const fitted = fitAdminAnswer(parsed.value, invite.attendees)
    if (!fitted.ok) return badRequest(fitted.error)

    return ok(await setAnswerAsAdmin(invite, fitted.value))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
