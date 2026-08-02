/**
 * The import's rules (PRD §6.7). Pure: plain rows in, a report out.
 *
 * It takes `Record<string, string>[]`, NOT a file — so every rule here is
 * testable without a spreadsheet, and reading `.xlsx` stays in one place
 * (lib/spreadsheet.ts) that has no opinions about what the data means.
 *
 * ERRORS REJECT A ROW; WARNINGS DO NOT. The line between them is whether the
 * result would be wrong or merely imperfect:
 *
 *   error    `שפה = rus` — importing it as Hebrew would send a Russian family
 *            a Hebrew invitation, silently. Better to reject the row.
 *   warning  a phone written `0501234567` — recoverable, and blocking the whole
 *            import over formatting would be worse than flagging it.
 */

import {
  COLUMNS,
  LANGUAGE_FROM_SHEET,
  RELATION_FROM_SHEET,
  SIDE_FROM_SHEET,
  splitNames,
} from '@/lib/import-format'
import type { Language, Relation, Side } from '@/lib/types'

/** One household, ready to write. Mirrors what createInvitesWithPeople takes. */
export interface ParsedInvite {
  /** The spreadsheet row this came from, so a fix is "go to row 12". */
  row: number
  name: string
  phone: string | null
  side: Side | null
  relation: Relation | null
  language: Language
  people: { name: string; is_child: boolean }[]
}

export interface RowProblem {
  row: number
  /** The invitation label, so a report reads as names rather than numbers. */
  name: string
  message: string
}

export interface ImportReport {
  ready: ParsedInvite[]
  errors: RowProblem[]
  warnings: RowProblem[]
  /** Rows in the file, ignoring wholly blank ones. */
  totalRows: number
  /** People across every ready row — what the caterer count would grow by. */
  totalPeople: number
}

/** Header row is 1, so the first data row is 2 — matching what Excel shows. */
const FIRST_DATA_ROW = 2

function cell(row: Record<string, string>, header: string): string {
  return (row[header] ?? '').toString().trim()
}

function isBlankRow(row: Record<string, string>): boolean {
  return Object.values(COLUMNS).every((header) => !cell(row, header))
}

/**
 * Digits only, so `+972-50-111` and `0501110000` compare as the same number.
 * Same normalisation as the admin's phone search (lib/invite-filters.ts):
 * numbers are stored international but written local.
 */
function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return digits.slice(3).replace(/^0+/, '')
  return digits.replace(/^0+/, '')
}

/**
 * @param rows          every data row, header-keyed
 * @param existingPhones phones already on invites, for the duplicate warning
 */
export function parseImportRows(
  rows: Record<string, string>[],
  existingPhones: string[] = []
): ImportReport {
  const ready: ParsedInvite[] = []
  const errors: RowProblem[] = []
  const warnings: RowProblem[] = []

  const existing = new Set(existingPhones.filter(Boolean).map(phoneKey))
  const seenInFile = new Map<string, number>()
  let totalRows = 0

  rows.forEach((raw, index) => {
    const row = index + FIRST_DATA_ROW
    if (isBlankRow(raw)) return // trailing empty rows are normal, not an error
    totalRows += 1

    const name = cell(raw, COLUMNS.name)
    const problem = (message: string) => ({ row, name: name || `שורה ${row}`, message })

    if (!name) {
      errors.push(problem(`חסר ${COLUMNS.name}`))
      return
    }

    // --- constrained columns: an unknown value rejects the row ---------------
    const sideCell = cell(raw, COLUMNS.side)
    const side = sideCell ? SIDE_FROM_SHEET[sideCell] : null
    if (sideCell && !side) {
      errors.push(problem(`${COLUMNS.side} לא מזוהה: "${sideCell}"`))
      return
    }

    const relationCell = cell(raw, COLUMNS.relation)
    const relation = relationCell ? RELATION_FROM_SHEET[relationCell] : null
    if (relationCell && !relation) {
      errors.push(problem(`${COLUMNS.relation} לא מזוהה: "${relationCell}"`))
      return
    }

    const languageCell = cell(raw, COLUMNS.language)
    const language = languageCell ? LANGUAGE_FROM_SHEET[languageCell] : 'he'
    if (languageCell && !language) {
      errors.push(problem(`${COLUMNS.language} לא מזוהה: "${languageCell}"`))
      return
    }

    // --- people --------------------------------------------------------------
    const people = [
      ...splitNames(cell(raw, COLUMNS.people)).map((person) => ({
        name: person,
        is_child: false,
      })),
      ...splitNames(cell(raw, COLUMNS.kids)).map((person) => ({
        name: person,
        is_child: true,
      })),
    ]

    // Allowed — an invitation with nobody listed is valid (PRD §8) — but almost
    // always a mistake in a spreadsheet, so it is worth saying.
    if (people.length === 0) {
      warnings.push(problem('אין אנשים בהזמנה'))
    }

    // --- phone: warnings only ------------------------------------------------
    const phone = cell(raw, COLUMNS.phone)
    if (phone) {
      if (!phone.startsWith('+')) {
        warnings.push(problem(`הטלפון אינו בפורמט בינלאומי: "${phone}"`))
      }
      const key = phoneKey(phone)
      if (key) {
        const earlier = seenInFile.get(key)
        if (earlier) {
          warnings.push(problem(`אותו טלפון מופיע גם בשורה ${earlier}`))
        } else {
          seenInFile.set(key, row)
        }
        if (existing.has(key)) {
          warnings.push(problem('הטלפון כבר קיים אצל מוזמן אחר'))
        }
      }
    }

    ready.push({
      row,
      name,
      phone: phone || null,
      side: side ?? null,
      relation: relation ?? null,
      language: language ?? 'he',
      people,
    })
  })

  return {
    ready,
    errors,
    warnings,
    totalRows,
    totalPeople: ready.reduce((sum, invite) => sum + invite.people.length, 0),
  }
}
