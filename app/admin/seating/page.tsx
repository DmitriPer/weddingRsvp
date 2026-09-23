/**
 * Seating tab — tables, and who sits at them (PRD §6.17).
 *
 * Reads the guest list and the tables and hands both to the board. It must
 * never work out who is attending itself: that comes from lib/seating.ts, which
 * asks lib/headcount.ts, the single definition of who is coming.
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { listInvites, listTables } from '@/lib/data'
import { SeatingBoard } from '@/components/admin/seating-board'
import { TableManager } from '@/components/admin/table-manager'
import { SeatingMap } from '@/components/admin/seating-map'
import { SeatingPrintout } from '@/components/admin/seating-printout'

export const dynamic = 'force-dynamic'

export default async function Page() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const [invites, tables] = await Promise.all([listInvites(), listTables()])

  return (
    <div className="space-y-4">
      {/*
        * Order follows the work: define the tables, seat people, then arrange
        * the room. The map is last because it is the step you return to once
        * the seating is roughly right, not the one you start from.
        */}
      <TableManager tables={tables} />
      <SeatingBoard invites={invites} tables={tables} />
      <SeatingMap invites={invites} tables={tables} />
      <SeatingPrintout invites={invites} tables={tables} />
    </div>
  )
}
