import 'server-only'

/**
 * The backing store. Uses the service-role client, because every table is RLS
 * deny-all (PRD §7.2) — no other key can read or write project data.
 *
 * Persistence only. Business rules live in lib/: headcount, status transitions,
 * and placeholder planning are all imported, never re-derived here.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { countAttending, householdAnswer } from '@/lib/headcount'
import { statusAfterContact, statusAfterOpen, statusAfterSubmit } from '@/lib/status'
import { planPlaceholders, placeholderIds } from '@/lib/placeholders'
import { nowIso } from '@/lib/datetime'
import { losesSeat } from '@/lib/seating'
import { isUuid } from '@/lib/validation'
import type {
  Answer,
  Attendee,
  DriveConnection,
  HistorySource,
  WeddingPhoto,
  BingoSquare,
  BudgetItem,
  CreateAttendeeInput,
  CreateBingoSquareInput,
  UpdateBingoSquareInput,
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

  async markContacted(id, { countAttempt = true } = {}): Promise<Invite | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()

    if (!countAttempt) {
      // Not a follow-up: the status and the count that drives "needs a phone
      // call" stay exactly as they are.
      const { data, error } = await db
        .from('invites')
        .update({ last_contacted_at: nowIso() })
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw new Error(`mark contacted: ${error.message}`)
      return (data as Invite | null) ?? null
    }

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
          is_infant: input.is_infant ?? false,
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
    const invite = await this.getInviteByToken(submission.token)
    if (!invite) return null

    // Every person's own answer is overwritten from the form: the guest answers
    // for the whole household (docs/admin-answer-and-calls-PRD.md §5).
    if (submission.answer === 'yes') {
      await applyTicks(invite, submission.attendingIds)
      await applyPlaceholderPlan(invite, submission.extraAdults, submission.extraKids)
    } else {
      // 'no' and 'undecided' both leave nobody attending: see parseRsvpSubmission.
      await clearEverything(invite, submission.answer)
    }

    return saveHouseholdAnswer(invite, submission.answer, { source: 'guest', personName: null })
  },

  async setPersonAnswer(personId, answer): Promise<RsvpResult | null> {
    if (!isUuid(personId)) return null
    const db = createAdminClient()

    const { data: person, error } = await db
      .from('attendees')
      .update({ answer, is_attending: answer === 'yes', ...seatClearing(answer) })
      .eq('id', personId)
      .select('invite_id, name')
      .maybeSingle()
    if (error) throw new Error(`save person answer: ${error.message}`)
    if (!person) return null

    // Re-read with the change applied: the household answer is derived from it.
    const invite = await this.getInvite(person.invite_id)
    if (!invite) return null

    // Never null here: this person has just answered.
    const household = householdAnswer(invite.attendees) ?? answer
    return saveHouseholdAnswer(invite, household, { source: 'admin', personName: person.name })
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
      // created_at breaks ties: older rows can share a sort_order, and without
      // it their order — and so their board numbers — could change per load.
      await db
        .from('tables')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      'list tables'
    ) as SeatingTable[]
  },

  async createTable(input: CreateTableInput): Promise<SeatingTable> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('tables')
        /*
         * Spread the validated input rather than naming columns one by one.
         * Naming them meant `shape` was silently dropped when it was added in
         * migration 011: every table saved as the default 'round' however it
         * was created, and the only symptom was a floor plan of identical
         * circles. parseCreateTable is the allow-list; this does not need to be
         * a second one.
         */
        .insert({ ...input, sort_order: input.sort_order ?? 0 })
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
          child_amount: input.child_amount ?? null,
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

  /*
   * Bingo squares (docs/games-bingo-PRD.md §4). Same ordering rule as budget
   * items: sort_order, then created_at so same-order rows never reshuffle.
   */
  async listBingoSquares(): Promise<BingoSquare[]> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('bingo_squares')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      'list bingo squares'
    ) as BingoSquare[]
  },

  async createBingoSquare(input: CreateBingoSquareInput): Promise<BingoSquare> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('bingo_squares')
        .insert({
          text_he: input.text_he,
          text_ru: input.text_ru,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single(),
      'create bingo square'
    ) as BingoSquare
  },

  async updateBingoSquare(id, input: UpdateBingoSquareInput): Promise<BingoSquare | null> {
    if (!isUuid(id)) return null
    const db = createAdminClient()
    const { data, error } = await db
      .from('bingo_squares')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw new Error(`update bingo square: ${error.message}`)
    return (data as BingoSquare) ?? null
  },

  async deleteBingoSquare(id): Promise<boolean> {
    if (!isUuid(id)) return false
    const db = createAdminClient()
    // Nothing references a square, so this cascades to nothing.
    const { data, error } = await db.from('bingo_squares').delete().eq('id', id).select('id')
    if (error) throw new Error(`delete bingo square: ${error.message}`)
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

  /*
   * Guest photos (docs/wedding-photos-PRD.md). The photos live in Google
   * Drive; this only keeps the connection and the bookkeeping rows.
   */
  async getDriveConnection(): Promise<DriveConnection | null> {
    const db = createAdminClient()
    const { data, error } = await db
      .from('google_drive')
      .select('refresh_token, folder_id, account_email, connected_at')
      .eq('id', true)
      .maybeSingle()
    if (error) throw new Error(`load drive connection: ${error.message}`)
    return (data as DriveConnection) ?? null
  },

  async saveDriveConnection(input): Promise<void> {
    const db = createAdminClient()
    const { error } = await db
      .from('google_drive')
      .upsert({ id: true, ...input, connected_at: nowIso() }, { onConflict: 'id' })
    if (error) throw new Error(`save drive connection: ${error.message}`)
  },

  async clearDriveConnection(): Promise<void> {
    const db = createAdminClient()
    const { error } = await db.from('google_drive').delete().eq('id', true)
    if (error) throw new Error(`clear drive connection: ${error.message}`)
  },

  async reservePhoto(uploaderName, sizeBytes): Promise<WeddingPhoto> {
    const db = createAdminClient()
    return unwrap(
      await db
        .from('wedding_photos')
        .insert({ uploader_name: uploaderName, size_bytes: sizeBytes })
        .select()
        .single(),
      'reserve photo'
    ) as WeddingPhoto
  },

  async attachDriveFile(id, driveFileId, sizeBytes): Promise<void> {
    const db = createAdminClient()
    const { error } = await db
      .from('wedding_photos')
      .update({ drive_file_id: driveFileId, size_bytes: sizeBytes })
      .eq('id', id)
    if (error) throw new Error(`attach drive file: ${error.message}`)
  },

  async releasePhoto(id): Promise<void> {
    const db = createAdminClient()
    // Only an unfinished reservation — never a photo that reached Drive.
    const { error } = await db.from('wedding_photos').delete().eq('id', id).is('drive_file_id', null)
    if (error) throw new Error(`release photo: ${error.message}`)
  },

  async countRecentPhotos(seconds): Promise<number> {
    const db = createAdminClient()
    const since = new Date(Date.now() - seconds * 1000).toISOString()
    const { count, error } = await db
      .from('wedding_photos')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (error) throw new Error(`count recent photos: ${error.message}`)
    return count ?? 0
  },

  async photoStats(): Promise<{ count: number; bytes: number }> {
    const db = createAdminClient()
    // PostgREST caps a response at 1000 rows and has no SUM without enabling
    // aggregates, so sizes are read a page at a time. A few thousand at most.
    let bytes = 0
    let count = 0
    for (let from = 0; ; from += 1000) {
      const page = unwrap(
        await db
          .from('wedding_photos')
          .select('size_bytes')
          // Only photos that reached Drive; a reservation mid-upload isn't one.
          .not('drive_file_id', 'is', null)
          .order('id')
          .range(from, from + 999),
        'photo stats'
      ) as { size_bytes: number }[]
      count += page.length
      bytes += page.reduce((sum, row) => sum + row.size_bytes, 0)
      if (page.length < 1000) break
    }
    return { count, bytes }
  },

  async regeneratePhotoKey(): Promise<WeddingConfig> {
    return this.updateConfig({ photo_upload_key: crypto.randomUUID() })
  },
}

// --- submitRsvp helpers ------------------------------------------------------
// Each does one thing, so submitRsvp reads as a sequence rather than a wall.

/**
 * The household half of any answer: the history row and the invite's own
 * answer, status and timestamps. Shared by the guest's submission and the
 * admin's per-person change, so both move status and write history the same
 * way. The people must already be written; this re-reads them for the snapshot.
 */
async function saveHouseholdAnswer(
  invite: InviteWithPeople,
  answer: Answer,
  meta: { source: HistorySource; personName: string | null }
): Promise<RsvpResult> {
  const db = createAdminClient()

  /*
   * The legacy boolean, written alongside `answer` so migration 010 stays
   * reversible for the two answers it can express. 'undecided' has no boolean
   * to be, which is the whole reason `answer` exists. A future migration could
   * drop the column (011 turned out to be table shape); this line goes with it.
   */
  const legacyAttending = answer === 'undecided' ? null : answer === 'yes'

  // Re-read: the rows just changed, and the snapshot must match what was stored.
  const attendees = await fetchAttendees(invite.id)
  const { adults, kids } = countAttending(attendees)
  const timestamp = nowIso()

  const historyResult = await db.from('response_history').insert({
    invite_id: invite.id,
    answer,
    attending: legacyAttending,
    adult_count: adults,
    kid_count: kids,
    submitted_at: timestamp,
    source: meta.source,
    person_name: meta.personName,
  })
  if (historyResult.error) throw new Error(`append history: ${historyResult.error.message}`)

  const updated = unwrap(
    await db
      .from('invites')
      .update({
        answer,
        attending: legacyAttending,
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
}

async function applyTicks(invite: InviteWithPeople, tickedIds: string[]): Promise<void> {
  const db = createAdminClient()
  const ticked = new Set(tickedIds)

  // Placeholders are managed by count, not by tick — they are always attending.
  const named = invite.attendees.filter((person) => !person.is_placeholder)
  const shouldAttend = named.filter((p) => ticked.has(p.id)).map((p) => p.id)
  const shouldNot = named.filter((p) => !ticked.has(p.id)).map((p) => p.id)

  if (shouldAttend.length) {
    const { error } = await db
      .from('attendees')
      .update({ is_attending: true, answer: 'yes' })
      .in('id', shouldAttend)
    if (error) throw new Error(`tick people: ${error.message}`)
  }
  if (shouldNot.length) {
    // Unticked in a household that said yes is this person's no, so they also
    // give up their table (lib/seating.ts losesSeat).
    const { error } = await db
      .from('attendees')
      .update({ is_attending: false, answer: 'no', ...seatClearing('no') })
      .in('id', shouldNot)
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
        answer: 'yes',
        is_placeholder: true,
      }))
    )
    if (error) throw new Error(`add extra guests: ${error.message}`)
  }
}

/**
 * The `table_id` part of an attendance update: cleared when the answer takes
 * the seat away, absent otherwise so an undecided person keeps theirs.
 */
function seatClearing(personAnswer: Answer): { table_id?: null } {
  return losesSeat(personAnswer) ? { table_id: null } : {}
}

/**
 * Declining zeroes everything: placeholders deleted, named people unticked.
 * A no also clears everyone's table; 'undecided' keeps the seats.
 */
async function clearEverything(invite: InviteWithPeople, answer: Answer): Promise<void> {
  const db = createAdminClient()

  const doomed = placeholderIds(invite.attendees)
  if (doomed.length) {
    const { error } = await db.from('attendees').delete().in('id', doomed)
    if (error) throw new Error(`remove extra guests: ${error.message}`)
  }

  const { error } = await db
    .from('attendees')
    .update({ is_attending: false, answer, ...seatClearing(answer) })
    .eq('invite_id', invite.id)
  if (error) throw new Error(`clear attendance: ${error.message}`)
}
