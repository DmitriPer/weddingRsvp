# Budget — Mobile Layout

**Owner:** Dmitri
**Status:** built 2026-09-29 (PR #24)
**Surface:** `app/admin/budget`, `components/admin/budget-table.tsx`, `components/admin/budget-totals.tsx`
**Follows:** `admin-ui-pass-PRD.md`, which left the budget page out of scope

## 1. Mission

The budget page works at a desk and breaks on a phone. The table has 8 columns and a minimum width of 768px, so on a phone every line scrolls sideways inside its box to reach "to pay" or delete. This pass makes the page usable on a phone. **Desktop stays exactly as it is.**

## 2. Scope

| In scope | Out of scope |
|---|---|
| Budget lines as stacked cards below `md` (768px) | Any change to data, API, or calculations (`lib/budget.ts`) |
| Touch sizes and iOS input zoom | The desktop table's look |
| Totals tile figure size on phones | New colours, fonts, components |

## 3. Changes

### 3.1 A line becomes a card below `md`

All fields stay editable, in this order:

| Row | Content |
|---|---|
| 1 | Name, full width |
| 2 | Kind · pricing |
| 3 | Amount (with "לאדם" on per-guest lines) · paid in advance |
| 4 | Full price · to pay: read-only, with the "מאושר" sub-line as now |
| 5 | Delete, at the end |

- The table header is hidden on phones, so each field shows a small label above it.
- From `md` up it is the existing table, unchanged.

### 3.2 Touch

- Text inputs and selects use 16px text on phones. iOS Safari zooms the page into any focused field smaller than that.
- Buttons are at least 44px tall on phones.
- The add form's button is full width on phones.

### 3.3 Totals tiles

- They stay 2 per row on phones.
- The main figure is one size smaller below `sm`, so a 7-digit sum fits a ~160px tile.

## 4. Data model

No change.

## 5. Definition of done

- No horizontal scroll at 360px.
- Desktop at 1440px looks unchanged.
- **Verified by viewing only, never saving:** the budget holds real figures.
- `npm run build` and `npm run lint` pass.
