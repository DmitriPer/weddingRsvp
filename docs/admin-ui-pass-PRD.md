# Admin UI Pass — Mobile, RTL, Layout

**Owner:** Dmitri
**Status:** agreed 2026-09-24, not yet built
**Surface:** admin only (`app/admin/`, `components/admin/`). The guest page is untouched.

## 1. Mission

The admin area works, but it breaks on a phone and is uncomfortable at a desk. The invitees page scrolls sideways on mobile, some arrows and numbers point the wrong way in RTL, settings inputs don't line up, and on desktop the rows and toolbars are hard to scan. This pass fixes layout, alignment and direction. **The look stays the same:** no new colours, fonts, borders or components, and no change to what anything does.

Found by inspecting the live admin in Chrome on 2026-09-24, at 1440px and at 352–390px.

## 2. Scope

| In scope | Out of scope |
|---|---|
| Layout, alignment and RTL direction on invitees, seating, settings, header | New colours, fonts, components, visual redesign |
| Mobile breakage (sideways scroll) and desktop comfort | The guest page |
| | Any behaviour, data or API change |
| | The budget page |

## 3. Changes

### 3.1 Mobile and RTL bugs

- **Invitee row overflow.** The action button group (`invite-row.tsx`) is `shrink-0` and needs ~350px, which widens the page to 559px on a 352px screen. Below `md`, the actions move to their own full-width row under the name and status, and wrap.
- **Expand arrow.** `◂` when collapsed, `▾` when open. `▸` points away from the content in RTL.
- **Table number.** A small badge with just the number. `1.` renders with the period on the wrong side.
- **Physical classes.** `text-left`, `text-right`, `mr-*`, `left-*` and `right-*` become logical classes (`text-start`, `text-end`, `me-*`, `start-*`, `end-*`). The exception is where the physical side is intended, such as floor-plan coordinates.

### 3.2 Settings alignment

- Each field's hint moves **below** its input, so inputs in the same row start at the same height.
- All inputs are **right-aligned**. Phone and date values keep LTR digit order inside the field.

### 3.3 Invitees, desktop

- **Row as three fixed columns:** name, phone and side · status and headcount · actions. The actions sit at a steady position instead of ~1,100px from the name.
- **The toolbar is grouped into rows:**
  1. search and the phone toggles
  2. status and answer chips
  3. dropdowns and sort
- **The import panel starts collapsed:** a native `<details>`, like the stats breakdown.

### 3.4 Seating

- **The first header line never wraps:** number badge, shape, name and occupancy. The name truncates.
- **▲▼ and the position field join ✎ ✕ on a second header line,** ordering at the start and edit/delete at the end. A card is only ~285px wide at three columns, too narrow for everything on one line without crushing the name.
- **Content width:** invitees and seating widen from `max-w-6xl` to `max-w-7xl`. Settings stays narrow.
- **Mobile selection bar:** while people are selected, the bar sticks to the bottom of the screen, so the admin can scroll to a table and place them.

## 4. Data model

No change.

## 5. Definition of done

- No horizontal scroll at 360px on invitees, seating and settings.
- Desktop checked at 1440px.
- Each change is verified in Dmitri's Chrome tab by **viewing and scrolling only, never saving.** The database holds real guest data.
- `npm run build` and `npm run lint` pass.
