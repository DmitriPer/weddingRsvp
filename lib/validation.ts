/**
 * Input parsing for API routes. Pure functions: unknown in, typed value or a
 * message out. No throwing, no I/O — routes decide what to do with a failure.
 */

import {
  INVITE_STATUSES,
  LANGUAGES,
  RELATIONS,
  SIDES,
  type CreateAttendeeInput,
  type CreateInviteInput,
  type CreateTableInput,
  type InviteStatus,
  type Language,
  type Relation,
  type RsvpSubmission,
  type Side,
  type UpdateAttendeeInput,
  type UpdateInviteInput,
  type UpdateTableInput,
} from '@/lib/types'
import { toStoredPhone } from '@/lib/phone'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): Parsed<never> => ({ ok: false, error })
const pass = <T>(value: T): Parsed<T> => ({ ok: true, value })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `invites.token` and every id are `uuid` columns. Querying them with a
 * non-UUID string makes Postgres throw `invalid input syntax for type uuid`
 * rather than returning no rows — which turns a mangled invite link into a 500
 * instead of a clean "invalid link" page. Check the shape first.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * A phone, canonicalised (PRD §6.9). `0549546899` becomes `+972549546899`, so
 * the wa.me link built from it actually reaches someone — stored as typed it
 * produces `wa.me/0549546899`, which resolves to nothing and looks fine doing
 * it. A number already starting `+` is never touched.
 */
function phoneField(value: unknown): Parsed<string | null> {
  if (value === undefined || value === null || value === '') return pass(null)
  if (typeof value !== 'string') return fail('Phone must be text')
  return pass(toStoredPhone(value))
}

function optionalText(value: unknown, field: string): Parsed<string | null> {
  if (value === undefined || value === null || value === '') return pass(null)
  if (typeof value !== 'string') return fail(`${field} must be text`)
  return pass(value.trim() || null)
}

function requiredText(value: unknown, field: string): Parsed<string> {
  if (typeof value !== 'string' || !value.trim()) return fail(`${field} is required`)
  return pass(value.trim())
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): Parsed<T | null> {
  if (value === undefined || value === null || value === '') return pass(null)
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return fail(`${field} must be one of: ${allowed.join(', ')}`)
  }
  return pass(value as T)
}

function booleanField(value: unknown, field: string): Parsed<boolean> {
  if (typeof value !== 'boolean') return fail(`${field} must be true or false`)
  return pass(value)
}

/**
 * `invites.first_invite_sender` is free text (008_first_invitation.sql), and the
 * dropdown that fills it constrains the UI only — PATCH /api/invites/[id] is a
 * URL, reachable with curl. A ceiling here keeps a free-text column from
 * becoming somewhere to store a novel.
 */
const SENDER_MAX_LENGTH = 80

function nonNegativeInt(value: unknown, field: string): Parsed<number> {
  if (value === undefined || value === null) return pass(0)
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return fail(`${field} must be a whole number of zero or more`)
  }
  return pass(value)
}

function stringArray(value: unknown, field: string): Parsed<string[]> {
  if (value === undefined || value === null) return pass([])
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return fail(`${field} must be a list of ids`)
  }
  return pass(value as string[])
}

export function parseCreateInvite(body: unknown): Parsed<CreateInviteInput> {
  if (!isRecord(body)) return fail('Invalid request body')

  const name = requiredText(body.name, 'Name')
  if (!name.ok) return name
  const phone = phoneField(body.phone)
  if (!phone.ok) return phone
  const side = optionalEnum<Side>(body.side, SIDES, 'Side')
  if (!side.ok) return side
  const relation = optionalEnum<Relation>(body.relation, RELATIONS, 'Relation')
  if (!relation.ok) return relation
  const language = optionalEnum<Language>(body.language, LANGUAGES, 'Language')
  if (!language.ok) return language

  return pass({
    name: name.value,
    phone: phone.value,
    side: side.value,
    relation: relation.value,
    // Blank means Hebrew: the default, not a missing value (PRD §6.7b).
    language: language.value ?? 'he',
  })
}

export function parseUpdateInvite(body: unknown): Parsed<UpdateInviteInput> {
  if (!isRecord(body)) return fail('Invalid request body')
  const update: UpdateInviteInput = {}

  if ('name' in body) {
    const name = requiredText(body.name, 'Name')
    if (!name.ok) return name
    update.name = name.value
  }
  if ('phone' in body) {
    const phone = phoneField(body.phone)
    if (!phone.ok) return phone
    update.phone = phone.value
  }
  if ('side' in body) {
    const side = optionalEnum<Side>(body.side, SIDES, 'Side')
    if (!side.ok) return side
    update.side = side.value
  }
  if ('relation' in body) {
    const relation = optionalEnum<Relation>(body.relation, RELATIONS, 'Relation')
    if (!relation.ok) return relation
    update.relation = relation.value
  }
  if ('language' in body) {
    const language = optionalEnum<Language>(body.language, LANGUAGES, 'Language')
    if (!language.ok) return language
    // `language` is NOT NULL in the database — clearing it means Hebrew.
    update.language = language.value ?? 'he'
  }

  /*
   * First-invitation coordination (PRD §6.21). Both are accepted here and
   * nowhere else: parseCreateInvite deliberately does not take them, because a
   * household that was only just added cannot already have been written to.
   *
   * Note what these do NOT do — they never touch `status` or
   * `contact_attempts`. Those belong to the wa.me button, and a planning tick
   * moving a household into the send pipeline is the bug this separation is for.
   */
  if ('first_invite_sent' in body) {
    const sent = booleanField(body.first_invite_sent, 'First invitation sent')
    if (!sent.ok) return sent
    update.first_invite_sent = sent.value
  }
  if ('first_invite_sender' in body) {
    const sender = optionalText(body.first_invite_sender, 'Sender')
    if (!sender.ok) return sender
    if (sender.value && sender.value.length > SENDER_MAX_LENGTH) {
      return fail(`Sender must be ${SENDER_MAX_LENGTH} characters or fewer`)
    }
    // null clears it back to undecided, which is a real edit, not a no-op.
    update.first_invite_sender = sender.value
  }

  if (Object.keys(update).length === 0) return fail('Nothing to update')
  return pass(update)
}

export function parseCreateAttendee(body: unknown): Parsed<CreateAttendeeInput> {
  if (!isRecord(body)) return fail('Invalid request body')

  const inviteId = requiredText(body.invite_id, 'Invite id')
  if (!inviteId.ok) return inviteId
  const name = requiredText(body.name, 'Name')
  if (!name.ok) return name

  return pass({
    invite_id: inviteId.value,
    name: name.value,
    is_child: body.is_child === true,
  })
}

export function parseUpdateAttendee(body: unknown): Parsed<UpdateAttendeeInput> {
  if (!isRecord(body)) return fail('Invalid request body')
  const update: UpdateAttendeeInput = {}

  if ('name' in body) {
    const name = requiredText(body.name, 'Name')
    if (!name.ok) return name
    update.name = name.value
    // Naming a "+1" is exactly what stops it being a placeholder (PRD §5.3).
    update.is_placeholder = false
  }
  if ('is_child' in body) update.is_child = body.is_child === true
  if ('table_id' in body) {
    const tableId = optionalText(body.table_id, 'Table id')
    if (!tableId.ok) return tableId
    update.table_id = tableId.value
  }

  if (Object.keys(update).length === 0) return fail('Nothing to update')
  return pass(update)
}

export function parseCreateTable(body: unknown): Parsed<CreateTableInput> {
  if (!isRecord(body)) return fail('Invalid request body')

  const name = requiredText(body.name, 'Table name')
  if (!name.ok) return name
  if (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity) || body.capacity < 1) {
    return fail('Capacity must be a whole number of one or more')
  }
  const sortOrder = nonNegativeInt(body.sort_order, 'Sort order')
  if (!sortOrder.ok) return sortOrder

  return pass({ name: name.value, capacity: body.capacity, sort_order: sortOrder.value })
}

export function parseUpdateTable(body: unknown): Parsed<UpdateTableInput> {
  if (!isRecord(body)) return fail('Invalid request body')
  const update: UpdateTableInput = {}

  if ('name' in body) {
    const name = requiredText(body.name, 'Table name')
    if (!name.ok) return name
    update.name = name.value
  }
  if ('capacity' in body) {
    if (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity) || body.capacity < 1) {
      return fail('Capacity must be a whole number of one or more')
    }
    update.capacity = body.capacity
  }
  if ('sort_order' in body) {
    const sortOrder = nonNegativeInt(body.sort_order, 'Sort order')
    if (!sortOrder.ok) return sortOrder
    update.sort_order = sortOrder.value
  }

  if (Object.keys(update).length === 0) return fail('Nothing to update')
  return pass(update)
}

export function parseRsvpSubmission(body: unknown): Parsed<RsvpSubmission> {
  if (!isRecord(body)) return fail('Invalid request body')

  const token = requiredText(body.token, 'Token')
  if (!token.ok) return token
  if (typeof body.attending !== 'boolean') return fail('An answer is required')

  // Declining zeroes everything, so the rest of the payload is ignored (PRD §6.1).
  if (!body.attending) {
    return pass({
      token: token.value,
      attending: false,
      attendingIds: [],
      extraAdults: 0,
      extraKids: 0,
    })
  }

  const attendingIds = stringArray(body.attendingIds, 'Attending ids')
  if (!attendingIds.ok) return attendingIds
  const extraAdults = nonNegativeInt(body.extraAdults, 'Extra adults')
  if (!extraAdults.ok) return extraAdults
  const extraKids = nonNegativeInt(body.extraKids, 'Extra kids')
  if (!extraKids.ok) return extraKids

  if (attendingIds.value.length === 0 && extraAdults.value + extraKids.value === 0) {
    return fail('Choose at least one guest, or answer that you are not coming')
  }

  return pass({
    token: token.value,
    attending: true,
    attendingIds: attendingIds.value,
    extraAdults: extraAdults.value,
    extraKids: extraKids.value,
  })
}

export function parseStatusFilter(value: string | null): InviteStatus | null {
  if (!value) return null
  return INVITE_STATUSES.includes(value as InviteStatus) ? (value as InviteStatus) : null
}
