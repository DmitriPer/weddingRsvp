import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseUpdateInvite } from '@/lib/validation'
import { deleteInvite, findInvitesByPhone, getInvite, updateInvite } from '@/lib/data'

/** Next 16: params is a Promise and must be awaited. */
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const invite = await getInvite(id)
    if (!invite) return notFound('Invite not found')
    return ok(invite)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseUpdateInvite(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const invite = await updateInvite(id, parsed.value)
    if (!invite) return notFound('Invite not found')

    const duplicates = invite.phone ? await findInvitesByPhone(invite.phone, invite.id) : []
    return ok({ invite, duplicatePhoneWith: duplicates.map((other) => other.name) })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

/**
 * Permanent and cascading: the invite's people and its entire history go with
 * it (PRD §6.6). The confirmation dialog lives in the UI — the database will
 * not save you.
 */
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const deleted = await deleteInvite(id)
    if (!deleted) return notFound('Invite not found')
    return ok({ id })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
