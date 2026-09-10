'use client'

/**
 * The budget table (PRD §6.22): one row per expense or income line, edited in
 * place, plus an add row at the bottom.
 *
 * Nothing here does arithmetic. Every full price and remaining balance comes
 * from lib/budget.ts, so this file only decides what to show and what to send.
 *
 * The optimistic values live HERE, in one map, not in the cells — the lesson
 * from components/admin/first-invite-controls.tsx, where per-row state was
 * discarded whenever a row unmounted and came back showing a stale value.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { budgetLines, type BudgetHeadcounts } from '@/lib/budget'
import { formatAmount, parseAmount, toAmountInput } from '@/lib/money'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'
import {
  BUDGET_KINDS,
  BUDGET_PRICINGS,
  type BudgetItem,
  type BudgetKind,
  type BudgetPricing,
  type UpdateBudgetItemInput,
} from '@/lib/types'

export function BudgetTable({
  items,
  headcounts,
}: {
  items: BudgetItem[]
  headcounts: BudgetHeadcounts
}) {
  const router = useRouter()
  const [patches, setPatches] = useState<Record<string, UpdateBudgetItemInput>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const patched = useMemo(() => {
    if (Object.keys(patches).length === 0) return items
    return items.map((item) => (patches[item.id] ? { ...item, ...patches[item.id] } : item))
  }, [items, patches])

  const lines = useMemo(() => budgetLines(patched, headcounts), [patched, headcounts])

  function markSaving(id: string, saving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current)
      if (saving) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /**
   * Applies the change immediately, then writes it.
   *
   * `previous` is what the cell was showing, so a failure restores exactly that
   * rather than the server prop — after an earlier successful edit the prop is
   * stale, and reverting to it would contradict the database.
   */
  async function save(id: string, patch: UpdateBudgetItemInput, previous: UpdateBudgetItemInput) {
    setPatches((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
    markSaving(id, true)

    try {
      const response = await fetch(`/api/budget/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.budget.saveFailed)
    } catch (thrown) {
      // Catches a rejected fetch and a non-JSON body, not just !success: an
      // offline blip must not leave an edited number standing unsaved.
      setPatches((current) => ({ ...current, [id]: { ...current[id], ...previous } }))
      toast.error(thrown instanceof Error ? thrown.message : strings.budget.saveFailed)
    } finally {
      markSaving(id, false)
    }
  }

  async function handleDelete(item: BudgetItem) {
    if (!window.confirm(strings.budget.confirmDelete(item.name))) return

    markSaving(item.id, true)
    try {
      const response = await fetch(`/api/budget/${item.id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.budget.deleteFailed)
      toast.success(strings.budget.deleted)
      // A removal changes which rows exist, so the server list is refetched
      // rather than patched — there is no optimistic value to keep.
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : strings.budget.deleteFailed)
    } finally {
      markSaving(item.id, false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {strings.budget.basis(headcounts.invited, headcounts.attending)}
      </p>

      {lines.length === 0 ? (
        <EmptyState title={strings.budget.empty} hint={strings.budget.emptyHint} />
      ) : (
        /* Wide content scrolls inside its own box; the page never scrolls sideways. */
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <Th>{strings.budget.name}</Th>
                <Th>{strings.budget.kind}</Th>
                <Th>{strings.budget.pricing}</Th>
                <Th>{strings.budget.amount}</Th>
                <Th>{strings.budget.paidInAdvance}</Th>
                <Th>{strings.budget.fullPrice}</Th>
                <Th>{strings.budget.toPay}</Th>
                <Th>
                  <span className="sr-only">{strings.budget.delete}</span>
                </Th>
              </tr>
            </thead>

            <tbody>
              {lines.map((line) => {
                const item = line.item
                const saving = savingIds.has(item.id)

                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <Td>
                      <TextCell
                        key={item.name}
                        value={item.name}
                        disabled={saving}
                        onSave={(name) => save(item.id, { name }, { name: item.name })}
                      />
                    </Td>

                    <Td>
                      <select
                        value={item.kind}
                        disabled={saving}
                        aria-label={strings.budget.kind}
                        onChange={(event) =>
                          void save(
                            item.id,
                            { kind: event.target.value as BudgetKind },
                            { kind: item.kind }
                          )
                        }
                        className="w-full rounded border border-border px-2 py-1"
                      >
                        {BUDGET_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {strings.budget.kinds[kind]}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td>
                      <select
                        value={item.pricing}
                        disabled={saving}
                        aria-label={strings.budget.pricing}
                        onChange={(event) =>
                          void save(
                            item.id,
                            { pricing: event.target.value as BudgetPricing },
                            { pricing: item.pricing }
                          )
                        }
                        className="w-full rounded border border-border px-2 py-1"
                      >
                        {BUDGET_PRICINGS.map((pricing) => (
                          <option key={pricing} value={pricing}>
                            {strings.budget.pricings[pricing]}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td>
                      <MoneyCell
                        key={item.amount}
                        value={item.amount}
                        label={strings.budget.amount}
                        disabled={saving}
                        onSave={(amount) => save(item.id, { amount }, { amount: item.amount })}
                      />
                      {item.pricing === 'per_person' ? (
                        <span className="block text-xs text-muted">
                          {strings.budget.perPersonUnit}
                        </span>
                      ) : null}
                    </Td>

                    <Td>
                      <MoneyCell
                        key={item.paid_in_advance}
                        value={item.paid_in_advance}
                        label={strings.budget.paidInAdvance}
                        disabled={saving}
                        onSave={(paid_in_advance) =>
                          save(item.id, { paid_in_advance }, { paid_in_advance: item.paid_in_advance })
                        }
                      />
                    </Td>

                    <Derived planned={line.plannedFull} confirmed={line.confirmedFull} />
                    <Derived planned={line.plannedToPay} confirmed={line.confirmedToPay} />

                    <Td>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={saving}
                        className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-surface disabled:opacity-50"
                      >
                        {strings.budget.delete}
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddBudgetRow onAdded={() => router.refresh()} />
    </div>
  )
}

/**
 * A derived cell: the planning figure, with the confirmed one beneath when the
 * two differ. They only differ on a per-guest line, so a flat line shows one
 * number and nothing looks special-cased.
 */
function Derived({ planned, confirmed }: { planned: number; confirmed: number }) {
  return (
    <Td>
      <span className="ltr-nums block font-medium">{formatAmount(planned)}</span>
      {confirmed !== planned ? (
        <span className="ltr-nums block text-xs text-muted">
          {strings.budget.confirmedNote(formatAmount(confirmed))}
        </span>
      ) : null}
    </Td>
  )
}

/**
 * Saves on blur, not on every keystroke.
 *
 * Per keystroke would be a request per character and would fight the person
 * typing; on Enter alone would silently lose an edit they clicked away from.
 * Escape abandons the edit, which is the only way back once you have typed
 * over a number you meant to keep.
 *
 * Both cells are remounted by their `key` when the saved value changes, so a
 * reverted failure shows the restored value with no effect to sync it.
 */
function TextCell({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)

  function commit() {
    const trimmed = draft.trim()
    if (trimmed === value) return
    // A name is mandatory: an empty one is refused and the old name comes back,
    // rather than leaving a nameless row nobody can identify.
    if (!trimmed) {
      setDraft(value)
      toast.error(strings.budget.nameRequired)
      return
    }
    onSave(trimmed)
  }

  return (
    <input
      value={draft}
      disabled={disabled}
      aria-label={strings.budget.name}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(value)
      }}
      className="w-full min-w-32 rounded border border-border px-2 py-1 disabled:opacity-50"
    />
  )
}

function MoneyCell({
  value,
  label,
  disabled,
  onSave,
}: {
  /** Agorot. */
  value: number
  label: string
  disabled: boolean
  onSave: (next: number) => void
}) {
  const [draft, setDraft] = useState(() => toAmountInput(value))

  function commit() {
    // Blank means zero: clearing "paid in advance" is how you say nothing has
    // been paid, and clearing a price is how you say it isn't known yet.
    const parsed = draft.trim() === '' ? 0 : parseAmount(draft)

    if (parsed === null) {
      setDraft(toAmountInput(value))
      toast.error(strings.budget.invalidAmount)
      return
    }
    if (parsed === value) return
    onSave(parsed)
  }

  return (
    <input
      value={draft}
      disabled={disabled}
      inputMode="decimal"
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(toAmountInput(value))
      }}
      className="ltr-nums w-24 rounded border border-border px-2 py-1 disabled:opacity-50"
    />
  )
}

/**
 * The add row.
 *
 * A form rather than a blank row spawned in the database: name and price are
 * mandatory, and a placeholder row named "שורה חדשה" would be a lie that also
 * lands in the totals as ₪0 until someone finishes it.
 */
function AddBudgetRow({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BudgetKind>('expense')
  const [pricing, setPricing] = useState<BudgetPricing>('flat')
  const [amount, setAmount] = useState('')
  const [paid, setPaid] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(strings.budget.nameRequired)
      return
    }
    if (amount.trim() === '') {
      toast.error(strings.budget.amountRequired)
      return
    }

    const parsedAmount = parseAmount(amount)
    const parsedPaid = paid.trim() === '' ? 0 : parseAmount(paid)
    if (parsedAmount === null || parsedPaid === null) {
      toast.error(strings.budget.invalidAmount)
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          kind,
          pricing,
          amount: parsedAmount,
          paid_in_advance: parsedPaid,
        }),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.budget.saveFailed)

      // Cleared so the next line can be typed straight away; kind and pricing
      // are kept, because entering several expenses in a row is the normal case.
      setName('')
      setAmount('')
      setPaid('')
      onAdded()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : strings.budget.saveFailed)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border px-4 py-3">
      <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
        {strings.budget.name}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={strings.budget.namePlaceholder}
          className="min-w-40 rounded border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.kind}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as BudgetKind)}
          className="rounded border border-border px-2 py-1 text-sm text-foreground"
        >
          {BUDGET_KINDS.map((value) => (
            <option key={value} value={value}>
              {strings.budget.kinds[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.pricing}
        <select
          value={pricing}
          onChange={(event) => setPricing(event.target.value as BudgetPricing)}
          className="rounded border border-border px-2 py-1 text-sm text-foreground"
        >
          {BUDGET_PRICINGS.map((value) => (
            <option key={value} value={value}>
              {strings.budget.pricings[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.amount}
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="ltr-nums w-24 rounded border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.paidInAdvance}
        <input
          value={paid}
          onChange={(event) => setPaid(event.target.value)}
          inputMode="decimal"
          className="ltr-nums w-24 rounded border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={adding}
        className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {adding ? strings.budget.adding : `+ ${strings.budget.addRow}`}
      </button>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-medium text-muted">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>
}
