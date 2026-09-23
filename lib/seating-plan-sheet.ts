import 'server-only'

/**
 * The seating ARRANGEMENT as a spreadsheet (PRD §6.17).
 *
 * Not to be confused with lib/seating-sheet.ts, which exports the guest list
 * for someone deciding who sits together. This one is the decision: which table
 * each person ends up at, for the venue, the caterer, and whoever is putting
 * name cards on tables.
 *
 * Three columns and no more — table, person, household. A place card needs the
 * name; the household is there so "אדל" is recognisable as one of נטלי's, which
 * is how people are actually identified when two guests share a first name.
 */

import ExcelJS from 'exceljs'
import { occupancy, seatablePeople, unseated, type SeatablePerson } from '@/lib/seating'
import { strings } from '@/lib/strings'
import type { InviteWithPeople, SeatingTable } from '@/lib/types'

const SHEET_NAME = 'סידור הושבה'
export const SEATING_PLAN_FILENAME = 'wedding-seating-plan.xlsx'

const COLUMNS = { table: 'שולחן', person: 'שם', invite: 'הזמנה' } as const
type ColumnKey = keyof typeof COLUMNS
const COLUMN_ORDER: readonly ColumnKey[] = ['table', 'person', 'invite']
const WIDTHS: Record<ColumnKey, number> = { table: 22, person: 26, invite: 26 }

/** Alternating per table, so one table is one block of colour on the page. */
const BANDS = [
  { fill: 'FF4472C4', font: 'FFFFFFFF' }, // Blue, Accent 1
  { fill: 'FFC6EFCE', font: 'FF006100' }, // Good
] as const

interface PlanRow {
  table: string
  person: string
  invite: string
}

function rowFor(person: SeatablePerson, table: string): PlanRow {
  return {
    table,
    person: person.isUnnamed ? strings.guests.placeholder : person.name,
    invite: person.inviteName,
  }
}

/**
 * exceljs returns a Node Buffer, which is a VIEW over a larger pooled
 * ArrayBuffer — see the same note in lib/spreadsheet.ts.
 */
function toArrayBuffer(written: unknown): ArrayBuffer {
  const bytes = written as Uint8Array
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function buildSeatingPlanWorkbook(
  invites: InviteWithPeople[],
  tables: SeatingTable[]
): Promise<ArrayBuffer> {
  const people = seatablePeople(invites)

  /*
   * Grouped by table, tables in their own order, people alphabetical within a
   * table — the order someone reads a table's name cards, not the order the
   * seating happened to be done in.
   */
  const groups: { name: string; people: SeatablePerson[] }[] = occupancy(tables, people)
    .map((spot) => ({
      name: spot.table.name,
      people: [...spot.people].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    }))
    .filter((group) => group.people.length > 0)

  /*
   * Anyone still without a table goes LAST, under a heading, rather than being
   * left out. A seating plan that silently omits the people not yet placed is
   * how someone arrives to no chair.
   */
  const waiting = unseated(people)
  if (waiting.length > 0) {
    groups.push({
      name: strings.seating.unseated,
      people: [...waiting].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    })
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = COLUMN_ORDER.map((key) => ({ header: COLUMNS[key], key, width: WIDTHS[key] }))
  sheet.getRow(1).font = { bold: true }

  let band = 0
  let rows = 0

  for (const group of groups) {
    const { fill, font } = BANDS[band % BANDS.length]
    band += 1

    for (const person of group.people) {
      const added = sheet.addRow(rowFor(person, group.name))
      rows += 1

      // Per cell: a row-level fill in xlsx runs the whole sheet width.
      for (let column = 1; column <= COLUMN_ORDER.length; column++) {
        const cell = added.getCell(column)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
        cell.font = { color: { argb: font } }
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows + 1), column: COLUMN_ORDER.length },
  }

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}
