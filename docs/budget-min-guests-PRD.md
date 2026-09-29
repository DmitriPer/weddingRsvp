# Budget — Committed Minimum Guests (כמות התחייבות)

**Owner:** Dmitri
**Status:** agreed 2026-09-29
**Changes:** the budget arithmetic in `lib/budget.ts` (PRD §6.22)

## 1. Mission

The venue bills per guest, but never for fewer than an agreed number, whatever the turnout. The budget should calculate what the couple will actually pay. Until now it showed two figures: "if everyone invited comes" and "confirmed so far". This replaces both with a single figure based on the approved count and floored at the minimum.

## 2. Scope

| In scope | Out of scope |
|---|---|
| One global כמות התחייבות, default 120, editable on the budget page | A minimum per budget line |
| Per-guest expense = price × max(approved, minimum) | Any change to flat lines or paid-in-advance |
| Removing the "everyone invited" basis everywhere | Counting adults and kids differently |

## 3. Calculation (`lib/budget.ts`, the only place it happens)

```
approved       = adults + kids who said yes   (lib/stats.ts → lib/headcount.ts)
per-guest EXPENSE = price × max(approved, minimum)
per-guest INCOME  = price × approved          (never floored)
flat line      = price
to pay         = max(0, full − paid in advance)
```

Worked examples, minimum 120, price ₪470:

| Approved | Billed for | Full price |
|---|---|---|
| 100 | 120 | ₪56,400 |
| 120 | 120 | ₪56,400 |
| 125 | 125 | ₪58,750 |

- **Income is never floored.** A per-guest income line (a gift estimate, say) counts the people actually coming. Flooring it would book gifts from guests who don't exist.
- **Minimum 0** means no minimum.

## 4. UI

- **Budget page, above the tiles:**
  - a **כמות התחייבות** number field, which saves on blur;
  - beside it, "מאשרים עד כה: N";
  - a one-line hint below.
- **Each line shows one full price and one to-pay figure.** Removed:
  - the "מאושר" sub-line;
  - the "אם כולם יגיעו" line under the tiles;
  - the "מוכפל ב-X מוזמנים" note.
- **No note on a line** saying whether the minimum or the approved count applied, as Dmitri chose. Only the number is shown.

## 5. Data model

Migration `016_budget_min_guests.sql`:

```sql
alter table wedding_config
  add column if not exists budget_min_guests int not null default 120
  check (budget_min_guests >= 0);
```

- One column on the single config row; no guest data is touched.
- `PATCH /api/config` accepts `budget_min_guests` as a whole number ≥ 0.
- **Dmitri runs it in the Supabase SQL editor.** Until then:
  - the page calculates with 120;
  - saving the field fails with an error toast.

## 6. Definition of done

- The worked examples in §3 hold.
- The minimum survives a reload.
- No "everyone invited" figure remains on the page.
- `npm run build` and `npm run lint` pass.
- Checked by viewing. The budget holds real figures, so the only write is one change to the minimum, set straight back.
