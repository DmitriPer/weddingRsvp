/**
 * The seating arrangement as a spreadsheet (PRD §6.17).
 *
 * A GET, unlike the guest-list export next door, because there is nothing to
 * narrow: the arrangement is the arrangement. That also means the button can be
 * a plain `<a download>` rather than a fetch and a blob.
 */

import { NextResponse } from 'next/server'
import { fromThrown, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { listInvites, listTables } from '@/lib/data'
import { buildSeatingPlanWorkbook, SEATING_PLAN_FILENAME } from '@/lib/seating-plan-sheet'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const [invites, tables] = await Promise.all([listInvites(), listTables()])
    const workbook = await buildSeatingPlanWorkbook(invites, tables)

    return new NextResponse(workbook, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${SEATING_PLAN_FILENAME}"`,
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
