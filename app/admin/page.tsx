/**
 * Invitees tab — the main admin screen.
 *
 * Phase 4 shows a live summary, which proves the whole stack end to end:
 * proxy → session → page → data layer → Postgres. Phase 5 replaces this with
 * the real table (search, sort, sub-rows, wa.me).
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { listInvites } from '@/lib/data'
import { computeStats } from '@/lib/stats'
import { countAttending } from '@/lib/headcount'
import { needsPhoneCall } from '@/lib/status'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export default async function InviteesPage() {
  // proxy.ts already gated this (lock #1); checking again costs nothing and
  // means the page is safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const invites = await listInvites()

  if (invites.length === 0) {
    return <EmptyState title={strings.emptyStates.noInvites} hint={strings.emptyStates.noInvitesHint} />
  }

  const stats = computeStats(invites)
  const flagged = invites.filter((invite) => needsPhoneCall(invite.status, invite.contact_attempts))

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="מוזמנים" value={stats.totalInvites} />
        <Tile label={strings.guests.adults} value={stats.totalAdults} />
        <Tile label={strings.guests.kids} value={stats.totalKids} />
        <Tile label={strings.guests.declined} value={stats.totalDeclined} />
      </section>

      {flagged.length > 0 ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-warning">
          {strings.guests.needsPhoneCall}: {flagged.length}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {invites.map((invite) => {
          const { total } = countAttending(invite.attendees)
          return (
            <li key={invite.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate">{invite.name}</p>
                <p className="ltr-nums truncate text-sm text-muted">{invite.phone ?? '—'}</p>
              </div>
              <div className="shrink-0 text-right text-sm text-muted">
                <p>{strings.status[invite.status]}</p>
                <p>{total > 0 ? strings.guests.people(total) : strings.guests.noPeople}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted">{strings.admin.comingSoon}: חיפוש, מיון, עריכה, WhatsApp</p>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
