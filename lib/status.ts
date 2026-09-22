/**
 * Status transition rules (PRD §5.2).
 *
 *   added → pending → opened → submitted → edited
 *
 * Strictly one-directional. `edited` is terminal. Every transition goes through
 * this file so "never reverts" is enforced in one place rather than remembered
 * at each call site.
 */

import { INVITE_STATUSES, type InviteStatus } from '@/lib/types'

function rank(status: InviteStatus): number {
  return INVITE_STATUSES.indexOf(status)
}

/** Moves forward to `target`, or stays put if that would go backwards. */
export function advanceTo(current: InviteStatus, target: InviteStatus): InviteStatus {
  return rank(target) > rank(current) ? target : current
}

/** The admin tapped wa.me. Only `added` moves; anything later already knows. */
export function statusAfterContact(current: InviteStatus): InviteStatus {
  return advanceTo(current, 'pending')
}

/** The guest's browser reported a real page view (PRD §6.15). */
export function statusAfterOpen(current: InviteStatus): InviteStatus {
  return advanceTo(current, 'opened')
}

/** First answer becomes `submitted`; every later one becomes `edited`. */
export function statusAfterSubmit(current: InviteStatus): InviteStatus {
  const hasAnsweredBefore = current === 'submitted' || current === 'edited'
  return hasAnsweredBefore ? 'edited' : 'submitted'
}

/**
 * An invitation has actually gone out.
 *
 * Measured by the CONTACT RECORD, not by the status, and the difference is not
 * academic: `opened` is set from the guest page's own JavaScript, so opening a
 * link to check it — or copying it and viewing it yourself — advances a
 * household past `added` without anyone having been invited. Three households
 * with no phone number at all sat at `opened`, with zero attempts and no
 * timestamp, which is how this was found.
 *
 * Tapping wa.me is the only thing that records a send (app/api/invites/[id]/
 * contacted), and it writes both fields together. Either is accepted, so a row
 * carrying one without the other still counts.
 */
export function hasBeenSent(contactAttempts: number, lastContactedAt: string | null): boolean {
  return contactAttempts > 0 || Boolean(lastContactedAt)
}

export function hasAnswered(status: InviteStatus): boolean {
  return status === 'submitted' || status === 'edited'
}

/** Who the follow-up flag applies to: invited, but still silent (PRD §6.10). */
export function isAwaitingResponse(status: InviteStatus): boolean {
  return status === 'pending' || status === 'opened'
}

export const FOLLOW_UP_ATTEMPT_THRESHOLD = 5

/** "Needs a phone call": contacted 5+ times with still no answer. */
export function needsPhoneCall(status: InviteStatus, contactAttempts: number): boolean {
  return isAwaitingResponse(status) && contactAttempts >= FOLLOW_UP_ATTEMPT_THRESHOLD
}
