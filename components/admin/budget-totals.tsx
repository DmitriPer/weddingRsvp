/**
 * The four budget tiles (PRD §6.22).
 *
 * A Server Component: it renders numbers and holds no state. Same shape as the
 * stats bar on the invitees tab, so the two screens speak one language.
 *
 * One figure per tile. Per-guest expenses are billed for the approved count,
 * floored at the committed minimum (lib/budget.ts), so there is no second
 * "if everyone invited comes" basis to show beneath it any more
 * (docs/budget-min-guests-PRD.md).
 */

import { formatAmount, formatSignedAmount } from '@/lib/money'
import { strings } from '@/lib/strings'
import type { BudgetTotals } from '@/lib/types'

export function BudgetTotalsBar({ totals }: { totals: BudgetTotals }) {
  const labels = strings.budget.tiles

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label={labels.expenses} value={totals.expenses} />
      <Tile label={labels.income} value={totals.income} />
      <Tile label={labels.balance} value={totals.balance} hint={strings.budget.balanceHint} signed />
      <Tile label={labels.toPay} value={totals.toPay} />
    </section>
  )
}

function Tile({
  label,
  value,
  hint,
  signed = false,
}: {
  label: string
  value: number
  hint?: string
  signed?: boolean
}) {
  const format = signed ? formatSignedAmount : formatAmount

  /*
   * A negative balance is the one figure here that is bad news, so it is the
   * one figure that gets a colour. Expenses are not "bad" — they are the
   * wedding — and colouring them would make the whole bar red.
   */
  const tone = signed && value < 0 ? 'text-danger' : ''

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      {/* One size down on phones, so a 7-digit sum fits a two-per-row tile. */}
      <p className={`ltr-nums text-xl font-semibold sm:text-2xl ${tone}`}>{format(value)}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
