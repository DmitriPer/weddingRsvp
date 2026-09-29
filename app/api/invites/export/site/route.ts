/**
 * The guest list in the outside RSVP site's template (lib/site-sheet.ts) — one
 * row per person coming (docs/site-export-PRD.md), for uploading there. The admin's own export (../route.ts)
 * is a different document: one row per invitation, in the import format.
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
import { buildSiteWorkbook, SITE_EXPORT_FILENAME } from '@/lib/site-sheet'

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
     * query: an id that no longer exists is simply absent from the file. The
     * browser's ORDER is kept, though — the sheet follows the list as it was
     * sorted on screen, and does not re-sort itself.
     */
    const byId = new Map((await listInvites()).map((invite) => [invite.id, invite]))
    const invites = (ids as string[]).flatMap((id) => {
      const invite = byId.get(id)
      return invite ? [invite] : []
    })

    const workbook = await buildSiteWorkbook(invites)

    return new NextResponse(workbook, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${SITE_EXPORT_FILENAME}"`,
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
