import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseCreateInvite } from '@/lib/validation'
import { createInvite, findInvitesByPhone, listInvites } from '@/lib/data'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(await listInvites())
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = parseCreateInvite(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const invite = await createInvite(parsed.value)

    // A duplicate phone is a WARNING, never a block (PRD §6.6) — two invites
    // legitimately share a number when one household has one phone.
    const duplicates = parsed.value.phone
      ? await findInvitesByPhone(parsed.value.phone, invite.id)
      : []

    return ok({ invite, duplicatePhoneWith: duplicates.map((other) => other.name) })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
