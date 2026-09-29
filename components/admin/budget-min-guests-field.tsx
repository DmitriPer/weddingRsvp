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
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'

export function BudgetMinGuestsField({ value, attending }: { value: number; attending: number }) {
  const router = useRouter()
  const [draft, setDraft] = useState(String(value))
  const [saving, setSaving] = useState(false)

  async function commit() {
    const trimmed = draft.trim()
    const parsed = Number(trimmed)
    if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) {
      setDraft(String(value))
      toast.error(strings.budget.invalidMinGuests)
      return
    }
    if (parsed === value) return

    setSaving(true)
    try {
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_min_guests: parsed }),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.budget.saveFailed)
      toast.success(strings.budget.minGuestsSaved)
      router.refresh()
    } catch (thrown) {
      setDraft(String(value))
      toast.error(thrown instanceof Error ? thrown.message : strings.budget.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {strings.budget.minGuests}
        <input
          value={draft}
          disabled={saving}
          inputMode="numeric"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setDraft(String(value))
          }}
          // 16px on phones: iOS Safari zooms into any focused field smaller than that.
          className="ltr-nums w-28 rounded border border-border px-2 py-2 text-base font-normal disabled:opacity-50 md:py-1 md:text-sm"
        />
      </label>
      <p className="pb-1.5 text-sm text-muted">{strings.budget.attendingSoFar(attending)}</p>
      <p className="w-full text-xs text-muted">{strings.budget.minGuestsHint}</p>
    </section>
  )
}
