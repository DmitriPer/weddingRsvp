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

export interface DataStore {
  // --- invites -------------------------------------------------------------
  listInvites(): Promise<InviteWithPeople[]>
  getInvite(id: string): Promise<InviteWithHistory | null>
  getInviteByToken(token: string): Promise<InviteWithPeople | null>
  createInvite(input: CreateInviteInput): Promise<Invite>
  updateInvite(id: string, input: UpdateInviteInput): Promise<Invite | null>
  deleteInvite(id: string): Promise<boolean>
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

  // --- config --------------------------------------------------------------
  getConfig(): Promise<WeddingConfig>
  updateConfig(input: Partial<WeddingConfig>): Promise<WeddingConfig>
}
