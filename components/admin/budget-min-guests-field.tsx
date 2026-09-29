'use client'

/**
 * כמות התחייבות — the committed minimum guest count (docs/budget-min-guests-PRD.md).
 *
 * One value for the whole budget, stored on wedding_config and written through
 * PATCH /api/config. Saves on blur like every budget cell; the page is then
 * refreshed, because every per-guest expense and all four tiles depend on it
 * and lib/budget.ts on the server is the only place they are worked out.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { jsonInit, requestJson } from '@/lib/request'
import type { BudgetBasis } from '@/lib/budget'
import { strings } from '@/lib/strings'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'

export function BudgetMinGuestsField({
  value,
  basis,
}: {
  value: number
  /** Who has said yes so far, by age group — the minimum applies to adults only. */
  basis: BudgetBasis
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))
  // Pending until the refreshed totals render, not just until the PATCH returns.
  const save = useAction()

  function commit(): void {
    const trimmed = draft.trim()
    const parsed = Number(trimmed)
    if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) {
      setDraft(String(value))
      toast.error(strings.budget.invalidMinGuests)
      return
    }
    if (parsed === value) return

    save.run(
      () =>
        requestJson(
          '/api/config',
          jsonInit('PATCH', { budget_min_guests: parsed }),
          strings.budget.saveFailed
        ),
      {
        success: strings.budget.minGuestsSaved,
        failure: strings.budget.saveFailed,
        onError: () => setDraft(String(value)),
      }
    )
  }

  return (
    <section className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {strings.budget.minGuests}
        <span className="flex items-center gap-2">
          <input
            value={draft}
            disabled={save.pending}
            aria-busy={save.pending}
            inputMode="numeric"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setDraft(String(value))
            }}
            // 16px on phones: iOS Safari zooms into any focused field smaller than that.
            className="ltr-nums w-28 rounded border border-border px-2 py-2 text-base font-normal disabled:opacity-50 md:py-1 md:text-sm"
          />
          {save.pending ? <Spinner className="text-muted" /> : null}
        </span>
      </label>
      <p className="pb-1.5 text-sm text-muted">
        {strings.budget.attendingSoFar(basis.adults, basis.children, basis.infants)}
      </p>
      <p className="w-full text-xs text-muted">{strings.budget.minGuestsHint}</p>
    </section>
  )
}
