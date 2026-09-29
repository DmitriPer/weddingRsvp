'use client'

/**
 * The budget table (PRD §6.22): one row per expense or income line, edited in
 * place, plus an add row at the bottom.
 *
 * Nothing here does arithmetic. Every full price and remaining balance comes
 * from lib/budget.ts, so this file only decides what to show and what to send.
 *
 * Below `md` every line stacks into a card (docs/budget-mobile-PRD.md): the
 * same cells, laid out as a two-column grid, each with its own label because
 * the table header is hidden. From `md` up it is the unchanged table.
 *
 * The optimistic values live HERE, in one map, not in the cells — the lesson
 * from components/admin/first-invite-controls.tsx, where per-row state was
 * discarded whenever a row unmounted and came back showing a stale value.
 */

import { startTransition, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { budgetLines, type BudgetBasis } from '@/lib/budget'
import { formatAmount, parseAmount, toAmountInput } from '@/lib/money'
import { jsonInit, requestJson } from '@/lib/request'
import { EmptyState } from '@/components/ui/states'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { strings } from '@/lib/strings'
import {
  BUDGET_KINDS,
  BUDGET_PRICINGS,
  type BudgetItem,
  type BudgetKind,
  type BudgetPricing,
  type UpdateBudgetItemInput,
} from '@/lib/types'

/** 16px on phones: iOS Safari zooms the page into any focused field smaller than that. */
const INPUT_TEXT = 'text-base md:text-sm'

export function BudgetTable({
  items,
  basis,
}: {
  items: BudgetItem[]
  basis: BudgetBasis
}): React.JSX.Element {
  const [patches, setPatches] = useState<Record<string, UpdateBudgetItemInput>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  // One delete at a time: the row stays disabled, with a spinner, until the
  // refreshed list no longer contains it.
  const remove = useAction()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const patched = useMemo(() => {
    if (Object.keys(patches).length === 0) return items
    return items.map((item) => (patches[item.id] ? { ...item, ...patches[item.id] } : item))
  }, [items, patches])

  const lines = useMemo(() => budgetLines(patched, basis), [patched, basis])

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
      await requestJson(`/api/budget/${id}`, jsonInit('PATCH', patch), strings.budget.saveFailed)
    } catch (thrown) {
      // Catches a rejected fetch and a non-JSON body, not just !success: an
      // offline blip must not leave an edited number standing unsaved.
      setPatches((current) => ({ ...current, [id]: { ...current[id], ...previous } }))
      toast.error(thrown instanceof Error ? thrown.message : strings.budget.saveFailed)
    } finally {
      markSaving(id, false)
    }
  }

  function handleDelete(item: BudgetItem): void {
    if (!window.confirm(strings.budget.confirmDelete(item.name))) return

    setDeletingId(item.id)
    // A removal changes which rows exist, so the server list is refetched
    // rather than patched — there is no optimistic value to keep.
    remove.run(
      () =>
        requestJson(`/api/budget/${item.id}`, jsonInit('DELETE'), strings.budget.deleteFailed),
      { success: strings.budget.deleted, failure: strings.budget.deleteFailed }
    )
  }

  return (
    <div className="space-y-3">
      {lines.length === 0 ? (
        <EmptyState title={strings.budget.empty} hint={strings.budget.emptyHint} />
      ) : (
        /* Desktop: wide content scrolls inside its own box. Phone: no table
           width at all — the rows are cards, so nothing scrolls sideways. */
        <div className="rounded-lg border border-border md:overflow-x-auto">
          <table className="block w-full border-collapse text-sm md:table md:min-w-3xl">
            <thead className="hidden md:table-header-group">
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

            <tbody className="block md:table-row-group">
              {lines.map((line) => {
                const item = line.item
                const deleting = remove.pending && deletingId === item.id
                const saving = savingIds.has(item.id) || deleting

                return (
                  <tr
                    key={item.id}
                    aria-busy={saving}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border px-3 py-3 last:border-0 md:table-row md:p-0"
                  >
                    <Td label={strings.budget.name} wide>
                      <TextCell
                        key={item.name}
                        value={item.name}
                        disabled={saving}
                        onSave={(name) => save(item.id, { name }, { name: item.name })}
                      />
                    </Td>

                    <Td label={strings.budget.kind}>
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
                        className={`w-full rounded border border-border px-2 py-2 md:py-1 ${INPUT_TEXT}`}
                      >
                        {BUDGET_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {strings.budget.kinds[kind]}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td label={strings.budget.pricing}>
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
                        className={`w-full rounded border border-border px-2 py-2 md:py-1 ${INPUT_TEXT}`}
                      >
                        {BUDGET_PRICINGS.map((pricing) => (
                          <option key={pricing} value={pricing}>
                            {strings.budget.pricings[pricing]}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td label={strings.budget.amount}>
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
                      {/* Child price: per-guest EXPENSES only — income has none (lib/budget.ts). */}
                      {item.pricing === 'per_person' && item.kind === 'expense' ? (
                        <div className="mt-1">
                          <ChildPriceCell
                            key={item.child_amount ?? 'none'}
                            value={item.child_amount}
                            disabled={saving}
                            onSave={(child_amount) =>
                              save(item.id, { child_amount }, { child_amount: item.child_amount })
                            }
                          />
                          <span className="block text-xs text-muted">{strings.budget.childPriceUnit}</span>
                        </div>
                      ) : null}
                    </Td>

                    <Td label={strings.budget.paidInAdvance}>
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

                    <Derived label={strings.budget.fullPrice} value={line.full} />
                    <Derived label={strings.budget.toPay} value={line.toPay} />

                    <Td wide className="text-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={saving || remove.pending}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded border border-border px-3 text-sm text-danger hover:bg-surface disabled:opacity-50 md:min-h-0 md:px-2 md:py-1 md:text-xs"
                      >
                        {deleting ? <Spinner /> : null}
                        {deleting ? strings.app.deleting : strings.budget.delete}
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddBudgetRow />
    </div>
  )
}

/** A derived cell: worked out in lib/budget.ts, shown read-only. */
function Derived({ label, value }: { label: string; value: number }) {
  return (
    <Td label={label}>
      <span className="ltr-nums block font-medium">{formatAmount(value)}</span>
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
      className={`w-full rounded border border-border px-2 py-2 disabled:opacity-50 md:min-w-32 md:py-1 ${INPUT_TEXT}`}
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
      className={`ltr-nums w-full rounded border border-border px-2 py-2 disabled:opacity-50 md:w-24 md:py-1 ${INPUT_TEXT}`}
    />
  )
}

/**
 * The child price (3–7) on a per-guest expense line (docs/child-age-pricing-PRD.md).
 *
 * Unlike MoneyCell, BLANK is meaningful and is not zero: an empty child price
 * means "a child pays the adult price" — how every line priced before this
 * existed. A child who eats free is 0, typed explicitly.
 */
function ChildPriceCell({
  value,
  disabled,
  onSave,
}: {
  /** Agorot, or null for "same as adult". */
  value: number | null
  disabled: boolean
  onSave: (next: number | null) => void
}) {
  const initial = value === null ? '' : toAmountInput(value)
  const [draft, setDraft] = useState(initial)

  function commit() {
    const parsed = draft.trim() === '' ? null : parseAmount(draft)
    if (draft.trim() !== '' && parsed === null) {
      setDraft(initial)
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
      aria-label={strings.budget.childPrice}
      placeholder={strings.budget.childPriceSameAsAdult}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(initial)
      }}
      className={`ltr-nums w-full rounded border border-border px-2 py-2 disabled:opacity-50 md:w-24 md:py-1 ${INPUT_TEXT}`}
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
function AddBudgetRow() {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BudgetKind>('expense')
  const [pricing, setPricing] = useState<BudgetPricing>('flat')
  const [amount, setAmount] = useState('')
  const [paid, setPaid] = useState('')
  const [childPrice, setChildPrice] = useState('')
  // Pending until the refreshed list shows the new row.
  const add = useAction()

  function clearForm(): void {
    // Kind and pricing are kept, because entering several expenses in a row is
    // the normal case.
    setName('')
    setAmount('')
    setPaid('')
    setChildPrice('')
  }

  function handleAdd(): void {
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

    // Blank child price = same as adult; only sent where it means something.
    const hasChildPrice = pricing === 'per_person' && kind === 'expense' && childPrice.trim() !== ''
    const parsedChild = hasChildPrice ? parseAmount(childPrice) : null
    if (hasChildPrice && parsedChild === null) {
      toast.error(strings.budget.invalidAmount)
      return
    }

    const payload = {
      name: trimmed,
      kind,
      pricing,
      amount: parsedAmount,
      paid_in_advance: parsedPaid,
      child_amount: parsedChild,
    }
    add.run(
      async () => {
        await requestJson('/api/budget', jsonInit('POST', payload), strings.budget.saveFailed)
        // Cleared so the next line can be typed straight away — in the same
        // transition as the refresh, so the fields empty as the new row appears.
        startTransition(clearForm)
      },
      { failure: strings.budget.saveFailed }
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border px-4 py-3">
      <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
        {strings.budget.name}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={strings.budget.namePlaceholder}
          className={`min-w-40 rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.kind}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as BudgetKind)}
          className={`rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
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
          className={`rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
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
          className={`ltr-nums w-24 rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
        />
      </label>

      {pricing === 'per_person' && kind === 'expense' ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          {strings.budget.childPrice}
          <input
            value={childPrice}
            onChange={(event) => setChildPrice(event.target.value)}
            inputMode="decimal"
            placeholder={strings.budget.childPriceSameAsAdult}
            className={`ltr-nums w-24 rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-muted">
        {strings.budget.paidInAdvance}
        <input
          value={paid}
          onChange={(event) => setPaid(event.target.value)}
          inputMode="decimal"
          className={`ltr-nums w-24 rounded border border-border px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
        />
      </label>

      <button
        type="button"
        onClick={handleAdd}
        disabled={add.pending}
        aria-busy={add.pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm text-white disabled:opacity-50 sm:w-auto md:min-h-0 md:py-1.5"
      >
        {add.pending ? <Spinner /> : null}
        {add.pending ? strings.budget.adding : `+ ${strings.budget.addRow}`}
      </button>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-medium text-muted">{children}</th>
}

/**
 * A cell. On a phone it is a block in the card's two-column grid, with its
 * label above it — the table header is hidden there. `wide` spans both
 * columns. From `md` up it is an ordinary table cell and the label is hidden.
 */
function Td({
  children,
  label,
  wide = false,
  className = '',
}: {
  children: React.ReactNode
  label?: string
  wide?: boolean
  className?: string
}) {
  return (
    <td
      className={`block min-w-0 md:table-cell md:px-3 md:py-2 md:align-top ${wide ? 'col-span-2' : ''} ${className}`}
    >
      {label ? <span className="mb-1 block text-xs text-muted md:hidden">{label}</span> : null}
      {children}
    </td>
  )
}
