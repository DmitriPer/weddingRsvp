'use client'

/**
 * Holds the search / filter / sort state and renders the rows.
 *
 * The rules themselves are pure functions in lib/invite-filters.ts — this
 * component only decides what the current state is.
 */

import { useMemo, useState } from 'react'
import { InviteRow } from '@/components/admin/invite-row'
import { EmptyState } from '@/components/ui/states'
import {
  SORT_KEYS,
  filterByStatus,
  filterNeedsPhoneCall,
  searchInvites,
  sortInvites,
  type SortKey,
} from '@/lib/invite-filters'
import { strings } from '@/lib/strings'
import { INVITE_STATUSES, type InviteStatus, type InviteWithPeople } from '@/lib/types'

export function InviteTable({
  invites,
  inviteTemplate,
}: {
  invites: InviteWithPeople[]
  inviteTemplate: string
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<InviteStatus | ''>('')
  const [onlyNeedsCall, setOnlyNeedsCall] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')

  const visible = useMemo(() => {
    const searched = searchInvites(invites, query)
    const byStatus = filterByStatus(searched, status || null)
    const flagged = filterNeedsPhoneCall(byStatus, onlyNeedsCall)
    return sortInvites(flagged, sortKey)
  }, [invites, query, status, onlyNeedsCall, sortKey])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={strings.toolbar.searchPlaceholder}
          aria-label={strings.app.search}
          className="min-w-48 flex-1 rounded-md border border-border px-3 py-1.5 text-sm"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as InviteStatus | '')}
          aria-label={strings.toolbar.allStatuses}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">{strings.toolbar.allStatuses}</option>
          {INVITE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {strings.status[value]}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          aria-label={strings.toolbar.sortBy}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {strings.toolbar.sortBy}: {strings.toolbar.sort[key]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyNeedsCall}
            onChange={(event) => setOnlyNeedsCall(event.target.checked)}
          />
          {strings.toolbar.onlyNeedsCall}
        </label>
      </div>

      <p className="text-xs text-muted">{strings.toolbar.showing(visible.length, invites.length)}</p>

      {visible.length === 0 ? (
        <EmptyState
          title={strings.emptyStates.noResults}
          hint={strings.emptyStates.noResultsHint}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visible.map((invite) => (
            <InviteRow key={invite.id} invite={invite} inviteTemplate={inviteTemplate} />
          ))}
        </ul>
      )}
    </div>
  )
}
