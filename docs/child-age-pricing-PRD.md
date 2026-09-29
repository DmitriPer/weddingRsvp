# Children by Age: Infants Free, a Child Price per Line

**Owner:** Dmitri
**Status:** agreed 2026-09-29, built on `feat/child-age-pricing`. Needs migration 018.

## 1. Mission

The caterer prices by age. Infants (0–3) eat free, children (3–7) have their own price per plate, and everyone older pays the adult price. Only adults count toward the committed minimum (כמות התחייבות). Until now the app knew only "adult / child", and every child cost a full adult plate.

## 2. Age groups

| Group | Age | Price per plate | Counts toward the minimum | Takes a chair |
|---|---|---|---|---|
| Adult | 7+ | the line's price | ✅ | ✅ |
| Child | 3–7 | the line's **child price** (blank = adult price) | ❌ | ✅ |
| Infant | 0–3 | ₪0 | ❌ | ✅ |

**Only the admin sets the age group.** The guest RSVP form is unchanged, and a guest-added "+ילד" is saved as a child (3–7).

## 3. Calculation (`lib/budget.ts`, still the only place)

```
per-guest EXPENSE = price × max(adults, minimum)
                  + (child price ?? price) × children 3–7
                  + 0 × infants
per-guest INCOME  = price × everyone attending   (no floor, no child price)
```

**Example:** a 120 minimum, 100 adults, 10 children and 5 infants, at ₪470 an adult and ₪200 a child: **120×470 + 10×200 = ₪58,400.**

## 4. Data: migration `018_child_age_pricing.sql`

- **`attendees.is_infant`** (boolean, default false), with a check that `is_infant` implies `is_child`.
  - An infant stays `is_child`, so import, export, the guest form, placeholders and seating are untouched.
  - `lib/age-group.ts` maps the two flags to adult / child / infant.
- **`budget_items.child_amount`** (bigint agorot, nullable). Null means "a child pays the adult price", which is how every line priced before this change.
- It is additive. No existing row changes meaning.

## 5. Screens

- **Invitees:** each person's selector is **מבוגר / ילד 3–7 / תינוק 0–3**, both when editing and when adding. The API takes `age_group`, and still accepts `is_child` from older callers.
- **Budget:**
  - Per-guest **expense** lines show a **"מחיר ילד (3–7)"** field under the price. Blank means the same as the adult price; 0 means free.
  - The add form shows it for per-guest expenses.
  - The line beside the minimum reads "X מבוגרים · Y ילדים (3–7) · Z תינוקות (0–3)".
- **Dashboard:** "ילדים (3–7)" and "תינוקות (0–3)" appear as separate figures.
- **Site export (outside RSVP site):** its template has only adults and kids, so infants are exported as kids.

## 6. After deploy

Mark the infants among the existing children: **3 on the list** as of 2026-09-29. Until then they're treated as children 3–7.

## 7. Definition of done

- The worked examples hold: the spec example, above the minimum, a blank child price, a child price of 0, infants never costing anything, and income.
- `npm run build` and `npm run lint` pass.
- Tested by Dmitri locally after running 018.
