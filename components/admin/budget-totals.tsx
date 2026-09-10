/**
 * The four budget tiles (PRD §6.22).
 *
 * A Server Component: it renders numbers and holds no state. Same shape as the
 * stats bar on the invitees tab — a large figure with a smaller one beneath —
 * so the two screens speak one language. There, the small number is the same
 * figure in invitations; here it is the same total on the CONFIRMED basis.
 *
 * Flat lines contribute identically to both bases, so a budget with no
 * per-guest lines shows no sub-line at all rather than repeating itself.
 */

import { formatAmount, formatSignedAmount } from '@/lib/money'
import { strings } from '@/lib/strings'
import type { BudgetTotals } from '@/lib/types'

export function BudgetTotalsBar({ totals }: { totals: BudgetTotals }) {
  const labels = strings.budget.tiles

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label={labels.expenses}
        planned={totals.plannedExpenses}
        confirmed={totals.confirmedExpenses}
      />
      <Tile label={labels.income} planned={totals.plannedIncome} confirmed={totals.confirmedIncome} />
      <Tile
        label={labels.balance}
        planned={totals.plannedBalance}
        confirmed={totals.confirmedBalance}
        hint={strings.budget.balanceHint}
        signed
      />
      <Tile label={labels.toPay} planned={totals.plannedToPay} confirmed={totals.confirmedToPay} />
    </section>
  )
}

function Tile({
  label,
  planned,
  confirmed,
  hint,
  signed = false,
}: {
  label: string
  /** Everyone invited comes — the figure you must be ready to pay. */
  planned: number
  /** What the answers so far commit to. Omitted when identical to planned. */
  confirmed: number
  hint?: string
  signed?: boolean
}) {
  const format = signed ? formatSignedAmount : formatAmount

  /*
   * A negative balance is the one figure here that is bad news, so it is the
   * one figure that gets a colour. Expenses are not "bad" — they are the
   * wedding — and colouring them would make the whole bar red.
   */
  const tone = signed && planned < 0 ? 'text-danger' : undefined

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={`ltr-nums text-2xl font-semibold ${tone ?? ''}`}>{format(planned)}</p>
      {confirmed !== planned ? (
        <p className="ltr-nums text-xs text-muted">
          {strings.budget.confirmedTile(format(confirmed))}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
