/**
 * Placeholder "+1" rules (PRD §5.3). Pure — decides what should change; the
 * data layer carries it out.
 *
 * A guest choosing "2 extra adults" is choosing a NUMBER, not editing rows.
 * So each submission reconciles: create or delete the difference.
 */

import type { Attendee } from '@/lib/types'

/** Label for an unnamed guest. Numbered only when there is more than one. */
export function placeholderName(inviteName: string, ordinal: number): string {
  return ordinal === 1 ? `אורח של ${inviteName}` : `אורח של ${inviteName} ${ordinal}`
}

export interface PlaceholderPlan {
  create: { name: string; is_child: boolean }[]
  deleteIds: string[]
}

function planOneKind(
  inviteName: string,
  existing: Attendee[],
  wanted: number,
  isChild: boolean,
  startingOrdinal: number
): PlaceholderPlan {
  const current = existing.filter((p) => p.is_placeholder && p.is_child === isChild)

  const create: PlaceholderPlan['create'] = []
  for (let i = current.length; i < wanted; i++) {
    create.push({ name: placeholderName(inviteName, startingOrdinal + i), is_child: isChild })
  }

  return { create, deleteIds: current.slice(wanted).map((p) => p.id) }
}

export function planPlaceholders(
  inviteName: string,
  existing: Attendee[],
  wantedAdults: number,
  wantedKids: number
): PlaceholderPlan {
  const adults = planOneKind(inviteName, existing, wantedAdults, false, 1)
  const kids = planOneKind(inviteName, existing, wantedKids, true, wantedAdults + 1)

  return {
    create: [...adults.create, ...kids.create],
    deleteIds: [...adults.deleteIds, ...kids.deleteIds],
  }
}

/** Declining removes every placeholder: they represent nobody (PRD §6.1). */
export function placeholderIds(attendees: Attendee[]): string[] {
  return attendees.filter((person) => person.is_placeholder).map((person) => person.id)
}
