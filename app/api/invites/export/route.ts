/**
 * The guest list as a spreadsheet (PRD §6.7).
 *
 * Same columns as the import template, so an export can be edited and
 * re-imported as a new batch — and so there is one format to understand rather
 * than two.
 */

import { NextResponse } from 'next/server'
import { fromThrown, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { listInvites } from '@/lib/data'
import { EXPORT_FILENAME } from '@/lib/import-format'
import { buildExportWorkbook } from '@/lib/spreadsheet'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const workbook = await buildExportWorkbook(await listInvites())

    return new NextResponse(workbook, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${EXPORT_FILENAME}"`,
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
