import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseUpdateAttendee } from '@/lib/validation'
import { deleteAttendee, updateAttendee } from '@/lib/data'

type Context = { params: Promise<{ id: string }> }

/**
 * Also how a "+1" gets named: renaming clears is_placeholder (PRD §5.3), which
 * is what makes a previously anonymous guest seatable by name.
 * Assigning a table goes through here too, via table_id.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseUpdateAttendee(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const person = await updateAttendee(id, parsed.value)
    if (!person) return notFound('Person not found')
    return ok(person)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const deleted = await deleteAttendee(id)
    if (!deleted) return notFound('Person not found')
    return ok({ id })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
