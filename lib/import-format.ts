/**
 * THE spreadsheet format (PRD §6.7). One module, three consumers:
 *
 *   lib/spreadsheet.ts  writes the template and the export
 *   lib/import-parse.ts reads what comes back
 *
 * They all take the column names and vocabularies from here, and that is the
 * point. If the template wrote `שפה` while the parser looked for `לשון`, the app
 * would generate a file it then rejected — and nothing in a build would catch
 * it, because both halves would be internally consistent. Sharing one source
 * makes that impossible rather than unlikely.
 *
 * Pure data. No I/O, no exceljs.
 */

import type { Language, Relation, Side } from '@/lib/types'

/**
 * Column headers, exactly as they appear in the sheet.
 *
 * Matched by NAME, not position, so column order and extra columns don't
 * matter — someone can add a "notes" column of their own and the importer will
 * ignore it rather than misread everything after it.
 */
export const COLUMNS = {
  name: 'שם',
  people: 'אנשים',
  kids: 'ילדים',
  phone: 'טלפון',
  side: 'צד',
  relation: 'קשר',
  language: 'שפה',
} as const

export type ColumnKey = keyof typeof COLUMNS

/** Header order in generated files. Reading tolerates any order. */
export const COLUMN_ORDER: readonly ColumnKey[] = [
  'name',
  'people',
  'kids',
  'phone',
  'side',
  'relation',
  'language',
] as const

// ---------------------------------------------------------------------------
// Vocabularies
//
// Deliberately NOT the labels in lib/strings.ts. Those are admin UI text —
// `צד הכלה` reads correctly as a filter label but nobody types it into a cell.
// The sheet's vocabulary is the short form a person would actually write, and
// it is what the template's dropdowns offer.
// ---------------------------------------------------------------------------

export const SIDE_FROM_SHEET: Record<string, Side> = {
  'חתן': 'groom',
  'כלה': 'bride',
  'משותף': 'shared',
}

export const RELATION_FROM_SHEET: Record<string, Relation> = {
  'משפחה': 'family',
  'חברים': 'friend',
  'עבודה': 'work',
  'הוזמן ע״י המשפחה': 'invited_by_family',
  // The straight-quote spelling: a keyboard produces it more readily than ״,
  // and a rejected row over punctuation would be infuriating.
  'הוזמן ע"י המשפחה': 'invited_by_family',
}

/**
 * Both the codes and the Hebrew words. The dropdown offers `עברית`/`רוסית`, but
 * an exported file round-trips through the same parser and someone copying from
 * elsewhere may well write `he`.
 */
export const LANGUAGE_FROM_SHEET: Record<string, Language> = {
  'עברית': 'he',
  'רוסית': 'ru',
  he: 'he',
  ru: 'ru',
}

/** What the export writes and the dropdowns offer — the inverse of the above. */
export const SIDE_TO_SHEET: Record<Side, string> = {
  groom: 'חתן',
  bride: 'כלה',
  shared: 'משותף',
}

export const RELATION_TO_SHEET: Record<Relation, string> = {
  family: 'משפחה',
  friend: 'חברים',
  work: 'עבודה',
  invited_by_family: 'הוזמן ע״י המשפחה',
}

export const LANGUAGE_TO_SHEET: Record<Language, string> = {
  he: 'עברית',
  ru: 'רוסית',
}

/** Dropdown options, in the order the template offers them. */
export const SIDE_OPTIONS = Object.values(SIDE_TO_SHEET)
export const RELATION_OPTIONS = Object.values(RELATION_TO_SHEET)
export const LANGUAGE_OPTIONS = Object.values(LANGUAGE_TO_SHEET)

/**
 * Several names in one cell. The reason the format is `.xlsx` and not CSV:
 * here a comma is just a character.
 */
export const NAME_SEPARATOR = ','

export function splitNames(cell: string): string[] {
  return cell
    .split(NAME_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean)
}

export function joinNames(names: string[]): string {
  return names.join(`${NAME_SEPARATOR} `)
}

/** The example row in the template — the shape, shown rather than described. */
export const EXAMPLE_ROW: Record<ColumnKey, string> = {
  name: 'משפחת כהן',
  people: 'רונית, אבי',
  kids: 'מאיה',
  // Deliberately the LOCAL form: the example is how someone should actually
  // write a number, and +972 is added on import (lib/phone.ts).
  phone: '0501234567',
  side: 'כלה',
  relation: 'משפחה',
  language: 'עברית',
}

export const TEMPLATE_FILENAME = 'wedding-guests-template.xlsx'
export const EXPORT_FILENAME = 'wedding-guests.xlsx'
export const SHEET_NAME = 'מוזמנים'
