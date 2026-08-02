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
import { ImportPanel } from '@/components/admin/import-panel'
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
      {/*
        * The bar (PRD §6.11). Every answer tile shows PEOPLE large and
        * INVITATIONS small, because the two answer different questions: people
        * is what the caterer is quoted on, invitations is how many messages are
        * still owed.
        *
        * The glyphs are the same ones a person's row already uses — ○ waiting,
        * ✓ coming — so the bar and the list speak one language.
        */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label={strings.stats.records} value={stats.totalInvites} />
        <Tile label={strings.stats.invited} value={stats.totalInvitedPeople} />
        <Tile
          label={strings.stats.awaiting}
          value={stats.totalAwaitingPeople}
          sub={strings.stats.invites(stats.totalAwaitingInvites)}
          icon="○"
          tone="text-muted"
        />
        <Tile
          label={strings.stats.coming}
          value={stats.totalAttending}
          sub={strings.stats.invites(stats.totalAttendingInvites)}
          icon="✓"
          tone="text-accent"
        />
        <Tile
          label={strings.stats.notComing}
          value={stats.totalDeclinedPeople}
          sub={strings.stats.invites(stats.totalDeclined)}
          icon="✕"
          tone="text-danger"
        />
      </section>

      {/*
        * Closed by default and rendered by the browser, not React: a <details>
        * needs no client component and no state for something opened rarely.
        */}
      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer text-sm text-muted">
          {strings.stats.detailsTitle}
        </summary>

        {stats.totalAttending === 0 ? (
          <p className="mt-3 text-sm text-muted">{strings.stats.noneComing}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4 text-sm">
            <div className="flex gap-6">
              <Figure label={strings.stats.adults} value={stats.totalAdults} />
              <Figure label={strings.stats.kids} value={stats.totalKids} />
            </div>

            {/* Apart, with a border: already counted inside מגיעים, not an addition. */}
            <div className="border-s border-border ps-4">
              <Figure label={strings.stats.extras} value={stats.totalExtras} />
              <p className="text-xs text-muted">{strings.stats.extrasHint}</p>
            </div>
          </div>
        )}
      </details>

      {flaggedCount > 0 ? (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-warning">
          {strings.guests.needsPhoneCall}: {flaggedCount}
        </p>
      ) : null}

      <AddInviteForm />

      <ImportPanel />

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

function Tile({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string
  value: number
  /** The same figure in invitations. Absent on tiles that are already rows. */
  sub?: string
  icon?: string
  tone?: string
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        {icon ? (
          <span aria-hidden className={tone}>
            {icon}
          </span>
        ) : null}
        {label}
      </p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span className="text-muted">{label} </span>
      <span className="font-semibold">{value}</span>
    </p>
  )
}
