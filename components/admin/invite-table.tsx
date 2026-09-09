'use client'

/**
 * Holds the search / filter / sort state and renders the rows.
 *
 * The rules themselves are pure functions in lib/invite-filters.ts — this
 * component only decides what the current state is.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { FirstInvitePatch } from '@/components/admin/first-invite-controls'
import { InviteRow } from '@/components/admin/invite-row'
import { EmptyState } from '@/components/ui/states'
import { countInvited } from '@/lib/headcount'
import {
  SORT_KEYS,
  filterByLanguage,
  filterByRelation,
  filterBySide,
  filterByStatus,
  filterMissingPhone,
  filterNeedsPhoneCall,
  searchInvites,
  sortInvites,
  type SortKey,
} from '@/lib/invite-filters'
import { coupleSenders } from '@/lib/senders'
import { strings } from '@/lib/strings'
import {
  INVITE_STATUSES,
  LANGUAGES,
  RELATIONS,
  SIDES,
  type InviteStatus,
  type InviteWithPeople,
  type Language,
  type Relation,
  type Side,
  type WeddingConfig,
} from '@/lib/types'

/**
 * The first-invitation toggle is remembered per browser, not in the database
 * (PRD §6.21). It is a view preference for a two-day coordination pass — a
 * config column would need a migration to add and another to retire, and the
 * controls it reveals write to the database on their own.
 */
const FIRST_INVITE_TOGGLE_KEY = 'wedding-rsvp:show-first-invite'

/*
 * The toggle is read through useSyncExternalStore rather than corrected from
 * localStorage in an effect.
 *
 * localStorage does not exist on the server, so reading it during render would
 * make the server and the client disagree; setting state in an effect instead
 * causes a cascading render and React's own lint rule rejects it. This is the
 * documented path: `getServerSnapshot` supplies the pre-hydration value and
 * React re-reads after hydrating.
 *
 * `fallback` covers a private window or blocked site data, where an accessor
 * itself throws — the toggle then works for the session and simply isn't
 * remembered, instead of appearing broken. Reads and writes fail
 * independently: a quota-exhausted browser, or an extension that permits
 * getItem and blocks setItem, throws only on the WRITE, and reading the stored
 * value back would then flip the checkbox straight back to where it was. So a
 * broken write latches, and every later read prefers the in-memory value.
 */
let toggleFallback = false
let toggleStorageBroken = false
const toggleListeners = new Set<() => void>()

function subscribeToggle(onChange: () => void): () => void {
  toggleListeners.add(onChange)
  // 'storage' only fires in OTHER tabs; a write here notifies through the set.
  window.addEventListener('storage', onChange)
  return () => {
    toggleListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readToggle(): boolean {
  if (toggleStorageBroken) return toggleFallback
  try {
    return window.localStorage.getItem(FIRST_INVITE_TOGGLE_KEY) === 'true'
  } catch {
    return toggleFallback
  }
}

/** Hidden is the right pre-hydration state, and the right default. */
function readToggleOnServer(): boolean {
  return false
}

function writeToggle(next: boolean): void {
  toggleFallback = next
  try {
    window.localStorage.setItem(FIRST_INVITE_TOGGLE_KEY, String(next))
  } catch {
    // Not persisted. Latch it, so readToggle stops trusting a stored value
    // that can no longer be updated and the checkbox doesn't spring back.
    toggleStorageBroken = true
  }
  toggleListeners.forEach((listener) => listener())
}

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
  const [language, setLanguage] = useState<Language | ''>('')
  const [onlyNeedsCall, setOnlyNeedsCall] = useState(false)
  const [onlyMissingPhone, setOnlyMissingPhone] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('relation')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const showFirstInvite = useSyncExternalStore(
    subscribeToggle,
    readToggle,
    readToggleOnServer
  )

  /** The two names in couple_names, for every row's sender dropdown. */
  const senders = useMemo(() => coupleSenders(config.couple_names), [config.couple_names])

  /*
   * Optimistic first-invitation values, held HERE rather than in the row.
   *
   * A row unmounts whenever a filter stops matching it or the toolbar toggle is
   * switched off, and these writes deliberately don't refresh the server data
   * (see patchFirstInvite). State inside the row would therefore be discarded
   * on unmount and the row would come back reading "not sent" over a send that
   * did happen — the worst possible direction for a field whose only job is
   * remembering who has already been messaged. This map outlives every row.
   */
  const [firstInvitePatches, setFirstInvitePatches] = useState<Record<string, FirstInvitePatch>>({})

  const patched = useMemo(() => {
    if (Object.keys(firstInvitePatches).length === 0) return invites
    return invites.map((invite) =>
      firstInvitePatches[invite.id] ? { ...invite, ...firstInvitePatches[invite.id] } : invite
    )
  }, [invites, firstInvitePatches])

  /*
   * Applies the value immediately, then writes it.
   *
   * No router.refresh(): with 107 households and a tap per row, re-fetching
   * every invitation per tick is the difference between usable and not, and
   * nothing else on this screen derives from these two fields. A reload shows
   * server truth.
   *
   * `previous` is what the row was displaying, so a failure restores exactly
   * that rather than falling back to the prop — after an earlier successful
   * write the prop is stale, and reverting to it would contradict the database.
   */
  async function patchFirstInvite(
    id: string,
    patch: FirstInvitePatch,
    previous: FirstInvitePatch
  ): Promise<void> {
    setFirstInvitePatches((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

    try {
      const response = await fetch(`/api/invites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.firstInvite.saveFailed)
    } catch (thrown) {
      // Covers a rejected fetch and a non-JSON body too, not just !success:
      // offline or a restarted dev server must never leave a tick standing for
      // a write that did not happen.
      setFirstInvitePatches((current) => ({ ...current, [id]: { ...current[id], ...previous } }))
      toast.error(thrown instanceof Error ? thrown.message : strings.firstInvite.saveFailed)
    }
  }

  const visible = useMemo(() => {
    const searched = searchInvites(patched, query)
    const byStatus = filterByStatus(searched, status || null)
    const byRelation = filterByRelation(byStatus, relation || null)
    const bySide = filterBySide(byRelation, side || null)
    const byLanguage = filterByLanguage(bySide, language || null)
    const flagged = filterNeedsPhoneCall(byLanguage, onlyNeedsCall)
    const missingPhone = filterMissingPhone(flagged, onlyMissingPhone)
    return sortInvites(missingPhone, sortKey)
  }, [
    patched,
    query,
    status,
    relation,
    side,
    language,
    onlyNeedsCall,
    onlyMissingPhone,
    sortKey,
  ])

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
      {/*
        Two full-width rows, deliberately: search and the checkboxes above, the
        filter and sort dropdowns below. One wrapping row put every control
        wherever the window width happened to break, so the same checkbox moved
        position between sessions.
      */}
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={strings.toolbar.searchPlaceholder}
          aria-label={strings.app.search}
          className="min-w-48 flex-1 rounded-md border border-border px-3 py-1.5 text-sm"
        />

        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyNeedsCall}
            onChange={(event) => setOnlyNeedsCall(event.target.checked)}
          />
          {strings.toolbar.onlyNeedsCall}
        </label>

        {/* The rows that can't be messaged at all until a number is typed in. */}
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyMissingPhone}
            onChange={(event) => setOnlyMissingPhone(event.target.checked)}
          />
          {strings.toolbar.onlyMissingPhone}
        </label>

        {/* Reveals the per-row checkbox and sender dropdown (PRD §6.21). */}
        <label
          className="flex items-center gap-1.5 text-sm text-muted"
          title={strings.firstInvite.toggleHint}
        >
          <input
            type="checkbox"
            checked={showFirstInvite}
            onChange={(event) => writeToggle(event.target.checked)}
          />
          {strings.firstInvite.toggle}
        </label>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2">
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
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language | '')}
          aria-label={strings.toolbar.allLanguages}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">{strings.toolbar.allLanguages}</option>
          {LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {strings.language[value]}
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
              showFirstInvite={showFirstInvite}
              senders={senders}
              onPatchFirstInvite={patchFirstInvite}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
