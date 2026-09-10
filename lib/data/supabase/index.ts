import 'server-only'

/**
 * The backing store. Uses the service-role client, because every table is RLS
 * deny-all (PRD §7.2) — no other key can read or write project data.
 *
 * Persistence only. Business rules live in lib/: headcount, status transitions,
 * and placeholder planning are all imported, never re-derived here.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { countAttending } from '@/lib/headcount'
import { statusAfterContact, statusAfterOpen, statusAfterSubmit } from '@/lib/status'
import { planPlaceholders, placeholderIds } from '@/lib/placeholders'
import { nowIso } from '@/lib/datetime'
import { isUuid } from '@/lib/validation'
import type {
  Attendee,
  BudgetItem,
  CreateAttendeeInput,
  CreateBudgetItemInput,
  UpdateBudgetItemInput,
  CreateInviteInput,
  CreateTableInput,
  Invite,
  InviteWithHistory,
  InviteWithPeople,
  Language,
  ResponseHistoryEntry,
  RsvpSubmission,
  SeatingTable,
  UpdateAttendeeInput,
  UpdateInviteInput,
  UpdateTableInput,
  WeddingConfig,
} from '@/lib/types'
import type {
  BulkCreateResult,
  DataStore,
  InvitationImage,
  NewInviteWithPeople,
  RsvpResult,
} from '@/lib/data/types'

/** jpg is the fallback: the API route already restricts contentType to these three. */
function extensionForContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
}

const INVITATION_IMAGE_FOLDER = (language: Language) => `invitation/${language}`

/**
 * A request only ever names its OWN language's folder — select/delete are
 * refused on any other path, so a crafted `path` can't repoint config at, or
 * remove, a Storage object outside where this feature writes.
 */
function assertOwnFolder(language: Language, path: string): void {
  if (path !== `${INVITATION_IMAGE_FOLDER(language)}/${path.split('/').pop()}`) {
    throw new Error(`path does not belong to ${language}'s invitation image folder: ${path}`)
  }
}

/** Errors are checked, never assumed — a silent failed write is worse than a crash. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`)
  if (result.data === null) throw new Error(`${context}: no data returned`)
  return result.data
}

const INVITE_COLUMNS = '*'
const ATTENDEE_COLUMNS = '*'

async function fetchAttendees(inviteId: string): Promise<Attendee[]> {
  const db = createAdminClient()
  const result = await db
    .from('attendees')
    .select(ATTENDEE_COLUMNS)
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: true })
  return unwrap(result, 'load people') as Attendee[]
}

export const supabaseStore: DataStore = {
  async listInvites(): Promise<InviteWithPeople[]> {
    const db = createAdminClient()

    const invites = unwrap(
      await db.from('invites').select(INVITE_COLUMNS).order('created_at', { ascending: false }),
      'list invites'
    ) as Invite[]

    const people = unwrap(
      await db.from('attendees').select(ATTENDEE_COLUMNS).order('created_at', { ascending: true }),
      'list people'
    ) as Attendee[]

    // One query for all people, grouped in memory — not N queries.
    const byInvite = new Map<string, Attendee[]>()
    for (const person of people) {
      const group = byInvite.get(person.invite_id)
      if (group) group.push(person)
      else byInvite.set(person.invite_id, [person])
    }

    return invites.map((invite) => ({ ...invite, attendees: byInvite.get(invite.id) ?? [] }))
  },

  async getInvite(id): Promise<InviteWithHistory | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db.from('invites').select(INVITE_COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error(`load invite: ${error.message}`)
    if (!data) return null

    const [attendees, history] = await Promise.all([
      fetchAttendees(id),
      this.listHistory(id),
    ])
    return { ...(data as Invite), attendees, history }
  },

  async getInviteByToken(token): Promise<InviteWithPeople | null> {
    // A malformed token cannot match any row; querying a uuid column with it
    // would throw rather than return empty.
    if (!isUuid(token)) return null
    const db = createAdminClient()
    const { data, error } = await db
      .from('invites')
      .select(INVITE_COLUMNS)
      .eq('token', token)
      .maybeSingle()
    if (error) throw new Error(`load invite by token: ${error.message}`)
    if (!data) return null

    return { ...(data as Invite), attendees: await fetchAttendees((data as Invite).id) }
  },

  async createInvite(input: CreateInviteInput): Promise<Invite> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('invites')
        .insert({
          name: input.name,
          phone: input.phone ?? null,
          side: input.side ?? null,
          relation: input.relation ?? null,
          // Omitted lets the column default to 'he' rather than writing null
          // into a NOT NULL column.
          ...(input.language ? { language: input.language } : {}),
        })
        .select()
        .single(),
      'create invite'
    ) as Invite
  },

  async createInvitesWithPeople(rows: NewInviteWithPeople[]): Promise<BulkCreateResult> {
    if (rows.length === 0) return { invitesCreated: 0, peopleCreated: 0 }
    const db = createAdminClient()

    // One insert for every household, not one per household. Looping
    // createInvite for a 150-row import is ~450 sequential round trips.
    const invites = unwrap(
      await db
        .from('invites')
        .insert(
          rows.map((row) => ({
            name: row.name,
            phone: row.phone,
            side: row.side,
            relation: row.relation,
            language: row.language,
          }))
        )
        .select('id'),
      'import invites'
    ) as { id: string }[]

    // Order is preserved by PostgREST, which is what lets people be matched
    // back to their household by position.
    const people = rows.flatMap((row, index) =>
      row.people.map((person) => ({
        invite_id: invites[index].id,
        name: person.name,
        is_child: person.is_child,
      }))
    )

    if (people.length > 0) {
      const { error } = await db.from('attendees').insert(people)
      if (error) {
        /*
         * COMPENSATE. These two inserts are not one transaction through
         * PostgREST, so a failure here would otherwise leave every invitation
         * created above with no people and nothing to explain why — a
         * half-import that looks like a successful one.
         */
        await db.from('invites').delete().in('id', invites.map((invite) => invite.id))
        throw new Error(`import people: ${error.message}`)
      }
    }

    return { invitesCreated: invites.length, peopleCreated: people.length }
  },

  async deleteInvites(ids): Promise<number> {
    const valid = ids.filter(isUuid)
    if (valid.length === 0) return 0
    const db = createAdminClient()
    // Postgres cascades to attendees and response_history (migration 001).
    const { data, error } = await db.from('invites').delete().in('id', valid).select('id')
    if (error) throw new Error(`delete invites: ${error.message}`)
    return data?.length ?? 0
  },

  async updateInvite(id, input: UpdateInviteInput): Promise<Invite | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db.from('invites').update(input).eq('id', id).select().maybeSingle()
    if (error) throw new Error(`update invite: ${error.message}`)
    return (data as Invite) ?? null
  },

  async deleteInvite(id): Promise<boolean> {
    if (!isUuid(id)) return false
    const db = createAdminClient()
    // Postgres cascades to attendees and response_history — see migration 001.
    const { data, error } = await db.from('invites').delete().eq('id', id).select('id')
    if (error) throw new Error(`delete invite: ${error.message}`)
    return (data?.length ?? 0) > 0
  },

  async findInvitesByPhone(phone, excludeId): Promise<Invite[]> {
    const db = createAdminClient()
    let query = db.from('invites').select(INVITE_COLUMNS).eq('phone', phone)
    if (excludeId) query = query.neq('id', excludeId)
    return unwrap(await query, 'find invites by phone') as Invite[]
  },

  async markOpened(id): Promise<Invite | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data: current, error } = await db
      .from('invites')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`load invite: ${error.message}`)
    if (!current) return null

    const next = statusAfterOpen((current as Invite).status)
    if (next === (current as Invite).status) return current as Invite

    return unwrap(
      await db.from('invites').update({ status: next }).eq('id', id).select().single(),
      'mark opened'
    ) as Invite
  },

  async markContacted(id): Promise<Invite | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data: current, error } = await db
      .from('invites')
      .select('id, status, contact_attempts')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`load invite: ${error.message}`)
    if (!current) return null

    const invite = current as Invite
    return unwrap(
      await db
        .from('invites')
        .update({
          status: statusAfterContact(invite.status),
          contact_attempts: invite.contact_attempts + 1,
          last_contacted_at: nowIso(),
        })
        .eq('id', id)
        .select()
        .single(),
      'mark contacted'
    ) as Invite
  },

  async createAttendee(input: CreateAttendeeInput): Promise<Attendee> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('attendees')
        .insert({
          invite_id: input.invite_id,
          name: input.name,
          is_child: input.is_child ?? false,
        })
        .select()
        .single(),
      'create person'
    ) as Attendee
  },

  async updateAttendee(id, input: UpdateAttendeeInput): Promise<Attendee | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db.from('attendees').update(input).eq('id', id).select().maybeSingle()
    if (error) throw new Error(`update person: ${error.message}`)
    return (data as Attendee) ?? null
  },

  async deleteAttendee(id): Promise<boolean> {
    if (!isUuid(id)) return false
    const db = createAdminClient()
    const { data, error } = await db.from('attendees').delete().eq('id', id).select('id')
    if (error) throw new Error(`delete person: ${error.message}`)
    return (data?.length ?? 0) > 0
  },

  async submitRsvp(submission: RsvpSubmission): Promise<RsvpResult | null> {
    const db = createAdminClient()

    const invite = await this.getInviteByToken(submission.token)
    if (!invite) return null

    if (submission.attending) {
      await applyTicks(invite, submission.attendingIds)
      await applyPlaceholderPlan(invite, submission.extraAdults, submission.extraKids)
    } else {
      await clearEverything(invite)
    }

    // Re-read: the rows just changed, and the snapshot must match what was stored.
    const attendees = await fetchAttendees(invite.id)
    const { adults, kids } = countAttending(attendees)
    const timestamp = nowIso()

    const historyResult = await db.from('response_history').insert({
      invite_id: invite.id,
      attending: submission.attending,
      adult_count: adults,
      kid_count: kids,
      submitted_at: timestamp,
    })
    if (historyResult.error) throw new Error(`append history: ${historyResult.error.message}`)

    const updated = unwrap(
      await db
        .from('invites')
        .update({
          attending: submission.attending,
          status: statusAfterSubmit(invite.status),
          updated_at: timestamp,
          responded_at: invite.responded_at ?? timestamp,
        })
        .eq('id', invite.id)
        .select()
        .single(),
      'save answer'
    ) as Invite

    return { invite: { ...updated, attendees }, adults, kids }
  },

  async listHistory(inviteId): Promise<ResponseHistoryEntry[]> {
    if (!isUuid(inviteId)) return []
    const db = createAdminClient()
    return unwrap(
      await db
        .from('response_history')
        .select('*')
        .eq('invite_id', inviteId)
        .order('submitted_at', { ascending: false }),
      'load history'
    ) as ResponseHistoryEntry[]
  },

  async listTables(): Promise<SeatingTable[]> {
    const db = createAdminClient()
    return unwrap(
      await db.from('tables').select('*').order('sort_order', { ascending: true }),
      'list tables'
    ) as SeatingTable[]
  },

  async createTable(input: CreateTableInput): Promise<SeatingTable> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('tables')
        .insert({ name: input.name, capacity: input.capacity, sort_order: input.sort_order ?? 0 })
        .select()
        .single(),
      'create table'
    ) as SeatingTable
  },

  async updateTable(id, input: UpdateTableInput): Promise<SeatingTable | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db.from('tables').update(input).eq('id', id).select().maybeSingle()
    if (error) throw new Error(`update table: ${error.message}`)
    return (data as SeatingTable) ?? null
  },

  async deleteTable(id): Promise<boolean> {
    if (!isUuid(id)) return false
    const db = createAdminClient()
    // attendees.table_id is ON DELETE SET NULL: people are unseated, not deleted.
    const { data, error } = await db.from('tables').delete().eq('id', id).select('id')
    if (error) throw new Error(`delete table: ${error.message}`)
    return (data?.length ?? 0) > 0
  },

  /*
   * Budget items (PRD §6.22). Persistence only — every price is worked out in
   * lib/budget.ts, so nothing here multiplies or subtracts anything.
   *
   * Ordered by sort_order then created_at: sort_order alone leaves rows added
   * on the same default (0) in whatever order Postgres feels like returning,
   * which makes the table reshuffle itself between reloads.
   */
  async listBudgetItems(): Promise<BudgetItem[]> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('budget_items')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      'list budget items'
    ) as BudgetItem[]
  },

  async createBudgetItem(input: CreateBudgetItemInput): Promise<BudgetItem> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('budget_items')
        .insert({
          name: input.name,
          kind: input.kind,
          pricing: input.pricing,
          amount: input.amount,
          paid_in_advance: input.paid_in_advance ?? 0,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single(),
      'create budget item'
    ) as BudgetItem
  },

  async updateBudgetItem(id, input: UpdateBudgetItemInput): Promise<BudgetItem | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db
      .from('budget_items')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw new Error(`update budget item: ${error.message}`)
    return (data as BudgetItem) ?? null
  },

  async deleteBudgetItem(id): Promise<boolean> {
    if (!isUuid(id)) return false
    const db = createAdminClient()
    // Nothing references a budget item, so this cascades to nothing.
    const { data, error } = await db.from('budget_items').delete().eq('id', id).select('id')
    if (error) throw new Error(`delete budget item: ${error.message}`)
    return (data?.length ?? 0) > 0
  },

  async getConfig(): Promise<WeddingConfig> {
    const db = createAdminClient()
    return unwrap(
      await db.from('wedding_config').select('*').eq('id', true).single(),
      'load config'
    ) as WeddingConfig
  },

  async updateConfig(input): Promise<WeddingConfig> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('wedding_config')
        .update({ ...input, updated_at: nowIso() })
        .eq('id', true)
        .select()
        .single(),
      'save config'
    ) as WeddingConfig
  },

  async uploadInvitationImage(language, bytes, contentType): Promise<WeddingConfig> {
    const db = createAdminClient()

    // A UNIQUE path per upload — never the same name twice — so a new upload
    // can never overwrite and destroy a previous one. No `upsert` needed.
    const extension = extensionForContentType(contentType)
    const path = `${INVITATION_IMAGE_FOLDER(language)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

    const upload = await db.storage.from('assets').upload(path, bytes, { contentType })
    if (upload.error) throw new Error(`upload invitation image: ${upload.error.message}`)

    // Uploading a new image is how an admin REPLACES the active one — it takes
    // over immediately, the same as before. The old file simply isn't deleted;
    // it stays in the gallery for listInvitationImages to surface.
    const { data } = db.storage.from('assets').getPublicUrl(path)
    const field = language === 'ru' ? 'invitation_image_ru' : 'invitation_image_he'
    return this.updateConfig({ [field]: `${data.publicUrl}?v=${Date.now()}` })
  },

  async listInvitationImages(language): Promise<InvitationImage[]> {
    const db = createAdminClient()
    const result = await db.storage
      .from('assets')
      .list(INVITATION_IMAGE_FOLDER(language), { sortBy: { column: 'created_at', order: 'desc' } })
    if (result.error) throw new Error(`list invitation images: ${result.error.message}`)

    return result.data.map((entry) => {
      const path = `${INVITATION_IMAGE_FOLDER(language)}/${entry.name}`
      return {
        path,
        url: db.storage.from('assets').getPublicUrl(path).data.publicUrl,
        uploadedAt: entry.created_at ?? '',
      }
    })
  },

  async selectInvitationImage(language, path): Promise<WeddingConfig> {
    assertOwnFolder(language, path)
    const db = createAdminClient()
    const { data } = db.storage.from('assets').getPublicUrl(path)

    // Cache-busted the same way as a fresh upload: this URL may have been the
    // active one before, and a browser should not serve it from cache as if
    // nothing changed.
    const field = language === 'ru' ? 'invitation_image_ru' : 'invitation_image_he'
    return this.updateConfig({ [field]: `${data.publicUrl}?v=${Date.now()}` })
  },

  async deleteInvitationImage(language, path): Promise<void> {
    assertOwnFolder(language, path)
    const db = createAdminClient()
    const { error } = await db.storage.from('assets').remove([path])
    if (error) throw new Error(`delete invitation image: ${error.message}`)
  },
}

// --- submitRsvp helpers ------------------------------------------------------
// Each does one thing, so submitRsvp reads as a sequence rather than a wall.

async function applyTicks(invite: InviteWithPeople, tickedIds: string[]): Promise<void> {
  const db = createAdminClient()
  const ticked = new Set(tickedIds)

  // Placeholders are managed by count, not by tick — they are always attending.
  const named = invite.attendees.filter((person) => !person.is_placeholder)
  const shouldAttend = named.filter((p) => ticked.has(p.id)).map((p) => p.id)
  const shouldNot = named.filter((p) => !ticked.has(p.id)).map((p) => p.id)

  if (shouldAttend.length) {
    const { error } = await db.from('attendees').update({ is_attending: true }).in('id', shouldAttend)
    if (error) throw new Error(`tick people: ${error.message}`)
  }
  if (shouldNot.length) {
    const { error } = await db.from('attendees').update({ is_attending: false }).in('id', shouldNot)
    if (error) throw new Error(`untick people: ${error.message}`)
  }
}

async function applyPlaceholderPlan(
  invite: InviteWithPeople,
  wantedAdults: number,
  wantedKids: number
): Promise<void> {
  const db = createAdminClient()
  const plan = planPlaceholders(invite.name, invite.attendees, wantedAdults, wantedKids)

  if (plan.deleteIds.length) {
    const { error } = await db.from('attendees').delete().in('id', plan.deleteIds)
    if (error) throw new Error(`remove extra guests: ${error.message}`)
  }
  if (plan.create.length) {
    const { error } = await db.from('attendees').insert(
      plan.create.map((person) => ({
        invite_id: invite.id,
        name: person.name,
        is_child: person.is_child,
        is_attending: true,
        is_placeholder: true,
      }))
    )
    if (error) throw new Error(`add extra guests: ${error.message}`)
  }
}

/** Declining zeroes everything: placeholders deleted, named people unticked. */
async function clearEverything(invite: InviteWithPeople): Promise<void> {
  const db = createAdminClient()

  const doomed = placeholderIds(invite.attendees)
  if (doomed.length) {
    const { error } = await db.from('attendees').delete().in('id', doomed)
    if (error) throw new Error(`remove extra guests: ${error.message}`)
  }

  const { error } = await db
    .from('attendees')
    .update({ is_attending: false })
    .eq('invite_id', invite.id)
  if (error) throw new Error(`clear attendance: ${error.message}`)
}
