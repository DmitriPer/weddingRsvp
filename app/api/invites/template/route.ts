/**
 * The empty spreadsheet template (PRD §6.7).
 *
 * Downloading the format rather than reading it in documentation is what makes
 * the importer's strict header matching reasonable — the headers are always
 * right because the app wrote them, and the three constrained columns carry
 * dropdowns so they cannot be mistyped.
 */

import { NextResponse } from 'next/server'
import { fromThrown, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { TEMPLATE_FILENAME } from '@/lib/import-format'
import { buildTemplateWorkbook } from '@/lib/spreadsheet'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const workbook = await buildTemplateWorkbook()

    return new NextResponse(workbook, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${TEMPLATE_FILENAME}"`,
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
