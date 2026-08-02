/**
 * Multi-select delete (PRD §6.6).
 *
 * The other half of "import adds, never updates": without it, undoing a
 * 150-row import means 150 separate deletes with 150 confirmations.
 *
 * Permanent and cascading — each invitation takes its people and its entire
 * answer history with it. The confirmation that counts PEOPLE rather than rows
 * lives in the UI, because that is where someone decides.
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { deleteInvites } from '@/lib/data'

export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const body = await readJson(request)
    if (typeof body !== 'object' || body === null) return badRequest('Invalid request body')

    const { ids } = body as { ids?: unknown }
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return badRequest('ids must be a list of invite ids')
    }
    if (ids.length === 0) return badRequest('לא נבחרו הזמנות')

    // Non-UUID ids are filtered out in the data layer rather than rejected here:
    // a stale id from a row deleted in another tab should delete the rest, not
    // fail the whole batch.
    const deleted = await deleteInvites(ids as string[])

    return ok({ deleted })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
