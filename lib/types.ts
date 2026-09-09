/**
 * Every shared type. Mirrors the schema in supabase/migrations/001_initial_schema.sql.
 *
 * Note what is NOT here: there are no headcount columns. Every attending person
 * is a row in `attendees`, so counts are always derived (PRD §5.1, lib/headcount.ts).
 */

export type InviteStatus = 'added' | 'pending' | 'opened' | 'submitted' | 'edited'

/**
 * Which language a household reads (PRD §6.7b). Hebrew is the default and
 * Russian the exception, which is why 'he' comes first and is the column
 * default — every existing invite stays valid.
 */
export type Language = 'he' | 'ru'
export type Side = 'bride' | 'groom' | 'shared'
export type Relation = 'family' | 'friend' | 'work' | 'invited_by_family'

export const INVITE_STATUSES: readonly InviteStatus[] = [
  'added',
  'pending',
  'opened',
  'submitted',
  'edited',
] as const

export const LANGUAGES: readonly Language[] = ['he', 'ru'] as const

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
  /** Drives the guest page's text, direction, artwork and WhatsApp template. */
  language: Language

  last_contacted_at: string | null
  contact_attempts: number

  /**
   * First-invitation coordination (PRD §6.21) — a planning aid, NOT part of the
   * send pipeline. `status` and `contact_attempts` above are the pipeline and
   * belong to the wa.me button; these two are the couple dividing the list
   * between them before the first round and ticking it off as it goes.
   */
  first_invite_sent: boolean
  /** Free text, matched against lib/senders.ts options at render time only. */
  first_invite_sender: string | null

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
  /** Navigation, always. Never translated — Waze searches this (lib/venue.ts). */
  venue_name: string
  /** Display only, for Russian households. Blank falls back to venue_name. */
  venue_name_ru: string
  /** The guest page's full-screen background (PRD §6.16). A Storage public URL
      once uploaded from /admin/settings; defaults to the committed demo art. */
  invitation_image_he: string
  /** Blank falls back to invitation_image_he (lib/invitation-image.ts). */
  invitation_image_ru: string
  /** null = no deadline, the form is always open */
  rsvp_deadline: string | null
  contact_phone: string
  /** Three purposes x two languages (PRD §6.7b). The wa.me button picks the
      pair member matching that household's `language`. */
  invite_message_template_he: string
  invite_message_template_ru: string
  day_of_message_template_he: string
  day_of_message_template_ru: string
  thank_you_message_template_he: string
  thank_you_message_template_ru: string
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
/**
 * The dashboard bar (PRD §6.11).
 *
 * Every figure comes in BOTH units, because the two answer different questions:
 * people is what the caterer is quoted on, invitations is how many messages are
 * still owed. The bar shows people large and invitations small beneath.
 */
export interface Stats {
  byStatus: Record<InviteStatus, number>

  /** Rows: one per invitation. */
  totalInvites: number
  /** People YOU listed. Excludes guest-added "+1"s — those are `totalExtras`. */
  totalInvitedPeople: number

  /** No answer yet. */
  totalAwaitingPeople: number
  totalAwaitingInvites: number

  /** Coming. Includes guest-added "+1"s: this is the real headcount. */
  totalAttending: number
  totalAttendingInvites: number

  /** Not coming — including someone unticked from a household that IS coming. */
  totalDeclinedPeople: number
  /** Invitations that answered no outright. */
  totalDeclined: number

  /** The breakdown of who is coming. */
  totalAdults: number
  totalKids: number
  /** Guest-added "+1"s among them — people who were never on the list. */
  totalExtras: number

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
  /** Omitted means Hebrew — the database default. */
  language?: Language
}

/**
 * Not `Partial<CreateInviteInput>`: the two first-invitation fields are
 * editable but not creatable. A new household is always "not sent yet, sender
 * undecided" — the database defaults say so — and offering them on the add
 * form would invite ticking a box for a message nobody has sent.
 */
export interface UpdateInviteInput extends Partial<CreateInviteInput> {
  first_invite_sent?: boolean
  /** null clears it back to undecided. */
  first_invite_sender?: string | null
}

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
