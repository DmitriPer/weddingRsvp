/**
 * Who can be seated, and how full each table is (PRD §6.17). Pure — invites and
 * tables in, a board out. The component holds the interaction; the rules live
 * here, like lib/invite-filters.ts for the invitee list.
 */

import { answerForPerson } from '@/lib/headcount'
import {
  TABLE_SEATS,
  type InviteWithPeople,
  type SeatingTable,
  type TableShape,
} from '@/lib/types'

/**
 * A person as the seating board needs them: their own name, their household's,
 * and whether their seat is certain.
 *
 * Flattened out of the invitation on purpose. Seating is the one screen that
 * works in people rather than households — the list is sorted, filtered and
 * searched by person — and carrying the invitation around as a parent object
 * would mean every consumer re-deriving the same four fields.
 */
export interface SeatablePerson {
  id: string
  name: string
  /** The invitation they belong to, so a household can still be recognised. */
  inviteName: string
  isChild: boolean
  /** A guest-added "+1" with no name yet. The board labels them. */
  isUnnamed: boolean
  /** 'yes' is coming; 'undecided' has answered but cannot say yet. */
  certainty: 'yes' | 'undecided'
  tableId: string | null
}

/**
 * Everyone who gets a chair.
 *
 * Per person, not per invitation: a household that answered yes can leave
 * someone out, and that person is not seated (lib/headcount.ts).
 *
 * UNDECIDED PEOPLE ARE INCLUDED, which the PRD's "only attending people are
 * seatable" did not anticipate — the third answer came later. A table has to be
 * planned before everyone replies, and leaving them off the board would mean
 * discovering them at the end with nowhere to put them. They are marked, so a
 * full table made partly of maybes is visible rather than a surprise.
 */
export function seatablePeople(invites: InviteWithPeople[]): SeatablePerson[] {
  const people: SeatablePerson[] = []

  for (const invite of invites) {
    for (const person of invite.attendees) {
      const answer = answerForPerson(invite.answer, person)
      if (answer !== 'yes' && answer !== 'undecided') continue

      people.push({
        id: person.id,
        name: person.name,
        inviteName: invite.name,
        isChild: person.is_child,
        isUnnamed: person.is_placeholder,
        certainty: answer,
        tableId: person.table_id ?? null,
      })
    }
  }

  return people.sort(byHousehold)
}

/** Households stay together in the unseated list, so they can be seated together. */
function byHousehold(a: SeatablePerson, b: SeatablePerson): number {
  return (
    a.inviteName.localeCompare(b.inviteName, 'he') || a.name.localeCompare(b.name, 'he')
  )
}

export interface TableOccupancy {
  table: SeatingTable
  people: SeatablePerson[]
  seated: number
  /** Of those seated, how many have not actually confirmed. */
  undecided: number
  /** More people than chairs. A warning, never a block — see migration 011. */
  over: boolean
  /** Capacity the shape expects. Exceeding it is the admin's call, not an error. */
  suggested: number
}

export function occupancy(
  tables: SeatingTable[],
  people: SeatablePerson[]
): TableOccupancy[] {
  return tables.map((table) => {
    const seated = people.filter((person) => person.tableId === table.id)
    return {
      table,
      people: seated,
      seated: seated.length,
      undecided: seated.filter((person) => person.certainty === 'undecided').length,
      over: seated.length > table.capacity,
      suggested: TABLE_SEATS[table.shape].max,
    }
  })
}

export function unseated(people: SeatablePerson[]): SeatablePerson[] {
  return people.filter((person) => person.tableId === null)
}

/** Matches a person's own name or their household's, like the invitee search. */
export function searchPeople(people: SeatablePerson[], query: string): SeatablePerson[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return people
  return people.filter(
    (person) =>
      person.name.toLowerCase().includes(needle) ||
      person.inviteName.toLowerCase().includes(needle)
  )
}

/** How full a table is. `over` is kept apart from `full` so it can be found. */
export const FULLNESS = ['empty', 'room', 'full', 'over'] as const
export type Fullness = (typeof FULLNESS)[number]

export function fullness(spot: TableOccupancy): Fullness {
  if (spot.seated === 0) return 'empty'
  if (spot.seated < spot.table.capacity) return 'room'
  if (spot.seated === spot.table.capacity) return 'full'
  return 'over'
}

/** The board's card filters. An empty string means "any". */
export interface TableFilters {
  name: string
  shape: TableShape | ''
  fullness: Fullness | ''
}

export const NO_TABLE_FILTERS: TableFilters = { name: '', shape: '', fullness: '' }

export function hasTableFilter(filters: TableFilters): boolean {
  return filters.name.trim() !== '' || filters.shape !== '' || filters.fullness !== ''
}

/** Every filter must match. Generic so callers can carry extra fields along. */
export function filterBoard<T extends { spot: TableOccupancy }>(
  entries: T[],
  filters: TableFilters
): T[] {
  const needle = filters.name.trim().toLowerCase()
  return entries.filter(
    ({ spot }) =>
      (!needle || spot.table.name.toLowerCase().includes(needle)) &&
      (!filters.shape || spot.table.shape === filters.shape) &&
      (!filters.fullness || fullness(spot) === filters.fullness)
  )
}

/**
 * Moves one table to `toIndex` and renumbers everything 0…n−1.
 *
 * Returns only the rows whose sort_order actually changes, so a move writes as
 * few rows as it can. Renumbering the whole list — rather than swapping two
 * values — also repairs rows that share a sort_order, which older tables do.
 */
export function reorderTables(
  tables: SeatingTable[],
  id: string,
  toIndex: number
): { id: string; sort_order: number }[] {
  const from = tables.findIndex((table) => table.id === id)
  if (from === -1) return []

  const to = Math.min(Math.max(toIndex, 0), tables.length - 1)
  const ordered = [...tables]
  const [moved] = ordered.splice(from, 1)
  ordered.splice(to, 0, moved)

  return ordered
    .map((table, index) => ({ id: table.id, sort_order: index, current: table.sort_order }))
    .filter((row) => row.sort_order !== row.current)
    .map(({ id, sort_order }) => ({ id, sort_order }))
}

/** Total chairs across every table, against the people who need one. */
export function capacityTotals(tables: SeatingTable[], people: SeatablePerson[]) {
  return {
    chairs: tables.reduce((sum, table) => sum + table.capacity, 0),
    people: people.length,
    seated: people.filter((person) => person.tableId !== null).length,
  }
}
