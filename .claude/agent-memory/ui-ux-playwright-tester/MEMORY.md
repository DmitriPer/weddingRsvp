# UI/UX Playwright Tester — Persistent Memory

## Environment
- Playwright runs inside Docker — always use `http://host.docker.internal:3030` (never localhost)
- Screenshots must be saved to `/tmp/` (no write access to `/app/`)
- Dev server port: 3030

## Auth / Test Data
- Admin credentials are in `.env.local` (ADMIN_EMAIL / ADMIN_PASSWORD)
- Valid invite tokens can be fetched by calling `/api/invites` from within an authenticated browser session
- Tokens are UUIDs stored in `invites.token` — not exposed in DOM text, only in JS bundle props and API responses

## Key Architecture Notes (confirmed)
- `fonts.ts` uses `Assistant` for `--font-display-var` (not Heebo as CLAUDE.md says) and `Heebo` for `--font-body-var`; `DanaYadAlefAlefAlef` local font for handwriting h1
- `globals.css` defines `.font-display`, `.font-body`, `.font-handwriting` classes
- Admin data loads asynchronously — wait ~2s after navigation before taking screenshots or the tab counts will show 0
- Response detail panel: clicking a row in the Responses tab opens an inline panel (not a route change) showing full submission history

## Admin Dashboard Observations (confirmed working)
- Stats cards load with data after async fetch
- Three tabs: מוזמנים / תשובות / סטטיסטיקה — all functional
- Responses tab rows are clickable and open a detail/history panel
- Status filter pills work correctly (toggle active, count reflects filtered set)
- XLSX export button is disabled when no invites match the filter

## Known Issues Found (Feb 2026 session)
See detailed report in session. Key issues:
1. Admin data loading shows "0" briefly before fetch — no skeleton/loading state on tab counts in header
2. Admin invitees table has horizontal overflow on mobile (375px) — columns overflow right edge, no horizontal scroll affordance visible
3. "לא אוכל להגיע" decline button has very low visual weight — looks like plain text link, easy to miss
4. Border accent on "editing" notice is on wrong side for RTL — `border-r-2` puts it on right, but RTL reading direction means left is the leading edge
5. Page title `הוזמנתם` is the same for all states (valid RSVP, 404, admin) — no per-page title differentiation
6. `Copy link` button label is English in a Hebrew-language UI
7. Guest name "wer", "ds", "test" etc. in DB are test data — not a bug but worth noting for production
8. Login error message uses red-600 which clashes slightly with the warm Garden Letter palette
