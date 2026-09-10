/**
 * The contract both backing stores satisfy (PRD §8).
 *
 * Callers use these functions and never see a Supabase client. Because both
 * implementations are typed against this interface, a missing method is a
 * compile error rather than a runtime surprise.
 *
 * This layer persists. It holds no business rules — those live in lib/.
 */

import type {
  Attendee,
  BudgetItem,
  CreateBudgetItemInput,
  UpdateBudgetItemInput,
  Language,
  Relation,
  Side,
  CreateAttendeeInput,
  CreateInviteInput,
  CreateTableInput,
  Invite,
  InviteWithHistory,
  InviteWithPeople,
  ResponseHistoryEntry,
  RsvpSubmission,
  SeatingTable,
  UpdateAttendeeInput,
  UpdateInviteInput,
  UpdateTableInput,
  WeddingConfig,
} from '@/lib/types'

/**
 * Defined in lib/types.ts beside RsvpSubmission and re-exported here, so the
 * DataStore interface below still reads as one complete contract. The guest's
 * confirmation screen needs this type and may not import from lib/data.
 */
export type { RsvpResult } from '@/lib/types'
import type { RsvpResult } from '@/lib/types'

/** One household from the spreadsheet: the invitation, and its named people. */
export interface NewInviteWithPeople {
  name: string
  phone: string | null
  side: Side | null
  relation: Relation | null
  language: Language
  people: { name: string; is_child: boolean }[]
}

export interface BulkCreateResult {
  invitesCreated: number
  peopleCreated: number
}

/** One previously-uploaded invitation backdrop image (PRD §6.16). */
export interface InvitationImage {
  /** The Storage object path, e.g. "invitation/he/1735689600000-a1b2c3.jpg". */
  path: string
  url: string
  uploadedAt: string
}

export interface DataStore {
  // --- invites -------------------------------------------------------------
  listInvites(): Promise<InviteWithPeople[]>
  getInvite(id: string): Promise<InviteWithHistory | null>
  getInviteByToken(token: string): Promise<InviteWithPeople | null>
  createInvite(input: CreateInviteInput): Promise<Invite>
  /**
   * Bulk create, for the spreadsheet import (PRD §6.7). Two round trips rather
   * than the ~450 that looping createInvite + createAttendee would take.
   */
  createInvitesWithPeople(rows: NewInviteWithPeople[]): Promise<BulkCreateResult>
  updateInvite(id: string, input: UpdateInviteInput): Promise<Invite | null>
  deleteInvite(id: string): Promise<boolean>
  /** Multi-select delete (PRD §6.6). Postgres cascades to people and history. */
  deleteInvites(ids: string[]): Promise<number>
  /** Duplicate phone warning (PRD §6.6) — a warning, never a block. */
  findInvitesByPhone(phone: string, excludeId?: string): Promise<Invite[]>

  // --- status transitions --------------------------------------------------
  /** The guest's browser reported a real view. Never called server-side. */
  markOpened(id: string): Promise<Invite | null>
  /** The admin tapped wa.me: attempts + 1, timestamp, added → pending. */
  markContacted(id: string): Promise<Invite | null>

  // --- people --------------------------------------------------------------
  createAttendee(input: CreateAttendeeInput): Promise<Attendee>
  updateAttendee(id: string, input: UpdateAttendeeInput): Promise<Attendee | null>
  deleteAttendee(id: string): Promise<boolean>

  // --- the guest's answer --------------------------------------------------
  submitRsvp(submission: RsvpSubmission): Promise<RsvpResult | null>
  listHistory(inviteId: string): Promise<ResponseHistoryEntry[]>

  // --- seating -------------------------------------------------------------
  listTables(): Promise<SeatingTable[]>
  createTable(input: CreateTableInput): Promise<SeatingTable>
  updateTable(id: string, input: UpdateTableInput): Promise<SeatingTable | null>
  deleteTable(id: string): Promise<boolean>

  // --- budget --------------------------------------------------------------
  /** Expenses and income (PRD §6.22). Full prices are derived, not stored. */
  listBudgetItems(): Promise<BudgetItem[]>
  createBudgetItem(input: CreateBudgetItemInput): Promise<BudgetItem>
  updateBudgetItem(id: string, input: UpdateBudgetItemInput): Promise<BudgetItem | null>
  deleteBudgetItem(id: string): Promise<boolean>

  // --- config --------------------------------------------------------------
  getConfig(): Promise<WeddingConfig>
  updateConfig(input: Partial<WeddingConfig>): Promise<WeddingConfig>
  /**
   * The guest page's backdrop image, per language (PRD §6.16). A gallery, not
   * a single slot — uploads accumulate, never overwrite. API routes never
   * touch Storage directly; everything below goes through here.
   */
  /** Uploads a new image under a unique path and makes it the active one. */
  uploadInvitationImage(
    language: Language,
    bytes: Uint8Array,
    contentType: string
  ): Promise<WeddingConfig>
  /** Every image previously uploaded for this language, newest first. */
  listInvitationImages(language: Language): Promise<InvitationImage[]>
  /** Makes an already-uploaded image active again. No Storage write. */
  selectInvitationImage(language: Language, path: string): Promise<WeddingConfig>
  /**
   * Removes an image from Storage permanently. Refusing to delete the
   * currently-active image is the CALLER's job (the API route) — this layer
   * holds no business rules, it does what it's told.
   */
  deleteInvitationImage(language: Language, path: string): Promise<void>
}
