/**
 * The four budget tiles (PRD §6.22).
 *
 * A Server Component: it renders numbers and holds no state. Same shape as the
 * stats bar on the invitees tab — a large figure with a smaller one beneath —
 * so the two screens speak one language.
 *
 * EVERY TILE LEADS WITH THE CONFIRMED FIGURE — what the answers received so far
 * commit to — with the everyone-invited figure small beneath it. Once replies
 * start arriving, that is the number being worked with; the everyone-invited
 * total is the ceiling to stay inside, not the position. The sub-line names its
 * basis in words, so the two can never be mistaken for one another.
 *
 * Flat lines contribute identically to both bases, so a budget with no
 * per-guest lines shows no sub-line at all rather than repeating itself — and
 * as more people accept, the two converge and the sub-line disappears on its
 * own.
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
        lead={totals.confirmedExpenses}
        sub={totals.plannedExpenses}
      />
      <Tile
        label={labels.income}
        lead={totals.confirmedIncome}
        sub={totals.plannedIncome}
      />
      <Tile
        label={labels.balance}
        lead={totals.confirmedBalance}
        sub={totals.plannedBalance}
        hint={strings.budget.balanceHint}
        signed
      />
      <Tile label={labels.toPay} lead={totals.confirmedToPay} sub={totals.plannedToPay} />
    </section>
  )
}

function Tile({
  label,
  lead,
  sub,
  hint,
  signed = false,
}: {
  label: string
  /** The large figure: the confirmed basis, what the replies so far commit to. */
  lead: number
  /** Small, beneath: everyone invited. Omitted when identical to the lead. */
  sub: number
  hint?: string
  signed?: boolean
}) {
  const format = signed ? formatSignedAmount : formatAmount

  /*
   * A negative balance is the one figure here that is bad news, so it is the
   * one figure that gets a colour. Expenses are not "bad" — they are the
   * wedding — and colouring them would make the whole bar red.
   */
  const tone = signed && lead < 0 ? 'text-danger' : undefined

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={`ltr-nums text-2xl font-semibold ${tone ?? ''}`}>{format(lead)}</p>
      {sub !== lead ? (
        <p className="ltr-nums text-xs text-muted">
          {strings.budget.plannedTile(format(sub))}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
