/**
 * Spreadsheet import (PRD §6.7).
 *
 * ONE ROUTE, TWO MODES, driven by a `confirm` field:
 *
 *   confirm absent  parse, validate, return the report. NOTHING is written.
 *   confirm=true    parse the SAME file again, then write.
 *
 * Uploading twice rather than having the browser post back parsed rows is
 * deliberate. A parsed-JSON round trip lets what is confirmed differ from what
 * was previewed, and needs two validation paths kept in step. Re-reading a
 * small file costs nothing and makes "what you saw is what is written" a
 * property of the design rather than a promise.
 *
 * IMPORT ADDS, NEVER UPDATES. No matching against existing rows, no upsert.
 * A bad import is cleared with multi-select delete and re-run.
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { createInvitesWithPeople, listInvites } from '@/lib/data'
import { parseImportRows } from '@/lib/import-parse'
import { readSheetRows } from '@/lib/spreadsheet'

/** A guest list is small; this only stops someone uploading a film. */
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const form = await request.formData()
    const file = form.get('file')
    const confirm = form.get('confirm') === 'true'

    if (!(file instanceof File)) return badRequest('לא נבחר קובץ')
    if (file.size === 0) return badRequest('הקובץ ריק')
    if (file.size > MAX_BYTES) return badRequest('הקובץ גדול מדי')

    const rows = await readSheetRows(await file.arrayBuffer())
    if (rows.length === 0) {
      return badRequest('לא נמצאו שורות בקובץ')
    }

    // Existing phones, for the duplicate warning. Read for the preview too, so
    // the report shown is the report acted on.
    const existing = await listInvites()
    const report = parseImportRows(
      rows,
      existing.map((invite) => invite.phone ?? '')
    )

    if (!confirm) {
      return ok({ ...report, written: false })
    }

    // Nothing to write is not an error — every row was rejected, and the report
    // already said why.
    if (report.ready.length === 0) {
      return ok({ ...report, written: false })
    }

    const result = await createInvitesWithPeople(
      report.ready.map((invite) => ({
        name: invite.name,
        phone: invite.phone,
        side: invite.side,
        relation: invite.relation,
        language: invite.language,
        people: invite.people,
      }))
    )

    return ok({ ...report, written: true, ...result })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
