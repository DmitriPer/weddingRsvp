/**
 * Search, filter, and sort for the invitee list (PRD §6.6). Pure — a list in, a
 * list out. The component holds the state; the rules live here.
 */

import { countAttending } from '@/lib/headcount'
import { needsPhoneCall } from '@/lib/status'
import {
  INVITE_STATUSES,
  RELATIONS,
  type InviteStatus,
  type InviteWithPeople,
  type Relation,
} from '@/lib/types'

export const SORT_KEYS = ['name', 'relation', 'status', 'headcount', 'lastContacted'] as const
export type SortKey = (typeof SORT_KEYS)[number]

/**
 * Reduces a phone number to its national significant digits, so the same number
 * matches however it was written.
 *
 *   "+972-50-111-1111" -> "501111111"
 *   "0501111111"       -> "501111111"
 *
 * Needed because numbers are stored international (`+972…`) but anyone here will
 * type them local (`05…`). Without this, searching "0501111" finds nothing:
 * "972501111111" simply does not contain "0501111".
 */
function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('972')) return digits.slice(3).replace(/^0+/, '')
  return digits.replace(/^0+/, '')
}

/** Matches the invitation label, the phone, or any person's name. */
export function searchInvites(invites: InviteWithPeople[], query: string): InviteWithPeople[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return invites

  const needleDigits = /\d/.test(needle) ? phoneDigits(needle) : ''

  return invites.filter((invite) => {
    if (invite.name.toLowerCase().includes(needle)) return true

    if (needleDigits && invite.phone && phoneDigits(invite.phone).includes(needleDigits)) {
      return true
    }

    return invite.attendees.some((person) => person.name.toLowerCase().includes(needle))
  })
}

export function filterByStatus(
  invites: InviteWithPeople[],
  status: InviteStatus | null
): InviteWithPeople[] {
  return status ? invites.filter((invite) => invite.status === status) : invites
}

export function filterNeedsPhoneCall(
  invites: InviteWithPeople[],
  only: boolean
): InviteWithPeople[] {
  if (!only) return invites
  return invites.filter((invite) => needsPhoneCall(invite.status, invite.contact_attempts))
}

/** Sorts last when unset, rather than jumping ahead of 'family'. */
function relationRank(relation: Relation | null): number {
  return relation ? RELATIONS.indexOf(relation) : RELATIONS.length
}

function compare(a: InviteWithPeople, b: InviteWithPeople, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name, 'he')
    case 'relation':
      // Staged order, not alphabetical — family before friend before work…
      return relationRank(a.relation) - relationRank(b.relation)
    case 'status':
      // Pipeline order, not alphabetical — 'added' before 'pending' before…
      return INVITE_STATUSES.indexOf(a.status) - INVITE_STATUSES.indexOf(b.status)
    case 'headcount':
      return countAttending(b.attendees).total - countAttending(a.attendees).total
    case 'lastContacted':
      // Never-contacted first: they are the ones needing action.
      return (a.last_contacted_at ?? '').localeCompare(b.last_contacted_at ?? '')
  }
}

export function sortInvites(invites: InviteWithPeople[], key: SortKey): InviteWithPeople[] {
  return [...invites].sort((a, b) => compare(a, b, key))
}
