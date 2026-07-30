import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseUpdateTable } from '@/lib/validation'
import { deleteTable, updateTable } from '@/lib/data'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseUpdateTable(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const table = await updateTable(id, parsed.value)
    if (!table) return notFound('Table not found')
    return ok(table)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

/** attendees.table_id is ON DELETE SET NULL: people are unseated, not deleted. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const deleted = await deleteTable(id)
    if (!deleted) return notFound('Table not found')
    return ok({ id })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
