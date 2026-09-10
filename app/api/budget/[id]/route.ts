import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseUpdateBudgetItem } from '@/lib/validation'
import { deleteBudgetItem, updateBudgetItem } from '@/lib/data'

/** Next 16: params is a Promise and must be awaited. */
type Context = { params: Promise<{ id: string }> }

/** The table saves one cell at a time, so most requests carry a single key. */
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseUpdateBudgetItem(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const item = await updateBudgetItem(id, parsed.value)
    if (!item) return notFound('Budget item not found')
    return ok(item)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

/** Nothing references a budget item, so this cascades to nothing. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const deleted = await deleteBudgetItem(id)
    if (!deleted) return notFound('Budget item not found')
    return ok({ id })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
