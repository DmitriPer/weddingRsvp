/**
 * The seating list as a spreadsheet — one row per person, for whoever arranges
 * the tables. The admin's own export (../route.ts) is a different document:
 * one row per invitation, in the import format.
 *
 * POST, not GET, and it takes the ids to include.
 *
 * The toolbar's filters live in the browser — search text, status chips, answer
 * chips, side, relation, language, the two phone flags — and re-implementing
 * them here to accept them as query parameters would be a second copy of
 * lib/invite-filters, free to drift from the one the screen uses. Sending the
 * ids that are actually on screen means the file always matches what was
 * exported from, by construction.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { badRequest, fromThrown, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { listInvites } from '@/lib/data'
import { buildSeatingWorkbook, SEATING_EXPORT_FILENAME } from '@/lib/seating-sheet'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const body = await readJson(request)
    if (typeof body !== 'object' || body === null) return badRequest('Invalid request body')

    const ids = (body as { ids?: unknown }).ids
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return badRequest('ids must be a list of invitation ids')
    }
    if (ids.length === 0) return badRequest('Nothing to export')

    /*
     * Read the list and narrow it here rather than trusting the ids as a
     * query: an id that no longer exists is simply absent from the file, and
     * the order the browser happened to send is irrelevant — the sheet sorts
     * itself by group.
     */
    const wanted = new Set(ids as string[])
    const invites = (await listInvites()).filter((invite) => wanted.has(invite.id))

    const workbook = await buildSeatingWorkbook(invites)

    return new NextResponse(workbook, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${SEATING_EXPORT_FILENAME}"`,
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
