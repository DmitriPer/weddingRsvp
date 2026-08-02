/**
 * Invitees tab — the main admin screen.
 *
 * Stats live here as tiles rather than on their own page: they are four numbers
 * and read better beside the list.
 *
 * Still to come (Phase 5): search, sort, the history modal, copy-link, and the
 * wa.me button.
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { getConfig, listInvites } from '@/lib/data'
import { computeStats } from '@/lib/stats'
import { needsPhoneCall } from '@/lib/status'
import { AddInviteForm } from '@/components/admin/add-invite-form'
import { InviteTable } from '@/components/admin/invite-table'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export default async function InviteesPage() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  // One round trip each; the template is needed for the wa.me buttons.
  const [invites, config] = await Promise.all([listInvites(), getConfig()])
  const stats = computeStats(invites)
  const flaggedCount = invites.filter((invite) =>
    needsPhoneCall(invite.status, invite.contact_attempts)
  ).length

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* People, not invitations: a household of two counts as two. */}
        <Tile label={strings.admin.tabs.invitees} value={stats.totalInvitedPeople} />
        <Tile label={strings.guests.adults} value={stats.totalAdults} />
        <Tile label={strings.guests.kids} value={stats.totalKids} />
        <Tile label={strings.guests.declined} value={stats.totalDeclinedPeople} />
      </section>

      {flaggedCount > 0 ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-warning">
          {strings.guests.needsPhoneCall}: {flaggedCount}
        </p>
      ) : null}

      <AddInviteForm />

      {invites.length === 0 ? (
        <EmptyState
          title={strings.emptyStates.noInvites}
          hint={strings.emptyStates.noInvitesHint}
        />
      ) : (
        <InviteTable invites={invites} config={config} />
      )}
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
