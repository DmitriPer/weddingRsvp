import 'server-only'

/**
 * The guest list in the outside RSVP site's own template
 * (docs/site-export-PRD.md), so it can be uploaded there instead of retyped.
 *
 * The layout is theirs, copied from `wedding_invitations_template_he-IL.xls`:
 * sheet `הזמנות`, a row of merged group headings over a row of twelve column
 * headers, navy with white text, right-to-left. Only the first five columns are
 * filled — the app holds no address, email, landline or cheque — but all twelve
 * are written so the site finds every column where it expects it.
 *
 * ONE ROW PER PERSON COMING, not per invitation: "אלי ויעל" is two rows, אלי
 * and יעל, each counted 1 — the site seats and tracks people, and a household
 * row cannot be split there. Unnamed +1s have no name to give a row, and the
 * app does not record which person added them, so a household's +1s share one
 * extra row, "+1 של <invitation name>", counting them. The household's phone
 * goes on its first row only. Nobody coming means no rows at all.
 */

import ExcelJS from 'exceljs'
import { answerForPerson } from '@/lib/headcount'
import { toArrayBuffer } from '@/lib/spreadsheet'
import { strings } from '@/lib/strings'
import type { InviteWithPeople, Side } from '@/lib/types'

const SHEET_NAME = 'הזמנות'
/** Mirrored in components/admin/invite-table.tsx, which cannot import server-only code. */
export const SITE_EXPORT_FILENAME = 'wedding-invitations-site.xlsx'

/** Row 2, A to L, exactly as the template spells them. */
const HEADERS = [
  'הזמנה לכבוד',
  "מס' אורחים שהוזמנו",
  'צד',
  'קבוצה',
  'סלולרי',
  'טלפון רגיל',
  'אימייל',
  'עיר',
  'רחוב',
  'מיקוד',
  'תא דואר',
  "צ'ק צפוי",
] as const

/** Row 1: merged headings over their columns (1-based, inclusive). */
const GROUPS = [
  { label: 'שיוך', from: 3, to: 4 },
  { label: 'פרטי התקשרות', from: 5, to: 7 },
  { label: 'כתובת', from: 8, to: 11 },
] as const

const WIDTHS = [22, 18, 8, 18, 16, 14, 20, 14, 16, 10, 10, 10]

/** 1-based, as exceljs counts columns. */
const MOBILE_COLUMN = 5

/**
 * The site's words, not the app's: חתן / כלה where the admin says צד החתן /
 * צד הכלה, and חתן וכלה for shared — the value the site uses for both sides.
 */
const SIDE_LABELS: Record<Side, string> = { groom: 'חתן', bride: 'כלה', shared: 'חתן וכלה' }

/** The +1 row's name: "+1 של אלי ויעל", so the site shows whose guests they are. */
const plusOneOf = (inviteName: string) => `+1 של ${inviteName}`

const NAVY = 'FF1F2A6B'
const WHITE = 'FFFFFFFF'
const THIN = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

/**
 * An Israeli number in the local form the template shows: `050-1234567` for a
 * mobile, `03-1234567` for a landline. Stored numbers are international
 * (`+972…`); anything that is not Israeli is returned exactly as stored.
 */
function localPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')

  let national: string
  if (digits.startsWith('972')) national = digits.slice(3).replace(/^0+/, '')
  else if (digits.startsWith('0')) national = digits.slice(1)
  else return phone

  const local = `0${national}`
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3)}`
  if (local.length === 9) return `${local.slice(0, 2)}-${local.slice(2)}`
  return phone
}

/**
 * A household's rows: each named person coming at 1, in the order they are
 * listed, then one "+1 של <invitation name>" row for its unnamed +1s. Empty
 * when nobody is coming — see the file comment.
 *
 * "Coming" is per person (answerForPerson), the rule behind the row's
 * "X מגיעים": a household can answer yes and untick someone, and that person
 * must not reach the site.
 */
function siteRows(invite: InviteWithPeople): (string | number)[][] {
  const coming = invite.attendees.filter(
    (person) => answerForPerson(invite.answer, person) === 'yes'
  )
  const named = coming.filter((person) => !person.is_placeholder)
  const plusOnes = coming.length - named.length

  const entries: { name: string; count: number }[] = named.map((person) => ({
    name: person.name,
    count: 1,
  }))
  if (plusOnes > 0) entries.push({ name: plusOneOf(invite.name), count: plusOnes })

  const side = invite.side ? SIDE_LABELS[invite.side] : ''
  const relation = invite.relation ? strings.relation[invite.relation] : ''

  return entries.map((entry, index) => [
    entry.name,
    entry.count,
    side,
    relation,
    // Once per household, so the site does not see one number as many guests.
    index === 0 ? localPhone(invite.phone) : '',
    // Columns the app has no data for, written empty so every row is as wide
    // as the header.
    ...Array<string>(HEADERS.length - 5).fill(''),
  ])
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  cell.font = { bold: true, color: { argb: WHITE } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  cell.border = BORDER
}

/** Rows follow the order given — the invitee list's, as it was on screen. */
export async function buildSiteWorkbook(invites: InviteWithPeople[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }],
  })

  WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
  /*
   * Phone as TEXT. Excel reads `050-1234567` fine, but a number typed without
   * the dash would lose its leading zero — the same trap the other sheets note.
   */
  sheet.getColumn(MOBILE_COLUMN).numFmt = '@'

  // Row 1: the group headings. Every cell A–L is styled, merged or not, so the
  // band runs the full width as it does in the template.
  for (let column = 1; column <= HEADERS.length; column++) {
    styleHeader(sheet.getRow(1).getCell(column))
  }
  for (const group of GROUPS) {
    sheet.getRow(1).getCell(group.from).value = group.label
    sheet.mergeCells(1, group.from, 1, group.to)
  }

  const header = sheet.getRow(2)
  HEADERS.forEach((label, index) => {
    const cell = header.getCell(index + 1)
    cell.value = label
    styleHeader(cell)
  })

  for (const values of invites.flatMap(siteRows)) {
    const row = sheet.addRow(values)
    for (let column = 1; column <= HEADERS.length; column++) {
      row.getCell(column).border = BORDER
    }
  }

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}
