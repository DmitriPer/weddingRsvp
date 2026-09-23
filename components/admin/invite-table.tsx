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
  ANSWER_FILTERS,
  DEFAULT_SORT_DIRECTION,
  SORT_KEYS,
  filterByLanguage,
  filterByAnswer,
  filterByRelation,
  filterBySent,
  filterBySide,
  filterByStatus,
  filterMissingPhone,
  filterNeedsPhoneCall,
  searchInvites,
  sortInvites,
  type AnswerFilter,
  type SentFilter,
  type SortDirection,
  type SortKey,
} from '@/lib/invite-filters'
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
export function InviteTable({
  invites,
  config,
}: {
  invites: InviteWithPeople[]
  /** The whole config, not one template: the row picks by household language. */
  config: WeddingConfig
}) {
  const [query, setQuery] = useState('')
  /** Empty means every status — see filterByStatus. */
  const [statuses, setStatuses] = useState<InviteStatus[]>([])
  /** Empty means every answer — see filterByAnswer. */
  const [answers, setAnswers] = useState<AnswerFilter[]>([])
  const [sent, setSent] = useState<SentFilter | ''>('')
  const [relation, setRelation] = useState<Relation | ''>('')
  const [side, setSide] = useState<Side | ''>('')
  const [language, setLanguage] = useState<Language | ''>('')
  const [onlyNeedsCall, setOnlyNeedsCall] = useState(false)
  const [onlyMissingPhone, setOnlyMissingPhone] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('relation')
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION.relation
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const router = useRouter()

  const visible = useMemo(() => {
    const searched = searchInvites(invites, query)
    const byStatus = filterByStatus(searched, statuses)
    const byAnswer = filterByAnswer(byStatus, answers)
    const bySent = filterBySent(byAnswer, sent || null)
    const byRelation = filterByRelation(bySent, relation || null)
    const bySide = filterBySide(byRelation, side || null)
    const byLanguage = filterByLanguage(bySide, language || null)
    const flagged = filterNeedsPhoneCall(byLanguage, onlyNeedsCall)
    const missingPhone = filterMissingPhone(flagged, onlyMissingPhone)
    return sortInvites(missingPhone, sortKey, sortDirection)
  }, [
    invites,
    query,
    statuses,
    answers,
    sent,
    relation,
    side,
    language,
    onlyNeedsCall,
    onlyMissingPhone,
    sortKey,
    sortDirection,
  ])

  /**
   * Downloads the seating sheet for the rows currently on screen.
   *
   * A POST, so it cannot be a plain <a download>: the ids go in the body,
   * which is what makes the file match the filters without this component
   * having to describe them in a query string.
   */
  async function exportSeating() {
    setExporting(true)
    try {
      const response = await fetch('/api/invites/export/seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: visible.map((invite) => invite.id) }),
      })
      if (!response.ok) throw new Error(strings.toolbar.exportFailed)

      // Object URL rather than a data: URL — a few hundred rows is comfortably
      // past the length some browsers will accept in a href.
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'wedding-seating.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : strings.toolbar.exportFailed)
    } finally {
      setExporting(false)
    }
  }

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

      </div>

      <div className="flex w-full flex-wrap items-center gap-2">
        {/*
          * Chips rather than a <select multiple>: multi-select needs ctrl-click
          * to combine and ctrl-click to deselect, which nobody discovers, and
          * it collapses to an unusable scroller on a narrow screen. Five short
          * labels fit on one line here.
          */}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={strings.toolbar.allStatuses}>
          <button
            type="button"
            onClick={() => setStatuses([])}
            aria-pressed={statuses.length === 0}
            className={`rounded-md border px-2 py-1.5 text-sm ${
              statuses.length === 0
                ? 'border-bloom-ink bg-bloom-ink/10 text-bloom-strong'
                : 'border-border text-muted'
            }`}
          >
            {strings.toolbar.allStatuses}
          </button>

          {INVITE_STATUSES.map((value) => {
            const on = statuses.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setStatuses((current) =>
                    current.includes(value)
                      ? current.filter((each) => each !== value)
                      : [...current, value]
                  )
                }
                aria-pressed={on}
                className={`rounded-md border px-2 py-1.5 text-sm ${
                  on
                    ? 'border-bloom-ink bg-bloom-ink/10 text-bloom-strong'
                    : 'border-border text-muted'
                }`}
              >
                {strings.status[value]}
              </button>
            )
          })}
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={strings.toolbar.allAnswers}
        >
          <button
            type="button"
            onClick={() => setAnswers([])}
            aria-pressed={answers.length === 0}
            className={`rounded-md border px-2 py-1.5 text-sm ${
              answers.length === 0
                ? 'border-bloom-ink bg-bloom-ink/10 text-bloom-strong'
                : 'border-border text-muted'
            }`}
          >
            {strings.toolbar.allAnswers}
          </button>

          {ANSWER_FILTERS.map((value) => {
            const on = answers.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setAnswers((current) =>
                    current.includes(value)
                      ? current.filter((each) => each !== value)
                      : [...current, value]
                  )
                }
                aria-pressed={on}
                className={`rounded-md border px-2 py-1.5 text-sm ${
                  on
                    ? 'border-bloom-ink bg-bloom-ink/10 text-bloom-strong'
                    : 'border-border text-muted'
                }`}
              >
                {strings.toolbar.answer[value]}
              </button>
            )
          })}
        </div>

        <select
          value={sent}
          onChange={(event) => setSent(event.target.value as SentFilter | '')}
          aria-label={strings.toolbar.allSent}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">{strings.toolbar.allSent}</option>
          <option value="sent">{strings.toolbar.sentOnly}</option>
          <option value="unsent">{strings.toolbar.unsentOnly}</option>
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
          onChange={(event) => {
            const key = event.target.value as SortKey
            setSortKey(key)
            // Each key has a useful end to start from, so picking a new one
            // resets the toggle rather than carrying the previous direction
            // into a column where it means something else.
            setSortDirection(DEFAULT_SORT_DIRECTION[key])
          }}
          aria-label={strings.toolbar.sortBy}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {strings.toolbar.sortBy}: {strings.toolbar.sort[key]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
          aria-label={
            sortDirection === 'asc' ? strings.toolbar.sortDescending : strings.toolbar.sortAscending
          }
          title={
            sortDirection === 'asc' ? strings.toolbar.sortDescending : strings.toolbar.sortAscending
          }
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>{strings.toolbar.showing(visible.length, invites.length)}</span>

        {visible.length > 0 ? (
          <button
            type="button"
            onClick={exportSeating}
            disabled={exporting}
            className="rounded-md border border-border px-2 py-1 hover:bg-surface disabled:opacity-60"
          >
            {exporting ? strings.toolbar.exporting : strings.toolbar.exportSeating}
          </button>
        ) : null}

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
