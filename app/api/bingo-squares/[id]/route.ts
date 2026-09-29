import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, notFound, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseUpdateBingoSquare } from '@/lib/validation'
import { deleteBingoSquare, updateBingoSquare } from '@/lib/data'

/** Next 16: params is a Promise and must be awaited. */
type Context = { params: Promise<{ id: string }> }

/** The editor saves one cell at a time, so most requests carry a single key. */
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const parsed = parseUpdateBingoSquare(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    const square = await updateBingoSquare(id, parsed.value)
    if (!square) return notFound('Bingo square not found')
    return ok(square)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    const { id } = await params

    const deleted = await deleteBingoSquare(id)
    if (!deleted) return notFound('Bingo square not found')
    return ok({ id })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
