# Progress & Handoff

**Last updated:** 2026-07-30 · branch `main` · pushed to `DmitriPer/weddingRsvp`

The purpose of this file is that a different machine, or a different session, can pick this up with no gaps. **Update it whenever a phase lands** — if it drifts from reality it is worse than not existing.

Companion docs: `wedding-rsvp-PRD.md` (what to build) · `architecture.md` (how it's structured) · `conventions.md` (how to write it) · `setup-database.md` (Supabase setup) · `carry-over.md` (why this is a rebuild).

---

## 1. Getting running on a fresh machine

```bash
git clone git@github-personal:DmitriPer/weddingRsvp.git && cd weddingRsvp
npm install
```

### ⚠️ The remote host is `github-personal`, not `github.com`

There are two GitHub accounts on Dmitri's machine, and this repo must use the personal one:

| | |
|---|---|
| `DmitriPer` | **personal** — owns this repo |
| `Dimitri-Pereimak` | **work** — the default SSH key (`~/.ssh/id_ed25519`, labelled `dimitrip@PRES.global`) |

`~/.ssh/config` defines a `github-personal` alias pointing at `github.com` but forcing `~/.ssh/id_ed25519_personal` with `IdentitiesOnly yes`, so it can never fall back to the work key.

**Cloning with a plain `github.com` URL authenticates as the work account.** If a remote is ever wrong:

```bash
git remote set-url origin git@github-personal:DmitriPer/weddingRsvp.git
ssh -T git@github-personal      # must answer "Hi DmitriPer!"
```

On a *new* machine, recreate the alias in `~/.ssh/config` and add that machine's public key to the **DmitriPer** account:

```
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes
```

Commit *authorship* is separate and already handled: an `includeIf "gitdir:~/TestAndLearningENV/"` rule in `~/.gitconfig` sets `Dmitri.P <Dimitri.pereimak@gmail.com>` for everything under that directory, with `useConfigOnly = true` so git refuses to commit rather than silently using the work email.

### Branches

| Branch | What it is |
|---|---|
| `main` | **the rebuild** — this work |
| `old` | the abandoned brownfield adaptation of `amirgal/wedding-rsvp`, preserved intact |
| `feat/*`, `design/*`, `claude/*` | leftovers from the old app, untouched |

`main` and `old` share **no history** — `main` began as an orphan branch. Don't try to merge them.

Create `.env.local` (gitignored, never committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SITE_URL=http://localhost:3030
```

Keys come from Supabase → Project Settings → API Keys. **New key format** (`sb_publishable_` / `sb_secret_`), not the legacy anon/service_role JWTs. The secret key is server-only and must never be prefixed `NEXT_PUBLIC_`.

The Supabase project already exists and is set up. To build a *second* environment from scratch, follow `setup-database.md` — run migrations 001→003 in the SQL Editor, then `npm run create-admin`.

```bash
npm run dev      # http://localhost:3030
npm run build    # this is the type check; there is no test suite
npm run lint
```

**Test data:** run `supabase/migrations/004_seed_test_data.sql` in the SQL Editor for ~12 invented households covering every state. All marked `__test__`; remove with `delete from invites where name like '%__test__%';`

---

## 2. What works today

Verified against the real database, not just compiled:

- **Both auth locks.** `proxy.ts` redirects `/admin/*` to login; every admin API route independently returns 401. Tested separately.
- **RLS is real.** With a row present, the publishable key reads 0 rows and its inserts are rejected by policy. The secret key appears in no client bundle.
- **Full RSVP lifecycle** through `POST /api/rsvp`: submit → edit → decline, placeholder reconciliation, cascade deletes, append-only history, crawler rejection on `opened`.
- **Admin panel**: log in, add households with their people, edit, delete, search, sort, filter, WhatsApp, copy link, history.

## 3. Requirement status

| PRD § | Requirement | Status | Where |
|---|---|---|---|
| §6.1 | Guest RSVP flow | ❌ **not built** | — |
| §6.2 | Guest confirmation screen | ❌ | — |
| §6.3 | RSVP deadline hard close | ⚠️ **API only** | enforced in `app/api/rsvp/route.ts`; no UI |
| §6.4 | Public landing page | ❌ | `app/page.tsx` is still scaffold boilerplate |
| §6.5 | Config-driven details | ⚠️ **backend only** | `/api/config` works; no Settings UI |
| §6.6 | Admin guest management | ✅ | `components/admin/invite-*.tsx`, `attendee-list.tsx` |
| §6.7 | Import / export | ❌ | `exceljs` installed, unused |
| §6.8 | Copy invite link | ✅ | `copy-link-button.tsx` |
| §6.9 | Per-row `wa.me` | ✅ | `wa-send-button.tsx` |
| §6.10 | Contact tracking | ✅ | confirms before counting — see §5 below |
| §6.11 | Stats | ✅ | tiles on `app/admin/page.tsx` |
| §6.12 | History | ✅ | `history-modal.tsx` |
| §6.13 | Day-of reminder prep | ❌ | — |
| §6.14 | Thank-you prep | ❌ | — |
| §6.15 | OG image + client-side `opened` | ⚠️ **API only** | `/api/invites/[id]/opened` exists and rejects crawlers; nothing calls it |
| §6.16 | Asset upload | ❌ | bucket exists (migration 003) |
| §6.17 | Seating | ⚠️ **API only** | `/api/tables` CRUD done; `app/admin/seating` is a placeholder |
| §6.18 | Admin auth | ✅ | `lib/auth.ts`, `proxy.ts`, `app/admin/login` |
| §6.19 | Empty / loading / error states | ⚠️ partial | `components/ui/states.tsx` exists, used in some places |

**Backend is essentially complete.** 11 API routes, all of `lib/`, the data layer. What's missing is mostly UI.

---

## 4. What to do next, in order

### Next: the guest RSVP page — this is the blocker

Nothing else matters as much: **guests cannot RSVP at all.** Invite links resolve to a broken Next.js welcome page. Building it closes the loop and makes the whole thing testable end to end.

Covers §6.1–§6.4 together:

- `app/page.tsx` — replace the scaffold. Reads `?token=` (**`searchParams` is a Promise in Next 16 — await it**). No token or unknown token → public landing page from `wedding_config`. Valid token → the invitation.
- `components/guest/invitation-form.tsx` — per-person checkboxes, an "add guest" control for unnamed `+1`s (adult/child), submit.
- Declining must zero everything — the API already does this; the UI just needs to hide the ticks.
- `components/guest/confirmation.tsx` — what was saved, plus date and venue.
- `components/guest/rsvp-closed.tsx` — read-only past the deadline with "call us on `contact_phone`". **The API already rejects late submissions; this is the matching UI.**
- `components/guest/mark-opened.tsx` — a **Client Component** that POSTs to `/api/invites/[id]/opened`. It must never run during server rendering; see §5.

Data comes from `getInviteByToken()` and `getConfig()` in `lib/data`.

### Then, in rough priority

1. **Import** (§6.7) — hand-typing 150 households is the next real pain. `exceljs` is already installed.
2. **Settings tab** (§6.5) — config and the three templates are only editable in Supabase today.
3. **Seating** (§6.17) — API is done, needs the board UI. `attendees.table_id` is the assignment.
4. **OG preview image** (§6.15) — invites currently send as bare text cards.
5. **Day-of and thank-you lists** (§6.13, §6.14) — same shape as the invitee list, filtered.
6. **Export** (§6.7) — caterer headcount, arrival list.

---

## 5. Things not to rediscover the hard way

Each of these cost real time or was found by testing. They are all live decisions, not history.

**`opened` must be marked from client-side JavaScript only.** WhatsApp fetches the invite page *and* its OG image to build a preview card. Marking `opened` during server rendering flips every invite the moment it is **sent**, destroying the "who hasn't looked yet" filter that the entire follow-up workflow depends on. Crawlers don't run JS. The User-Agent check in `lib/bots.ts` is a backstop, not the mechanism.

**The WhatsApp button asks before counting.** WhatsApp gives no send callback, so tapping opens the chat and the row asks "נשלח?" — nothing is recorded until answered. Counting an opened-then-abandoned chat would inflate `contact_attempts`, which drives the "needs a phone call" flag; the follow-up list would claim people were messaged five times when they were never contacted.

**The `wa.me` link is a plain `<a target="_blank">`, never `window.open()` after an `await`.** Browsers block popups opened asynchronously, which silently breaks the one action that screen exists for.

**Phone search normalises to national significant digits.** Numbers are stored international (`+972…`) but anyone here types them local (`05…`), and `972501111111` does not contain `0501111`. Without normalisation, searching by phone silently finds nothing. See `phoneDigits()` in `lib/invite-filters.ts`.

**Guard every uuid lookup with `isUuid()`.** `invites.token` and all ids are `uuid` columns; querying one with a non-UUID string makes Postgres throw rather than return empty. A guest with a mangled link got a 500 instead of a clean "invalid link" page.

**Row labels show *invited* before an answer, *coming* after.** Showing only the attending count made every freshly added invite read "0 guests", because the admin adds people and the *guest* ticks them. See `summarizeAttendance()` in `lib/headcount.ts`.

**`is_attending` is not admin-editable, deliberately.** It is the guest's answer. Letting the admin set it would make the headcount a claim rather than a record.

**Don't run `npm audit fix --force`.** It proposes downgrading `next` to 9.3.3. Plain `npm audit fix` has previously introduced a `brace-expansion` *downgrade* that made things worse. The 12 high-severity findings are the out-of-the-box state of a new Next.js scaffold — ESLint toolchain and `next` inheriting `postcss`/`sharp`.

**WhatsApp automation was investigated and rejected** (2026-07-30). The Cloud API can genuinely automate sending, costs only a few dollars for this volume, and no longer needs upfront business verification — but WhatsApp's Business Terms require Business Services be used "solely for business, commercial… and not for personal use," and guests have not opted in to business messaging. A new SIM on the regular app gives *no* automation at all (no API; broadcasts only reach people who saved your number) while adding ban risk and worse open rates. Sending stays manual from the personal number. Don't re-open without new information.

---

## 6. Known issues

- **`app/page.tsx` is scaffold boilerplate** and references `/next.svg`, which was deleted — the site root renders a broken Next.js welcome page. Fixed by building the guest page.
- **`docs/project-explainer.html` describes the old brownfield app.** Historical; regenerate once the app is complete.
- **Free-tier Supabase projects pause after ~a week of inactivity** — a paused project means guests clicking their link see errors. Must be addressed before real invitations go out. See `setup-database.md` §1.
- **`NEXT_PUBLIC_SITE_URL` must be the real domain before sending anything.** Left on localhost, every invite link sent is dead, and you'd only find out from a guest.

---

## 7. Commit history

```
c882674  Rename branches: the rebuild is now main, the old app is on old
c9b2737  Add docs/progress.md as the handoff document
4668f1a  Confirm a WhatsApp was sent before counting it
e12678a  Complete the invitee table: search, sort, WhatsApp, copy link, history
12f80ca  Add edit and delete on invite rows; fix the attendance label
3e72152  Add guest form on the invitees screen
8260f5b  Remove mock-store references from the docs
ce128a4  Add admin login, shell, and Hebrew RTL layout
e80036f  Add backend: lib modules, data layer, and API routes
fa4888e  Start greenfield rebuild: scaffold + specs
```

## 8. Working agreement

From `claude-workflow.md`, and it holds: **PRD first, clarify by asking rather than assuming, Plan Mode before code.** Standing hard rules — no automated or bulk WhatsApp sending ever; function and data before styling; no real guest data until Dmitri says so; all data access through `lib/data`; Hebrew/RTL from day one.

**Commits carry no `Co-Authored-By` trailer.**
