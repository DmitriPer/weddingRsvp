/**
 * Who can be seated, and how full each table is (PRD §6.17). Pure — invites and
 * tables in, a board out. The component holds the interaction; the rules live
 * here, like lib/invite-filters.ts for the invitee list.
 */

import { answerForPerson } from '@/lib/headcount'
import { TABLE_SEATS, type InviteWithPeople, type SeatingTable } from '@/lib/types'

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

/** Total chairs across every table, against the people who need one. */
export function capacityTotals(tables: SeatingTable[], people: SeatablePerson[]) {
  return {
    chairs: tables.reduce((sum, table) => sum + table.capacity, 0),
    people: people.length,
    seated: people.filter((person) => person.tableId !== null).length,
  }
}
