import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseCreateAttendee } from '@/lib/validation'
import { createAttendee } from '@/lib/data'

/** Only the admin creates named people. Guests choose a count of "+1"s instead. */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = parseCreateAttendee(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    return ok(await createAttendee(parsed.value))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
