'use client'

/**
 * Holds the search / filter / sort state and renders the rows.
 *
 * The rules themselves are pure functions in lib/invite-filters.ts — this
 * component only decides what the current state is.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { InviteRow } from '@/components/admin/invite-row'
import { EmptyState } from '@/components/ui/states'
import { countInvited } from '@/lib/headcount'
import {
  SORT_KEYS,
  filterByRelation,
  filterBySide,
  filterByStatus,
  filterNeedsPhoneCall,
  searchInvites,
  sortInvites,
  type SortKey,
} from '@/lib/invite-filters'
import { strings } from '@/lib/strings'
import {
  INVITE_STATUSES,
  RELATIONS,
  SIDES,
  type InviteStatus,
  type InviteWithPeople,
  type Relation,
  type Side,
  type WeddingConfig,
} from '@/lib/types'

export function InviteTable({
  invites,
  config,
}: {
  invites: InviteWithPeople[]
  /** The whole config, not one template: the row picks by household language. */
  config: WeddingConfig
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<InviteStatus | ''>('')
  const [relation, setRelation] = useState<Relation | ''>('')
  const [side, setSide] = useState<Side | ''>('')
  const [onlyNeedsCall, setOnlyNeedsCall] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('relation')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const visible = useMemo(() => {
    const searched = searchInvites(invites, query)
    const byStatus = filterByStatus(searched, status || null)
    const byRelation = filterByRelation(byStatus, relation || null)
    const bySide = filterBySide(byRelation, side || null)
    const flagged = filterNeedsPhoneCall(bySide, onlyNeedsCall)
    return sortInvites(flagged, sortKey)
  }, [invites, query, status, relation, side, onlyNeedsCall, sortKey])

  /*
   * Clear the selection whenever the visible set changes.
   *
   * Otherwise a row selected under one filter stays selected after you move
   * away from it, and "delete 40" would include rows you can no longer see —
   * exactly the surprise a bulk delete must not have.
   */
  const visibleKey = visible.map((invite) => invite.id).join(',')
  const lastVisibleKey = useRef(visibleKey)
  useEffect(() => {
    if (lastVisibleKey.current !== visibleKey) {
      lastVisibleKey.current = visibleKey
      setSelected(new Set())
    }
  }, [visibleKey])

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allShownSelected = visible.length > 0 && visible.every((i) => selected.has(i.id))

  function toggleAllShown() {
    setSelected(allShownSelected ? new Set() : new Set(visible.map((invite) => invite.id)))
  }

  async function handleBulkDelete() {
    const chosen = visible.filter((invite) => selected.has(invite.id))
    if (chosen.length === 0) return

    // PEOPLE, not rows. "delete 40" understates what a cascade destroys, and a
    // bulk delete is exactly where a vague confirmation gets clicked through.
    const people = chosen.reduce((sum, invite) => sum + countInvited(invite.attendees), 0)
    if (!window.confirm(strings.bulk.confirm(chosen.length, people))) return

    setDeleting(true)
    const response = await fetch('/api/invites/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: chosen.map((invite) => invite.id) }),
    })
    const body = await response.json()
    setDeleting(false)

    if (!body.success) {
      toast.error(body.error || strings.bulk.deleteFailed)
      return
    }
    toast.success(strings.bulk.deleted(body.data.deleted))
    setSelected(new Set())
    router.refresh()
  }

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
          value={relation}
          onChange={(event) => setRelation(event.target.value as Relation | '')}
          aria-label={strings.toolbar.allRelations}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">{strings.toolbar.allRelations}</option>
          {RELATIONS.map((value) => (
            <option key={value} value={value}>
              {strings.relation[value]}
            </option>
          ))}
        </select>

        <select
          value={side}
          onChange={(event) => setSide(event.target.value as Side | '')}
          aria-label={strings.toolbar.allSides}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">{strings.toolbar.allSides}</option>
          {SIDES.map((value) => (
            <option key={value} value={value}>
              {strings.side[value]}
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

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>{strings.toolbar.showing(visible.length, invites.length)}</span>

        {visible.length > 0 ? (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} />
            {strings.bulk.selectAllShown(visible.length)}
          </label>
        ) : null}

        {selected.size > 0 ? (
          <>
            <span>{strings.bulk.selected(selected.size)}</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="rounded border border-danger px-2 py-1 text-danger hover:bg-surface disabled:opacity-50"
            >
              {strings.bulk.delete(selected.size)}
            </button>
          </>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={strings.emptyStates.noResults}
          hint={strings.emptyStates.noResultsHint}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visible.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              config={config}
              selected={selected.has(invite.id)}
              onToggleSelected={toggleSelected}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
