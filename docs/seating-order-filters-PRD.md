# Seating Board — Table Order and Filters

**Owner:** Dmitri
**Status:** agreed 2026-09-24, not yet built
**Extends:** `wedding-rsvp-PRD.md` §6.17 Seating

## 1. Mission

With many tables on the seating board, finding the right card is slow and the order is simply creation order. The admin needs to set the order the tables appear in, see each table's number, and narrow the cards down by name, shape and how full they are.

## 2. Scope

| In scope | Out of scope |
|---|---|
| A saved order for tables, with a visible position number on each card | Drag-and-drop reordering |
| ▲▼ buttons and a type-a-position field to move a table | Multi-select filters |
| Filters on the board cards: name, shape, fullness | Filtering the floor plan, printout or unseated list |
| | Remembering filters across refreshes |
| | Any restyling of the cards |

## 3. Functionality

### 3.1 Order

- The order is **saved** in `tables.sort_order` and shared by everything that lists tables: the board, the floor-plan list, the printout and the Excel export.
- Each card shows its **position number**: 1, 2, 3… in `sort_order` order.
- **▲▼ buttons** move a table one place up or down. ▲ is disabled on the first card and ▼ on the last.
- A **number field** moves a table straight to a position. Values are clamped to 1…n, and entering the current position does nothing.
- After any move, every table is renumbered `0…n−1`. Only rows whose value changed are saved, one PATCH each, one after another, followed by a refresh. This also resolves any duplicate `sort_order` values in existing data.
- **Moving is disabled while any filter is active.** Moving up or down among filtered cards would be ambiguous.

### 3.2 Filters

Above the table cards, combinable with each other:

| Filter | Control | Options |
|---|---|---|
| Name | Text search | Case-insensitive substring match on the table name |
| Shape | Dropdown | All · round · ellipse · rectangle |
| Fullness | Dropdown | All · empty · has room · full · over |

Fullness uses the seated count against `capacity`:

- **empty:** 0 seated
- **has room:** 1 to capacity − 1
- **full:** exactly capacity
- **over:** more than capacity

- A card keeps its **real position number** when filtered, so "table 7" remains 7.
- When filters hide every table, the board shows a "no tables match" message instead of a blank space.
- Filters live in component state and **reset on refresh**. Nothing is stored.

## 4. Data model

No change. `tables.sort_order int not null default 0` already exists, `listTables()` already orders by it, and `PATCH /api/tables/[id]` already accepts it.

## 5. Real-data note

Reordering writes `sort_order` on real table rows. It is reversible (move the table back), touches no guest rows, and needs no seeding or test data.

## 6. Definition of done

- Each card shows its position number, and ▲▼ and the number field reorder the tables persistently.
- The floor-plan list, printout and export follow the new order.
- The name, shape and fullness filters narrow the cards, combine correctly, and show the empty-match message.
- Order controls are disabled while a filter is active.
- Every new label lives in `strings.seating` in `lib/strings.ts`. It is Hebrew only, like the rest of the admin area.
- `npm run build` and `npm run lint` pass.
