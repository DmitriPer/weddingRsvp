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

/**
 * What a household answered (PRD §5.2, migration 010).
 *
 * Three values, which is why this is not a boolean. `undecided` is a real
 * answer — the household replied and does not know yet — and is distinct from
 * having said nothing, which is `answer: null`.
 */
export type Answer = 'yes' | 'no' | 'undecided'
export const ANSWERS: readonly Answer[] = ['yes', 'no', 'undecided'] as const

/**
 * Who recorded an answer (migration 020). The admin records one after a phone
 * call (docs/admin-answer-and-calls-PRD.md); it is written exactly like a
 * guest's, so history is the only place the difference is kept.
 */
export type HistorySource = 'guest' | 'admin'

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

  /**
   * What the household answered. `null` is "has not answered yet".
   *
   * Three answers, so this cannot be a boolean — which is what `attending`
   * below was, and why it is being retired (migration 010).
   */
  answer: Answer | null
  /**
   * @deprecated Superseded by `answer`. Still written for the two values it can
   * express, so migration 010 stays reversible; dropped in 011. Read `answer`.
   */
  attending: boolean | null
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
  /** Migration 018: a child aged 0–3 — free, still takes a chair. Implies is_child. */
  is_infant: boolean
  is_attending: boolean
  /** A guest-added "+1". The admin can rename it, which clears this flag. */
  is_placeholder: boolean
  /** null = unseated */
  table_id: string | null
  created_at: string
}

/**
 * What shape a table is (PRD §6.17, migration 011).
 *
 * Not decoration — it is what decides how many people fit, so it drives the
 * capacity the seating page suggests and the point at which it warns.
 */
export type TableShape = 'round' | 'ellipse' | 'rectangle'
export const TABLE_SHAPES: readonly TableShape[] = ['round', 'ellipse', 'rectangle'] as const

/**
 * Seats per shape, as the venue works: a round table takes eight to ten, an
 * ellipse twelve or thirteen, a rectangle fourteen.
 *
 * `max` is a warning threshold, not a limit. `capacity` is its own column and
 * stays editable, because an eleventh chair squeezed around a round table is a
 * real thing and the app's job is to say so, not to refuse to record it.
 */
export const TABLE_SEATS: Record<TableShape, { min: number; max: number; default: number }> = {
  round: { min: 8, max: 10, default: 10 },
  ellipse: { min: 12, max: 13, default: 12 },
  rectangle: { min: 12, max: 14, default: 14 },
}

/** Named `SeatingTable`, not `Table`, to avoid confusion with a UI table. */
export interface SeatingTable {
  id: string
  name: string
  shape: TableShape
  capacity: number
  sort_order: number
  /**
   * Where the table stands in the room, as a percentage of the floor plan
   * (migration 012). Null until it has been dragged — the map grids those.
   */
  pos_x: number | null
  pos_y: number | null
  /**
   * Degrees clockwise (migration 013). Meaningless for a round table, which
   * looks the same at any angle — the map hides the control for those.
   */
  rotation: number
  created_at: string
}

/** Append-only. Counts are snapshotted here and nowhere else. */
export interface ResponseHistoryEntry {
  id: string
  invite_id: string
  /** What was answered at the time. Snapshotted, like the counts beside it. */
  answer: Answer
  /**
   * @deprecated Superseded by `answer`; null for an undecided entry, which is
   * why the column had to become nullable in migration 010.
   */
  attending: boolean | null
  adult_count: number
  kid_count: number
  submitted_at: string
  /** Who recorded it. Every row before migration 020 is 'guest'. */
  source: HistorySource
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
  /** Four purposes x two languages (PRD §6.7b, docs/whatsapp-rounds-PRD.md).
      The wa.me button picks the pair member matching that household's
      `language`, for the kind chosen in the toolbar (lib/send-kinds.ts). */
  invite_message_template_he: string
  invite_message_template_ru: string
  /** Migration 014. To households invited but not answered yet. */
  reminder_message_template_he: string
  reminder_message_template_ru: string
  day_of_message_template_he: string
  day_of_message_template_ru: string
  thank_you_message_template_he: string
  thank_you_message_template_ru: string
  /** Migration 016. כמות התחייבות: per-guest expenses bill max(approved, this).
      0 = no minimum. Edited on the budget page. */
  budget_min_guests: number
  /** Migration 017 (docs/wedding-photos-PRD.md). The QR code's secret; the only
      gate on the public upload page. Regenerated from admin, never edited. */
  photo_upload_key: string
  /** Manual switch: uploads are refused while false. Closed by default. */
  photo_upload_open: boolean
  updated_at: string
}

/**
 * One line in the wedding's budget (PRD §6.22).
 *
 * `expense` is money out, `income` is money in — gifts, contributions.
 */
export type BudgetKind = 'expense' | 'income'

/**
 * How to read `amount`. This is the toggle on each row.
 *
 *   flat        `amount` IS the full price       — a DJ at ₪8,000
 *   per_person  `amount` is the price per guest  — a caterer at ₪250/head
 */
export type BudgetPricing = 'flat' | 'per_person'

export const BUDGET_KINDS: readonly BudgetKind[] = ['expense', 'income'] as const
export const BUDGET_PRICINGS: readonly BudgetPricing[] = ['flat', 'per_person'] as const

export interface BudgetItem {
  id: string
  name: string
  kind: BudgetKind
  pricing: BudgetPricing
  /** AGOROT, always an integer. Meaning depends on `pricing` (lib/money.ts). */
  amount: number
  /** AGOROT already handed over. Never derived — a human types this. */
  paid_in_advance: number
  /**
   * Migration 018. AGOROT per child aged 3–7, on per_person lines only.
   * null = a child pays the adult price (how every line priced before 018).
   * Infants (0–3) are always free.
   */
  child_amount: number | null
  sort_order: number
  created_at: string
}

/**
 * What a budget line actually costs, worked out rather than stored
 * (lib/budget.ts). One figure: a per-guest expense is billed for the approved
 * count, never below the committed minimum (docs/budget-min-guests-PRD.md).
 */
export interface BudgetLine {
  item: BudgetItem
  full: number
  toPay: number
}

/** The four tiles (PRD §6.22). */
export interface BudgetTotals {
  expenses: number
  income: number
  /** income − expenses. Negative means the wedding costs more than it brings. */
  balance: number
  /** Unpaid expenses only — income is not something you "still owe". */
  toPay: number
}

export interface CreateBudgetItemInput {
  name: string
  kind: BudgetKind
  pricing: BudgetPricing
  amount: number
  paid_in_advance?: number
  child_amount?: number | null
  sort_order?: number
}

export type UpdateBudgetItemInput = Partial<CreateBudgetItemInput>

/**
 * One wedding-bingo square (docs/games-bingo-PRD.md §4).
 *
 * Paired: both languages of the same task on one row. An empty side means the
 * square is left off cards in that language.
 */
export interface BingoSquare {
  id: string
  text_he: string
  text_ru: string
  sort_order: number
  created_at: string
}

export interface CreateBingoSquareInput {
  text_he: string
  text_ru: string
  sort_order?: number
}

export type UpdateBingoSquareInput = Partial<CreateBingoSquareInput>

/** One guest photo that reached Google Drive (docs/wedding-photos-PRD.md §6). */
export interface WeddingPhoto {
  id: string
  /** Migration 019: the running number in the Drive file name. */
  photo_number: number
  /** Null only while the reserved photo is still uploading (migration 019). */
  drive_file_id: string | null
  uploader_name: string
  size_bytes: number
  created_at: string
}

/**
 * The single Drive connection. `refresh_token` is a credential: server-only,
 * never serialised to a Client Component — use DriveStatus for the browser.
 */
export interface DriveConnection {
  refresh_token: string
  folder_id: string
  account_email: string
  connected_at: string
}

/** What admin shows about the connection. Safe to send to the browser. */
export type DriveStatus =
  | { state: 'disconnected' }
  | { state: 'connected'; email: string; folderUrl: string }
  /** The token was revoked or expired; uploads fail until reconnected. */
  | { state: 'broken'; email: string }

export interface InviteWithPeople extends Invite {
  attendees: Attendee[]
}

export interface InviteWithHistory extends InviteWithPeople {
  history: ResponseHistoryEntry[]
}

export interface Headcount {
  adults: number
  /** Every child, infants included — what the guest form and exports mean by "kids". */
  kids: number
  /** The 0–3 subset of `kids` (migration 018). Free on the budget. */
  infants: number
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

  /**
   * Answered 'undecided'. Deliberately NOT folded into the awaiting counts:
   * "nobody has replied" and "replied, cannot say" are different problems — the
   * first needs an invitation, the second needs a nudge. A screen wanting "how
   * much could the headcount still move" adds the two.
   */
  totalUndecidedInvites: number
  totalUndecidedPeople: number

  /** Not coming — including someone unticked from a household that IS coming. */
  totalDeclinedPeople: number
  /** Invitations that answered no outright. */
  totalDeclined: number

  /** The breakdown of who is coming. */
  totalAdults: number
  totalKids: number
  /** The 0–3 subset of totalKids — free on the budget (migration 018). */
  totalInfants: number
  /** Guest-added "+1"s among them — people who were never on the list. */
  totalExtras: number

  totalUnanswered: number
}

/** What the guest's form sends. They tick people and choose extra counts. */
export interface RsvpSubmission {
  token: string
  answer: Answer
  /** attendee ids the guest ticked. Empty unless the answer is 'yes'. */
  attendingIds: string[]
  /** Unnamed guests to add. Empty unless the answer is 'yes'. */
  extraAdults: number
  extraKids: number
}

/**
 * What the admin records after a phone call (POST /api/invites/[id]/answer).
 * No extra counts: existing +1s are kept as they are, and new ones are added
 * in the attendee editor (docs/admin-answer-and-calls-PRD.md §6).
 */
export interface AdminAnswer {
  answer: Answer
  /** Named attendee ids marked coming. Empty unless the answer is 'yes'. */
  attendingIds: string[]
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
  is_infant?: boolean
}

export interface UpdateAttendeeInput {
  name?: string
  is_child?: boolean
  is_infant?: boolean
  table_id?: string | null
  /** Renaming a placeholder clears the flag — that is the admin naming a "+1". */
  is_placeholder?: boolean
}

export interface CreateTableInput {
  name: string
  shape: TableShape
  capacity: number
  sort_order?: number
  pos_x?: number | null
  pos_y?: number | null
  rotation?: number
}

export type UpdateTableInput = Partial<CreateTableInput>

export type ApiResponse<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }
