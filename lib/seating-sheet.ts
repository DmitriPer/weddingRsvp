import 'server-only'

/**
 * The seating list as a spreadsheet — the file handed to whoever arranges the
 * tables (PRD §6.7, a second export beside lib/spreadsheet.ts).
 *
 * DELIBERATELY NOT the import format. That one is one row per INVITATION and
 * round-trips back into the app; this one is one row per PERSON, because a
 * seating plan seats people, and "משפחת כהן · 4" cannot be split across two
 * tables by someone who does not know which four.
 *
 * One sheet, not a sheet per group. Excel's own filter only reaches the sheet
 * it is on, and the whole point of this file is that the planner slices it
 * themselves — by קשר, by צד, by תשובה — without coming back to ask.
 */

import ExcelJS from 'exceljs'
import { answerForPerson } from '@/lib/headcount'
import { strings } from '@/lib/strings'
import { RELATIONS, type InviteWithPeople, type Relation, type Side } from '@/lib/types'

const SHEET_NAME = 'סידור הושבה'
export const SEATING_EXPORT_FILENAME = 'wedding-seating.xlsx'

const COLUMNS = {
  relation: 'קשר',
  side: 'צד',
  invite: 'הזמנה',
  person: 'שם',
  kind: 'סוג',
  answer: 'תשובה',
  phone: 'טלפון',
} as const

type ColumnKey = keyof typeof COLUMNS

const COLUMN_ORDER: readonly ColumnKey[] = [
  'relation',
  'side',
  'invite',
  'person',
  'kind',
  'answer',
  'phone',
]

const WIDTHS: Record<ColumnKey, number> = {
  relation: 20,
  side: 12,
  invite: 26,
  person: 24,
  kind: 10,
  answer: 16,
  phone: 18,
}

/**
 * Group order, as the planner asked for it: משפחה, חברים, עבודה, then those
 * invited by the family — and inside each, the groom's side, the bride's, then
 * shared.
 *
 * SIDE_ORDER is spelled out rather than taken from `SIDES` in lib/types, which
 * lists the bride first. That constant orders a dropdown; this orders a
 * document someone works down the page. Changing `SIDES` to match would quietly
 * reorder every select in the admin.
 */
const SIDE_ORDER: readonly Side[] = ['groom', 'bride', 'shared']

/**
 * Alternating fills, switched at every change of INVITATION.
 *
 * One row per person means a household of four is four consecutive rows, and
 * on a printed page the boundary between one household and the next is a guess.
 * Banding by invitation makes "these three are together" something you see
 * rather than something you check in the הזמנה column.
 *
 * Excel's own two: "Blue, Accent 1" and the "Good" cell style. Each carries the
 * text colour Excel pairs it with — white on the accent blue, dark green on the
 * Good fill — because the accent is a full-strength colour, not a tint, and
 * black text on it is hard to read on paper.
 */
const BANDS = [
  { fill: 'FF4472C4', font: 'FFFFFFFF' }, // Blue, Accent 1
  { fill: 'FFC6EFCE', font: 'FF006100' }, // Good
] as const

/**
 * The תשובה cell, for the two answers that change what the planner does.
 *
 * Excel's own "Bad" and "Neutral" styles. Only these two override the row's
 * band: 'מגיעים' and 'טרם ענו' are the ordinary cases and colouring them too
 * would leave every cell shouting and none of them readable. What matters on a
 * seating list is spotting the person who is NOT coming and the household that
 * has not decided — so those two, and nothing else.
 *
 * The fill must carry its own font colour, because it lands on top of a band
 * that may have set white text (see BANDS).
 */
const ANSWER_MARKS: Partial<Record<'yes' | 'no' | 'undecided' | 'none', { fill: string; font: string }>> = {
  no: { fill: 'FFFFC7CE', font: 'FF9C0006' }, // Bad
  undecided: { fill: 'FFFFEB9C', font: 'FF9C6500' }, // Neutral
}

/** 1-based, as exceljs counts columns. */
const ANSWER_COLUMN = COLUMN_ORDER.indexOf('answer') + 1

/** Unset sorts last, rather than ahead of 'family'. */
function rank<T>(value: T | null, order: readonly T[]): number {
  return value === null ? order.length : order.indexOf(value)
}

interface PersonRow {
  /** Groups the bands. Not a column — two households can share a name. */
  inviteId: string
  /** Drives the תשובה cell's colour. Not a column; the label below is. */
  answerKey: 'yes' | 'no' | 'undecided' | 'none'
  relation: string
  side: string
  invite: string
  person: string
  kind: string
  answer: string
  phone: string
  /** Sort keys only — never written to the sheet. */
  sort: { relation: number; side: number; invite: string; placeholder: number; person: string }
}

function rowsFor(invite: InviteWithPeople): PersonRow[] {
  return invite.attendees.map((person) => ({
    inviteId: invite.id,
    relation: invite.relation ? strings.relation[invite.relation] : '',
    side: invite.side ? strings.side[invite.side] : '',
    invite: invite.name,
    // A guest-added "+1" has no name. It still needs a seat, so it still needs
    // a row — labelled, rather than left blank for the planner to puzzle over.
    person: person.is_placeholder ? strings.guests.placeholder : person.name,
    kind: person.is_child ? strings.inviteForm.child : strings.inviteForm.adult,
    /*
     * PER PERSON, not per invitation. A household can answer yes and still
     * untick someone; that person is not coming, and a seating list that says
     * otherwise sets a place for somebody who told you they would not be there.
     */
    answerKey: answerForPerson(invite.answer, person) ?? 'none',
    answer: strings.toolbar.answer[answerForPerson(invite.answer, person) ?? 'none'],
    phone: invite.phone ?? '',
    sort: {
      relation: rank(invite.relation as Relation | null, RELATIONS),
      side: rank(invite.side as Side | null, SIDE_ORDER),
      invite: invite.name,
      placeholder: person.is_placeholder ? 1 : 0,
      person: person.name,
    },
  }))
}

function compare(a: PersonRow, b: PersonRow): number {
  return (
    a.sort.relation - b.sort.relation ||
    a.sort.side - b.sort.side ||
    // Households stay together, and land in the same place every time the file
    // is regenerated — the planner may well be working from a printout.
    a.sort.invite.localeCompare(b.sort.invite, 'he') ||
    a.sort.placeholder - b.sort.placeholder ||
    a.sort.person.localeCompare(b.sort.person, 'he')
  )
}

/**
 * exceljs declares its own Buffer type and returns a Node Buffer at runtime.
 * A Node Buffer is a VIEW over a larger pooled ArrayBuffer, so handing over
 * `.buffer` directly would attach whatever else shares that pool — hence the
 * slice. See the same note in lib/spreadsheet.ts.
 */
function toArrayBuffer(written: unknown): ArrayBuffer {
  const bytes = written as Uint8Array
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function buildSeatingWorkbook(invites: InviteWithPeople[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    // Hebrew sheet, opened the way it reads. The header stays put while the
    // planner scrolls a couple of hundred rows.
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = COLUMN_ORDER.map((key) => ({
    header: COLUMNS[key],
    key,
    width: WIDTHS[key],
  }))
  sheet.getRow(1).font = { bold: true }

  /*
   * Phone as TEXT. Excel reads `0501234567` as a number and drops the leading
   * zero, and `+972…` as a formula. Same trap as the import sheet.
   */
  sheet.getColumn('phone').numFmt = '@'

  const rows = invites.flatMap(rowsFor).sort(compare)

  let band = 0
  let previousInvite: string | null = null

  for (const row of rows) {
    if (row.inviteId !== previousInvite) {
      previousInvite = row.inviteId
      band = (band + 1) % BANDS.length
    }

    const added = sheet.addRow(row)
    const { fill, font } = BANDS[band]

    // Per cell, not per row: a row-level fill in xlsx applies to the whole
    // sheet width, colouring empty columns off to the right of the data.
    for (let column = 1; column <= COLUMN_ORDER.length; column++) {
      const cell = added.getCell(column)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      cell.font = { color: { argb: font } }
    }

    const mark = ANSWER_MARKS[row.answerKey]
    if (mark) {
      const cell = added.getCell(ANSWER_COLUMN)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mark.fill } }
      cell.font = { color: { argb: mark.font }, bold: true }
    }
  }

  /*
   * Excel's own filter, on every column.
   *
   * This is what makes one sheet the right shape: the planner filters to
   * "חברים · צד כלה · מגיעים" in the file itself, without a new export and
   * without asking for one. Applied over the used range so the dropdowns cover
   * the rows that exist, not an arbitrary stretch of empty ones.
   */
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: COLUMN_ORDER.length },
  }

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}
