/**
 * Every shared type. Mirrors the schema in supabase/migrations/001_initial_schema.sql.
 *
 * Note what is NOT here: there are no headcount columns. Every attending person
 * is a row in `attendees`, so counts are always derived (PRD §5.1, lib/headcount.ts).
 */

export type InviteStatus = 'added' | 'pending' | 'opened' | 'submitted' | 'edited'
export type Side = 'bride' | 'groom' | 'shared'
export type Relation = 'family' | 'friend' | 'work' | 'invited_by_family'

export const INVITE_STATUSES: readonly InviteStatus[] = [
  'added',
  'pending',
  'opened',
  'submitted',
  'edited',
] as const

export const SIDES: readonly Side[] = ['bride', 'groom', 'shared'] as const
export const RELATIONS: readonly Relation[] = [
  'family',
  'friend',
  'work',
  'invited_by_family',
] as const

/** One invitation. `name` is the label used in messages, not necessarily a person. */
export interface Invite {
  id: string
  token: string
  name: string
  phone: string | null
  status: InviteStatus
  side: Side | null
  relation: Relation | null

  last_contacted_at: string | null
  contact_attempts: number

  attending: boolean | null // null = has not answered yet
  responded_at: string | null
  updated_at: string | null

  created_at: string
}

/** One person. The only place people exist — including guest-added "+1"s. */
export interface Attendee {
  id: string
  invite_id: string
  name: string
  is_child: boolean
  is_attending: boolean
  /** A guest-added "+1". The admin can rename it, which clears this flag. */
  is_placeholder: boolean
  /** null = unseated */
  table_id: string | null
  created_at: string
}

/** Named `SeatingTable`, not `Table`, to avoid confusion with a UI table. */
export interface SeatingTable {
  id: string
  name: string
  capacity: number
  sort_order: number
  created_at: string
}

/** Append-only. Counts are snapshotted here and nowhere else. */
export interface ResponseHistoryEntry {
  id: string
  invite_id: string
  attending: boolean
  adult_count: number
  kid_count: number
  submitted_at: string
}

export interface WeddingConfig {
  couple_names: string
  wedding_date_time: string | null
  venue_name: string
  /** null = no deadline, the form is always open */
  rsvp_deadline: string | null
  contact_phone: string
  invite_message_template: string
  day_of_message_template: string
  thank_you_message_template: string
  updated_at: string
}

export interface InviteWithPeople extends Invite {
  attendees: Attendee[]
}

export interface InviteWithHistory extends InviteWithPeople {
  history: ResponseHistoryEntry[]
}

export interface Headcount {
  adults: number
  kids: number
  total: number
}

/**
 * Note which of these count INVITATIONS and which count PEOPLE. A household of
 * two is one invitation and two people, and the tiles show people — mixing the
 * two is how a caterer gets the wrong number.
 */
export interface Stats {
  byStatus: Record<InviteStatus, number>
  /** Invitations sent. */
  totalInvites: number
  /** People listed across every invitation, answered or not. */
  totalInvitedPeople: number
  totalAdults: number
  totalKids: number
  totalAttending: number
  /** Invitations that answered no. */
  totalDeclined: number
  /** People who answered no. */
  totalDeclinedPeople: number
  totalUnanswered: number
}

/** What the guest's form sends. They tick people and choose extra counts. */
export interface RsvpSubmission {
  token: string
  attending: boolean
  /** attendee ids the guest ticked. Ignored when attending is false. */
  attendingIds: string[]
  /** Unnamed guests to add. Ignored when attending is false. */
  extraAdults: number
  extraKids: number
}

/**
 * What POST /api/rsvp answers with — the submission's counterpart, which is why
 * it sits beside it rather than in the data layer. The guest's confirmation
 * screen is a Client Component and may not import from lib/data at all.
 */
export interface RsvpResult {
  invite: InviteWithPeople
  adults: number
  kids: number
}

export interface CreateInviteInput {
  name: string
  phone?: string | null
  side?: Side | null
  relation?: Relation | null
}

export type UpdateInviteInput = Partial<CreateInviteInput>

export interface CreateAttendeeInput {
  invite_id: string
  name: string
  is_child?: boolean
}

export interface UpdateAttendeeInput {
  name?: string
  is_child?: boolean
  table_id?: string | null
  /** Renaming a placeholder clears the flag — that is the admin naming a "+1". */
  is_placeholder?: boolean
}

export interface CreateTableInput {
  name: string
  capacity: number
  sort_order?: number
}

export type UpdateTableInput = Partial<CreateTableInput>

export type ApiResponse<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }
