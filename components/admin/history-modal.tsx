'use client'

/**
 * The change log for one invite (PRD §6.12) — a modal from the row rather than
 * its own tab, since the row already shows status, headcount, and who is coming.
 *
 * What it adds is the trajectory: that a household said 3, then 2, or declined
 * and then changed to yes. That last case is otherwise invisible — an "edited"
 * status says *something* changed, never that a no became a yes, and that is the
 * change that costs a caterer plate.
 *
 * Fetched on open, not with the list: 150 invites' worth of history on every
 * page load, to show one at a time, would be waste.
 */

import { useState } from 'react'
import { formatShort } from '@/lib/datetime'
import { strings } from '@/lib/strings'
import { ErrorState, LoadingState } from '@/components/ui/states'
import type { ResponseHistoryEntry } from '@/lib/types'

export function HistoryModal({ inviteId, name }: { inviteId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ResponseHistoryEntry[] | null>(null)
  const [error, setError] = useState(false)

  async function load() {
    setOpen(true)
    setError(false)
    setEntries(null)

    const response = await fetch(`/api/invites/${inviteId}`)
    const body = await response.json()
    if (!body.success) {
      setError(true)
      return
    }
    setEntries(body.data.history ?? [])
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
      >
        {strings.admin.history}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={strings.admin.historyTitle}
        >
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-background p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{strings.admin.historyTitle}</h2>
                <p className="text-sm text-muted">{name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.app.close}
                className="text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>

            {error ? <ErrorState onRetry={load} /> : null}
            {!error && entries === null ? <LoadingState /> : null}
            {entries?.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{strings.admin.noHistory}</p>
            ) : null}

            {entries && entries.length > 0 ? (
              <ol className="space-y-2">
                {entries.map((entry, index) => (
                  <li key={entry.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className={entry.attending ? 'text-accent' : 'text-danger'}>
                        {entry.attending ? strings.row.attending : strings.guests.declined}
                      </span>
                      <span className="ltr-nums text-xs text-muted">
                        {formatShort(entry.submitted_at)}
                      </span>
                    </div>
                    {entry.attending ? (
                      <p className="mt-1 text-muted">
                        {strings.guests.adults}: {entry.adult_count} · {strings.guests.kids}:{' '}
                        {entry.kid_count}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">#{entries.length - index}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
