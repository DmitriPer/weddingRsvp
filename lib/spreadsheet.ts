import 'server-only'

/**
 * Reading and writing `.xlsx` (PRD §6.7). The only file-format code — it takes
 * its column names and vocabularies from lib/import-format.ts and has no
 * opinion about what the data means; that is lib/import-parse.ts.
 *
 * Why `.xlsx` and not CSV: the `אנשים` column holds comma-separated names, and
 * in CSV the comma IS the delimiter — one missing quote silently changes the
 * column count. Here a cell is a cell.
 */

import ExcelJS from 'exceljs'
import {
  COLUMNS,
  COLUMN_ORDER,
  EXAMPLE_ROW,
  LANGUAGE_OPTIONS,
  LANGUAGE_TO_SHEET,
  RELATION_OPTIONS,
  RELATION_TO_SHEET,
  SHEET_NAME,
  SIDE_OPTIONS,
  SIDE_TO_SHEET,
  joinNames,
  type ColumnKey,
} from '@/lib/import-format'
import type { InviteWithPeople } from '@/lib/types'

/**
 * exceljs declares its own Buffer type and returns a Node Buffer at runtime.
 * A Node Buffer is a VIEW over a larger pooled ArrayBuffer, so handing over
 * `.buffer` directly would attach whatever else happens to share that pool —
 * hence the slice. An ArrayBuffer is also what `new Response(body)` accepts,
 * where a `Uint8Array<ArrayBufferLike>` is not.
 */
function toArrayBuffer(written: unknown): ArrayBuffer {
  const bytes = written as Uint8Array
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** How far down the dropdowns reach, so they still work as the sheet fills. */
const VALIDATED_ROWS = 500

const WIDTHS: Record<ColumnKey, number> = {
  name: 24,
  people: 30,
  kids: 20,
  phone: 20,
  side: 12,
  relation: 20,
  language: 12,
}

function newSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    // The sheet is Hebrew: open it the way it reads. Frozen header so the
    // column names stay visible while filling 150 rows.
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = COLUMN_ORDER.map((key) => ({
    header: COLUMNS[key],
    key,
    width: WIDTHS[key],
  }))

  sheet.getRow(1).font = { bold: true }

  /*
   * Phone as TEXT, not a number.
   *
   * Excel turns `0501234567` into the number 501234567 and drops the leading
   * zero — the file then imports a phone that is wrong by one digit, silently.
   * `@` is the text format, and it also stops `+972…` being read as a formula.
   */
  const phoneIndex = COLUMN_ORDER.indexOf('phone') + 1
  sheet.getColumn(phoneIndex).numFmt = '@'

  return sheet
}

/** Inline list validation. Values must not contain commas — none of ours do. */
function dropdown(
  sheet: ExcelJS.Worksheet,
  key: ColumnKey,
  options: readonly string[]
): void {
  const column = COLUMN_ORDER.indexOf(key) + 1
  for (let row = 2; row <= VALIDATED_ROWS; row++) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'ערך לא מזוהה',
      error: `בחרו מהרשימה: ${options.join(' · ')}`,
    }
  }
}

/**
 * The empty template (PRD §6.7).
 *
 * Carries one filled example row — the shape shown rather than described — and
 * dropdowns on the three constrained columns, so the places where a typo would
 * reject a row are places that cannot be typed into freely. That is what makes
 * the importer's strict header matching reasonable.
 */
export async function buildTemplateWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = newSheet(workbook)

  sheet.addRow(EXAMPLE_ROW)

  dropdown(sheet, 'side', SIDE_OPTIONS)
  dropdown(sheet, 'relation', RELATION_OPTIONS)
  dropdown(sheet, 'language', LANGUAGE_OPTIONS)

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}

/**
 * The current list, in the template's columns — so an export can be edited and
 * re-imported, and there is one format to understand rather than two.
 *
 * Placeholders are left out: a guest-added "+1" has a generated label, and
 * re-importing it would turn an anonymous extra into a named person.
 */
export async function buildExportWorkbook(invites: InviteWithPeople[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = newSheet(workbook)

  for (const invite of invites) {
    const named = invite.attendees.filter((person) => !person.is_placeholder)
    sheet.addRow({
      name: invite.name,
      people: joinNames(named.filter((p) => !p.is_child).map((p) => p.name)),
      kids: joinNames(named.filter((p) => p.is_child).map((p) => p.name)),
      phone: invite.phone ?? '',
      side: invite.side ? SIDE_TO_SHEET[invite.side] : '',
      relation: invite.relation ? RELATION_TO_SHEET[invite.relation] : '',
      language: LANGUAGE_TO_SHEET[invite.language],
    } satisfies Record<ColumnKey, string>)
  }

  dropdown(sheet, 'side', SIDE_OPTIONS)
  dropdown(sheet, 'relation', RELATION_OPTIONS)
  dropdown(sheet, 'language', LANGUAGE_OPTIONS)

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}

/**
 * A cell as text.
 *
 * exceljs hands back whatever the file holds: a number for `123`, a rich-text
 * object for a styled cell, a formula result, a hyperlink. Everything the
 * parser sees should be a plain trimmed string.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return value.hyperlink.trim()
    }
  }
  return String(value).trim()
}

/**
 * Rows keyed by their header text.
 *
 * Headers are read from row 1 and matched by NAME, so column order and any
 * extra columns of the admin's own are harmless — an unknown header is simply
 * a key the parser never looks up.
 */
export async function readSheetRows(data: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(data)

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headers = new Map<number, string>()
  sheet.getRow(1).eachCell((cell, column) => {
    const text = cellText(cell.value)
    if (text) headers.set(column, text)
  })
  if (headers.size === 0) return []

  const rows: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: Record<string, string> = {}
    for (const [column, header] of headers) {
      record[header] = cellText(row.getCell(column).value)
    }
    rows.push(record)
  })

  return rows
}
