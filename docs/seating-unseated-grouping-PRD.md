# Seating — Unseated List Grouped by Relation, with Filters

**Owner:** Dmitri
**Status:** agreed 2026-09-27, not yet built
**Extends:** `wedding-rsvp-PRD.md` §6.17 Seating

## 1. Mission

The unseated list on the seating board is one long alphabetical list of households. Seating works best group by group: the family first, then friends, work, and those invited by the family. The admin also needs to narrow the list to one side of the wedding. This makes the list follow that workflow.

## 2. Scope

| In scope | Out of scope |
|---|---|
| Grouping the unseated list by relation, with headings and counts | Changing the table cards, floor plan or printout |
| Relation and side filters on the unseated list | Remembering filters across refreshes |
| | Any database change |

## 3. Functionality

### 3.1 Grouped list

The groups appear in the invitee list's existing relation order, each with a heading and count:

1. `משפחה (n)`
2. `חברים (n)`
3. `עבודה (n)`
4. `הוזמן ע״י המשפחה (n)`

- Empty groups are hidden.
- **Inside a group, people are ordered by household** (invitation name, then person name). A family stays together and can be selected and seated at once, as today.
- Every guest currently has a relation. A missing one is still handled safely: it sorts last, without its own filter option.

### 3.2 Filters

Two dropdowns above the unseated list. They combine with each other and with the existing name search:

| Filter | Options |
|---|---|
| Relation | All · family · friends · work · invited by family |
| Side | All · bride · groom · shared |

- **Only the unseated list is affected.** Table cards, the floor plan and the printout are unchanged.
- The unseated heading's count shows the filtered number.
- Filters reset on refresh.

## 4. Data model

No database change. Each seatable person (`SeatablePerson` in `lib/seating.ts`) carries their invitation's `relation` and `side`. The group order reuses `RELATIONS` in `lib/types.ts`, the same order the invitee list sorts by, so there is one definition of it.

## 5. Definition of done

- Groups show in the right order with correct counts, and empty groups are hidden.
- The relation, side and name filters combine correctly.
- Selecting and seating work as before.
- New labels live in `strings.seating` (Hebrew only, like the rest of the admin area).
- `npm run build` and `npm run lint` pass.
- Checked in Dmitri's Chrome tab by **viewing and selecting only, never placing**. The database holds real guest data.
