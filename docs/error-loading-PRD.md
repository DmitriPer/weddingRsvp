# Error Screens, Loading Screens and Action Pending States

**Owner:** Dmitri
**Status:** agreed 2026-09-29
**Surface:** admin, games, and the guest page's error screen

## 1. Mission

Two annoyances, fixed together:

1. **A broken page is a dead page.** A server error shows Next's bare error page, and a tab switch shows nothing until the next page is ready.
2. **A saving action gives no clear feedback.** Across the admin, the "working" state ends when the request returns, but *before* the fresh data is on screen. The button comes back while the old state is still showing: a seated guest still at the old table, a dragged table jumping back, a deleted row still listed. Some actions show nothing at all. Several get stuck "working" if the network drops, and some can be double-clicked.

**No change to what any action saves or any page does.** No redesign.

## 2. Scope

| In scope | Out of scope |
|---|---|
| `error.tsx` for admin, games and guest; `global-error.tsx` | A 404 page |
| `loading.tsx` for admin and games | A guest-page loading screen (see §3.3) |
| A pending state on every admin/games mutation, lasting until fresh data shows | New optimistic logic, e.g. guests moving before the save completes |
| Spinner, no double-submit, errors always recover | Changing any API or data |

## 3. Screens

### 3.1 Error screens

| Where | Behaviour |
|---|---|
| Admin (every tab and login) | Inside the admin frame, so the header and tabs **keep working**. Shows "משהו השתבש", a "נסו שוב" button that re-fetches the segment (`unstable_retry`), and the error code (digest) for matching server logs |
| Games | The same, inside the games frame |
| Guest page | Hebrew **and** Russian together, because the language may not have loaded. A "נסו שוב · Попробовать снова" button. Phone-first |
| Root layout crash | `global-error.tsx`: the same bilingual screen with its own `<html>`/`<body>`; it reloads the page |

### 3.2 Loading screens

`loading.tsx` in admin and games shows "טוען…" inside the frame, so a tab responds immediately.

### 3.3 No guest loading screen (deliberate)

It would flash in front of the invitation artwork on every open from WhatsApp. It would also change how the page streams, and that page's metadata builds the WhatsApp preview card, which is live.

## 4. Action pending states

### 4.1 One shared pattern

- **`useAction()`**, built on React's `useTransition`, runs a request and then `router.refresh()`. `pending` stays true **until the refreshed data renders**, not just until the request returns.
- **Every failure** shows a toast, and the pending state always clears. Nothing gets stuck.
- **A `Spinner`** is shown inside the busy button or row. Controls for that action are disabled while it's pending, so double submits are impossible.

### 4.2 Where

| Area | Actions |
|---|---|
| Seating board | Place / unseat guests (label shows the count, e.g. "מושיב 3…"), reorder ▲▼ and the position field, edit / delete a table (delete had no guard) |
| Table manager | Create a table |
| Seating map | Rotate (fast clicks were lost), drag (the table stays where it was dropped instead of snapping back) |
| Invitees | Add invite, edit invite, delete, bulk delete, add / rename / change type / remove a person (Enter could double-add), "נשלח? כן" |
| Budget | Add / delete a row, the minimum field (cell edits already optimistic) |
| Bingo | Add / delete a square (edits already optimistic) |
| Settings | Save config, save a template, image upload / select / delete, import (while importing it showed "בודק…" instead of "מייבא…") |
| Header | Sign out |

## 5. Definition of done

- A forced error on the guest page shows the bilingual screen. The test route is local only and deleted before commit.
- On every action in §4.2, the busy control shows a spinner until the new state is visible. There is no stuck state and no double submit.
- `npm run build` and `npm run lint` pass.
- Checked by Dmitri on the live admin. The data is real: normal use only, no test writes.
