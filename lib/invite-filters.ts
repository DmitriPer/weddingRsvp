/**
 * Search, filter, and sort for the invitee list (PRD §6.6). Pure — a list in, a
 * list out. The component holds the state; the rules live here.
 */

import { countAttending } from '@/lib/headcount'
import { hasBeenSent, needsPhoneCall } from '@/lib/status'
import {
  INVITE_STATUSES,
  RELATIONS,
  type InviteStatus,
  type InviteWithPeople,
  type Language,
  type Relation,
  type Side,
} from '@/lib/types'

export const SORT_KEYS = ['name', 'relation', 'status', 'headcount', 'lastContacted'] as const
export type SortKey = (typeof SORT_KEYS)[number]

export type SortDirection = 'asc' | 'desc'

/**
 * Which way each key points when you first pick it.
 *
 * Not all ascending: the useful end differs per column. The biggest households
 * are the ones that drive the catering, so `headcount` opens descending, while
 * `lastContacted` opens ascending because never-contacted comes first and those
 * are the rows that need work. `compare` below is ALWAYS ascending; this table
 * is what the toggle starts from.
 */
export const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  name: 'asc',
  relation: 'asc',
  status: 'asc',
  headcount: 'desc',
  lastContacted: 'asc',
}

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

/**
 * Several statuses at once — the follow-up workflow asks for combinations, not
 * one state: "who has been sent an invite but hasn't answered" is `pending` and
 * `opened` together, and there is no single value that means it.
 *
 * An EMPTY list means all, the same no-op convention the other filters use for
 * `null`. It is not "show nothing": a filter that hides every row when you
 * deselect the last chip reads as a bug.
 */
export function filterByStatus(
  invites: InviteWithPeople[],
  statuses: readonly InviteStatus[]
): InviteWithPeople[] {
  if (statuses.length === 0) return invites
  const wanted = new Set(statuses)
  return invites.filter((invite) => wanted.has(invite.status))
}

/** Whether the invitation has gone out. `null` is both, as everywhere here. */
export type SentFilter = 'sent' | 'unsent'

/**
 * Sent or not yet sent, by the contact record rather than the status.
 *
 * NOT the same as the status chips, which is why it earns its own control: a
 * household can reach `opened` without ever being invited, because that status
 * comes from the guest page's JavaScript and fires for anyone who opens the
 * link — including whoever copied it to check. Filtering on 'נוסף' alone would
 * miss those, and call them sent.
 *
 * It ANDs with the status filter like every other filter here.
 */
export function filterBySent(
  invites: InviteWithPeople[],
  sent: SentFilter | null
): InviteWithPeople[] {
  if (!sent) return invites
  const want = sent === 'sent'
  return invites.filter(
    (invite) => hasBeenSent(invite.contact_attempts, invite.last_contacted_at) === want
  )
}

/** Independent of filterByStatus — the two combine, they don't replace each other. */
export function filterByRelation(
  invites: InviteWithPeople[],
  relation: Relation | null
): InviteWithPeople[] {
  return relation ? invites.filter((invite) => invite.relation === relation) : invites
}

/** Independent of filterByRelation — e.g. side=groom + relation=family narrows to both. */
export function filterBySide(
  invites: InviteWithPeople[],
  side: Side | null
): InviteWithPeople[] {
  return side ? invites.filter((invite) => invite.side === side) : invites
}

/**
 * Which language a household reads (PRD §6.7b).
 *
 * `null` means both, exactly like the three filters above — there is no `both`
 * value on a household, and adding one would change the guest page, the
 * templates and the artwork. This is the filter's own no-op state.
 */
export function filterByLanguage(
  invites: InviteWithPeople[],
  language: Language | null
): InviteWithPeople[] {
  return language ? invites.filter((invite) => invite.language === language) : invites
}

/**
 * Households with no phone number — the ones that need one typed in.
 *
 * A number is the prerequisite for the whole send workflow: no phone means no
 * `wa.me` link and no way to reach them, so these rows are invisible work
 * rather than a state to report. Whitespace counts as missing: a row holding
 * `" "` is not contactable, however non-empty the column looks.
 */
export function filterMissingPhone(
  invites: InviteWithPeople[],
  only: boolean
): InviteWithPeople[] {
  if (!only) return invites
  return invites.filter((invite) => !invite.phone?.trim())
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

/** ALWAYS ascending. Direction is applied by `sortInvites`, never in here. */
function compare(a: InviteWithPeople, b: InviteWithPeople, key: SortKey): number {
  switch (key) {
    case 'name':
      return byName(a, b)
    case 'relation':
      // Staged order, not alphabetical — family before friend before work…
      return relationRank(a.relation) - relationRank(b.relation)
    case 'status':
      // Pipeline order, not alphabetical — 'added' before 'pending' before…
      return INVITE_STATUSES.indexOf(a.status) - INVITE_STATUSES.indexOf(b.status)
    case 'headcount':
      return countAttending(a.attendees).total - countAttending(b.attendees).total
    case 'lastContacted':
      // Ascending puts the empty string first, which is never-contacted — the
      // rows that need action. That is why this key opens ascending.
      return (a.last_contacted_at ?? '').localeCompare(b.last_contacted_at ?? '')
  }
}

function byName(a: InviteWithPeople, b: InviteWithPeople): number {
  return a.name.localeCompare(b.name, 'he')
}

/**
 * Sorted by one key, then always by name.
 *
 * The tiebreaker is the point. Sorting a hundred households by relation leaves
 * everyone inside 'family' in whatever order the database returned — newest
 * first — which reads as random and reshuffles whenever a row is added. Falling
 * back to the name makes the list identical every time it is opened.
 *
 * The tiebreaker does NOT follow the direction. Reversing "by status" should
 * bring 'edited' to the top; it should not also flip the names within each
 * status, which helps nobody scanning for a household.
 */
export function sortInvites(
  invites: InviteWithPeople[],
  key: SortKey,
  direction: SortDirection = DEFAULT_SORT_DIRECTION[key]
): InviteWithPeople[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...invites].sort((a, b) => {
    const primary = compare(a, b, key) * sign
    return primary !== 0 ? primary : byName(a, b)
  })
}
