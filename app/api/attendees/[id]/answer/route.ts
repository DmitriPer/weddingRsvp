/**
 * The admin sets ONE person's answer, usually after a phone call
 * (docs/admin-answer-and-calls-PRD.md §5). The household's answer is
 * recalculated from its people, status moves as for a guest's answer, and
 * history records the change as 'admin' with the person's name.
 *
 * NO deadline check, unlike /api/rsvp. The deadline stops numbers moving
 * behind the couple's back; an answer the couple took on the phone after it
 * is exactly what they need recorded.
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { setPersonAnswer } from '@/lib/data'
import { parsePersonAnswer } from '@/lib/validation'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parsePersonAnswer(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const result = await setPersonAnswer(id, parsed.value)
    if (!result) return notFound('Person not found')
    return ok(result)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
