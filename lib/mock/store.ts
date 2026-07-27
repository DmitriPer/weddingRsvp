import type { Invite, Response, ResponseHistory } from '@/lib/types'
import { seedInvites, seedResponses, seedResponseHistory } from './seed-data'

interface MockDb {
  invites: Invite[]
  responses: Response[]
  responseHistory: ResponseHistory[]
}

// Cached on globalThis so Next.js dev-server Fast Refresh doesn't wipe state mid-session.
// A full `npm run dev` restart resets to seed data — expected, not a bug.
const g = globalThis as unknown as { __mockDb?: MockDb }

export const mockDb: MockDb =
  g.__mockDb ??
  (g.__mockDb = {
    invites: structuredClone(seedInvites),
    responses: structuredClone(seedResponses),
    responseHistory: structuredClone(seedResponseHistory),
  })
