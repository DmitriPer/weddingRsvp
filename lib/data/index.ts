import 'server-only'

/**
 * The data layer's front door. Callers import from here and never see a
 * Supabase client (PRD §8, docs/conventions.md §5).
 *
 * There was once a second, in-memory implementation behind a MOCK_MODE flag.
 * It was dropped once the real database existed: two implementations of the
 * same rules meant hand-mirroring Postgres cascade and set-null semantics, and
 * anything hand-mirrored eventually drifts. Test data now lives in
 * supabase/migrations/004_seed_test_data.sql, where Postgres enforces the rules.
 */

export type {
  BulkCreateResult,
  DataStore,
  NewInviteWithPeople,
  RsvpResult,
} from '@/lib/data/types'

import { supabaseStore } from '@/lib/data/supabase'

const store = supabaseStore

export const listInvites = store.listInvites.bind(store)
export const getInvite = store.getInvite.bind(store)
export const getInviteByToken = store.getInviteByToken.bind(store)
export const createInvite = store.createInvite.bind(store)
export const createInvitesWithPeople = store.createInvitesWithPeople.bind(store)
export const updateInvite = store.updateInvite.bind(store)
export const deleteInvite = store.deleteInvite.bind(store)
export const deleteInvites = store.deleteInvites.bind(store)
export const findInvitesByPhone = store.findInvitesByPhone.bind(store)

export const markOpened = store.markOpened.bind(store)
export const markContacted = store.markContacted.bind(store)

export const createAttendee = store.createAttendee.bind(store)
export const updateAttendee = store.updateAttendee.bind(store)
export const deleteAttendee = store.deleteAttendee.bind(store)

export const submitRsvp = store.submitRsvp.bind(store)
export const listHistory = store.listHistory.bind(store)

export const listTables = store.listTables.bind(store)
export const createTable = store.createTable.bind(store)
export const updateTable = store.updateTable.bind(store)
export const deleteTable = store.deleteTable.bind(store)

export const getConfig = store.getConfig.bind(store)
export const updateConfig = store.updateConfig.bind(store)
