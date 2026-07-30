/**
 * Invitees tab — the main admin screen.
 *
 * Stats live here as tiles rather than on their own page: they are four numbers
 * and read better beside the list.
 *
 * Still to come (Phase 5): search, sort, expandable people rows, edit/delete,
 * the history modal, copy-link, and the wa.me button.
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { listInvites } from '@/lib/data'
import { computeStats } from '@/lib/stats'
import { countAttending } from '@/lib/headcount'
import { needsPhoneCall } from '@/lib/status'
import { AddInviteForm } from '@/components/admin/add-invite-form'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export default async function InviteesPage() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const invites = await listInvites()
  const stats = computeStats(invites)
  const flaggedCount = invites.filter((invite) =>
    needsPhoneCall(invite.status, invite.contact_attempts)
  ).length

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={strings.admin.tabs.invitees} value={stats.totalInvites} />
        <Tile label={strings.guests.adults} value={stats.totalAdults} />
        <Tile label={strings.guests.kids} value={stats.totalKids} />
        <Tile label={strings.guests.declined} value={stats.totalDeclined} />
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
        <ul className="divide-y divide-border rounded-lg border border-border">
          {invites.map((invite) => {
            const { total } = countAttending(invite.attendees)
            const namedPeople = invite.attendees.filter((person) => !person.is_placeholder)
            const extras = invite.attendees.length - namedPeople.length

            return (
              <li key={invite.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate">{invite.name}</p>
                    <p className="ltr-nums truncate text-sm text-muted">{invite.phone ?? '—'}</p>
                  </div>
                  <div className="shrink-0 text-left text-sm text-muted">
                    <p>{strings.status[invite.status]}</p>
                    <p>{total > 0 ? strings.guests.people(total) : strings.guests.noPeople}</p>
                  </div>
                </div>

                {invite.attendees.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-sm">
                    {namedPeople.map((person) => (
                      <li key={person.id} className="flex justify-between gap-3 text-muted">
                        <span className="truncate">
                          {person.name}
                          {person.is_child ? ` (${strings.inviteForm.child})` : ''}
                        </span>
                        <span className="shrink-0">
                          {person.is_attending ? '✓' : '—'}
                        </span>
                      </li>
                    ))}
                    {extras > 0 ? (
                      <li className="text-muted">
                        + {strings.guests.people(extras)} ({strings.guests.placeholder})
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
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
