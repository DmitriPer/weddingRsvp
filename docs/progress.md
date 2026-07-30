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

### ⚠️ On the work MacBook the remote host is `github-personal`, not `github.com`

**This section applies only to machines that have both GitHub accounts on them** — i.e. the work MacBook. On a personal-only machine (the Linux desktop) there is no work key to fall back to, so a plain `github.com` remote over HTTPS is correct and the alias below is unnecessary; setting it there just breaks pushes, because neither the alias nor the key exists.

Two GitHub accounts live on the work machine, and this repo must use the personal one:

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

That `includeIf` rule is path-scoped, so a clone outside `~/TestAndLearningENV/` — or on another machine — won't pick it up. All of `main` is authored `Dmitri.P <Dimitri.pereimak@gmail.com>`; keep it that way by setting the identity per-clone where the global default differs:

```bash
git config --local user.name  "Dmitri.P"
git config --local user.email "Dimitri.pereimak@gmail.com"
```

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

**Test data:** `supabase/migrations/004_seed_test_data.sql` has **not been run** on the live project — as of 2026-07-30 it holds one real invite and nothing else. Run it in the SQL Editor for ~12 invented households covering every state. All marked `__test__`; remove with `delete from invites where name like '%__test__%';`

---

## 2. What works today

Verified against the real database, not just compiled:

- **Both auth locks.** `proxy.ts` redirects `/admin/*` to login; every admin API route independently returns 401. Tested separately.
- **RLS is real.** With a row present, the publishable key reads 0 rows and its inserts are rejected by policy. The secret key appears in no client bundle.
- **Full RSVP lifecycle** through `POST /api/rsvp`: submit → edit → decline, placeholder reconciliation, cascade deletes, append-only history, crawler rejection on `opened`.
- **Admin panel**: log in, add households with their people, edit, delete, search, sort, filter, WhatsApp, copy link, history.
- **Settings tab** (2026-07-30): wedding details and the three WhatsApp templates, each saving independently, with a live preview and a warning for placeholders the renderer won't understand. `wedding_config` no longer needs the Supabase table editor.
- **The guest page, styled for mobile** (2026-07-30): the invitation artwork fills the screen, a frosted greeting sits at the top and a frosted action bar at the bottom (RSVP · ניווט · יומן), with the form rising in a sheet over the art. Landing, confirmation and deadline close all work. Verified end to end against the database — submit, edit, decline, placeholder reconciliation up and down, `edited` staying terminal, history appending each time, and a WhatsApp User-Agent failing to move the status while a browser moves it.

## 3. Requirement status

| PRD § | Requirement | Status | Where |
|---|---|---|---|
| §6.1 | Guest RSVP flow | ✅ | `components/guest/invitation-form.tsx`, `rsvp-screen.tsx` |
| §6.2 | Guest confirmation screen | ✅ | `components/guest/confirmation.tsx` |
| §6.3 | RSVP deadline hard close | ✅ | `app/api/rsvp/route.ts` enforces; `components/guest/rsvp-closed.tsx` shows |
| §6.4 | Public landing page | ✅ | the no-token branch of `app/page.tsx` — artwork only, no card |
| §6.5 | Config-driven details | ✅ | `app/admin/settings`, `components/admin/config-form.tsx`, `template-editor.tsx` |
| §6.6 | Admin guest management | ✅ | `components/admin/invite-*.tsx`, `attendee-list.tsx` |
| §6.7 | Import / export | ❌ | `exceljs` installed, unused |
| §6.8 | Copy invite link | ✅ | `copy-link-button.tsx` |
| §6.9 | Per-row `wa.me` | ✅ | `wa-send-button.tsx` |
| §6.10 | Contact tracking | ✅ | confirms before counting — see §5 below |
| §6.11 | Stats | ✅ | tiles on `app/admin/page.tsx` |
| §6.12 | History | ✅ | `history-modal.tsx` |
| §6.13 | Day-of reminder prep | ❌ | — |
| §6.14 | Thank-you prep | ❌ | — |
| §6.15 | OG image + client-side `opened` | ⚠️ **half** | `opened` wired from `mark-opened.tsx`. **The app exports NO OpenGraph metadata at all** — `generateMetadata` appears nowhere, so a shared link previews as a bare title and URL |
| §6.16 | Asset upload | ❌ | bucket exists (migration 003) |
| §6.17 | Seating | ⚠️ **API only** | `/api/tables` CRUD done; `app/admin/seating` is a placeholder |
| §6.18 | Admin auth | ✅ | `lib/auth.ts`, `proxy.ts`, `app/admin/login` |
| §6.19 | Empty / loading / error states | ⚠️ partial | `components/ui/states.tsx` exists, used in some places |

**Backend is complete; the guest side and settings are built.** What remains is import/export, seating, and the WhatsApp preview card.

---

## 4. What to do next, in order

### Next: fill in `wedding_config` — now a two-minute job in the UI

Go to **`/admin/settings`** and set the real ceremony time, the couple's names and the contact phone. As of 2026-07-30 these are still a placeholder, `"דמיטרי ו..."` and empty — the venue is correct. The time is the urgent one: it is **19:00, invented**, and it is what every guest who taps הוספה ליומן gets in their calendar.

The demo invitation card in `public/assets/demo-invitation.jpeg` carries the real details: **08/10/2026**, "החצר של רוז", המלאכה 27, נתניה. The ceremony times on it are still `00:00` placeholders.

### Then, the guest RSVP page — DONE 2026-07-30

Kept here because the reasoning still applies to anything built on top of it:

- `app/page.tsx` branches only; every rule it appears to apply lives in `lib/`.
- No token, an unknown token and a malformed token all render the **identical** landing page — verified by diffing the rendered markup. An unresolvable link must not reveal that it was unresolvable.
- Declining zeroes everything server-side, so the UI hides the ticks rather than pretending they still mean something.
- A first-time guest gets everyone pre-ticked, because `attendees.is_attending` defaults to `false` and reading that literally reads as "nobody is invited". After a decline the form correctly comes back blank, which is what the PRD asks for.
- `components/guest/rsvp-closed.tsx` — read-only past the deadline with "call us on `contact_phone`". **The API already rejects late submissions; this is the matching UI.**
- `components/guest/mark-opened.tsx` — a **Client Component** that POSTs to `/api/invites/[id]/opened`. It must never run during server rendering; see §5.

Data comes from `getInviteByToken()` and `getConfig()` in `lib/data`.

### Then, in rough priority

1. **Deploy to a public domain.** This has become the gate rather than a finishing step: the WhatsApp preview card cannot be verified at all without it, because WhatsApp fetches the URL from its own servers. It also retires the two LAN-only settings in §6. Set `NEXT_PUBLIC_SITE_URL` to the real domain at the same time.
2. **OpenGraph metadata and the preview card** (§6.15) — currently *nothing* is exported, so shared links look bare. The meta tags and a static card can be built against the demo artwork; the designer's 1200×630 asset and per-guest generation can follow. Worth doing right after deploying, so it can actually be seen.
3. **Swap in the final artwork** when the designer delivers — see the spec in §5. One constant in `components/guest/invitation-backdrop.tsx`, nothing else.
4. **Import** (§6.7) — hand-typing 150 households is the next real pain. `exceljs` is already installed.
5. **Seating** (§6.17) — API is done, needs the board UI. `attendees.table_id` is the assignment.
6. **Day-of and thank-you lists** (§6.13, §6.14) — same shape as the invitee list, filtered.
7. **Desktop pass on the guest page**, then mobile on admin — in that order, per the viewport rule.
8. **Export** (§6.7) — caterer headcount, arrival list.

---

## 5. Things not to rediscover the hard way

Each of these cost real time or was found by testing. They are all live decisions, not history.

**Two env-file traps, both of which fail silently.** Cost an hour on the Linux desktop (2026-07-30). The app boots normally under either one and only breaks when it touches data, so the symptom points nowhere near the cause:

1. **The file must be `.env.local`, with the leading dot.** A file named `env.local` is ignored by Next.js completely, and every Supabase call then fails as though the keys were wrong. `.gitignore` covers both spellings so neither can leak, but only the dotted one is *loaded*. Verify from the dev-server banner — it prints `Environments: .env.local`.
2. **`NEXT_PUBLIC_SUPABASE_URL` must be the bare origin**, `https://<ref>.supabase.co` — **never** the REST endpoint `https://<ref>.supabase.co/rest/v1/` that the dashboard shows next to the keys. The client appends `/rest/v1/` itself, so a pasted path produces `/rest/v1//rest/v1/invites` and every query 404s.

Two curls confirm the whole chain before starting the app:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$URL/auth/v1/health" -H "apikey: $PUBLISHABLE"   # 200
curl -s "$URL/rest/v1/invites?select=id&limit=1" -H "apikey: $PUBLISHABLE"                 # []
```

An empty `[]` is the *correct* answer, not a failure — RLS denying the publishable key is the design (§ RLS). An error body or a 404 means the URL is wrong.

**Never leave a backup copy of the env file in the repo.** `.gitignore` matches `.env.local` and `.env.*.local`, but **not** `.env.local.bak` — the obvious name for a backup is the one spelling that is *not* ignored, and it holds the secret key. Copy it outside the repo or don't copy it.

**The guest palette is the designer's "Hortênsia" set, and not one of its five colours can carry text.** Supplied 2026-07-17, applied 2026-07-30. Contrast against white paper:

| Token | Hex | On white | Use |
|---|---|---|---|
| `--bloom-display` | `#7FA46D` | **2.83:1** | the palette green — **large text only** |
| `--bloom-butter` | `#FFECB5` | 1.19:1 | decoration, or a background *behind* text |
| `--bloom-sky` | `#B7C6E6` | 1.52:1 | decoration only |
| `--bloom-lilac` | `#CDB7D9` | 1.77:1 | decoration only |
| `--bloom-blush` | `#FAC6DF` | 1.49:1 | decoration, or a background behind text |

So the two ink values are **derived**, not supplied — the palette green's own hue (100°) darkened until it passes:

| Token | Hex | On white | Use |
|---|---|---|---|
| `--bloom-ink` | `#5E7E4F` | 4.59:1 | AA — labels, buttons, body |
| `--bloom-strong` | `#475F3B` | 7.08:1 | AAA |

Using `--bloom-display` for a form label is the mistake to avoid: it looks right on a monitor and vanishes on a phone outdoors.

**Which pastels may sit behind text**, measured with `--bloom-strong` on top: butter **6.04:1 ✓**, blush **4.79:1 ✓**, sky 4.12:1 ✗, lilac 3.83:1 ✗. Sky and lilac are borders and ornament only — the confirmation screen uses butter behind the headcount and blush behind the declined message for exactly this reason.

The palette green also confirms the artwork: sampling the invitation's own ink gave `#7DA169`, within a few points of `#7FA46D`. Artwork and palette are one system.

**The frosted sheet is 88% white, not less.** It rises over the bottom florals — the most saturated part of the artwork — where `--bloom-strong` still measures 7.46:1. At 50% it fails. See `.frosted` in `app/globals.css`.

**The artwork path lives in exactly one constant**, `ARTWORK` in `components/guest/invitation-backdrop.tsx`. Swapping the designer's final file is a one-line change, which is the whole reason it is not referenced anywhere else.

**Artwork spec for the designer** — written up in full, in Hebrew, at `docs/designer-brief.html`. The demo card is 597×843 (aspect 0.708) and a phone is ~0.462, so `cover` would slice the floral arch down both sides; the backdrop uses `contain` until the tall asset arrives.

- **Phone background — 1290×2796 (9:19.5, the phone's own shape).** Not 1080×1920: modern phones are taller than 16:9. Florals rearranged into a tall frame. Keep the top ~320px and bottom ~520px clear of anything load-bearing — the greeting and action bar sit there. JPEG, ≤400 KB so it paints on cellular.
- **WhatsApp card — 1200×630 landscape.** Names and date legible as a chat thumbnail. Under 600 KB or WhatsApp drops the preview.

**The wedding details are pixels, not text.** Dmitri's design puts names, date, time and venue inside the artwork. Changing the ceremony times means a new image from the designer, **not** a `wedding_config` edit. Config must still be filled, because navigation and calendar read from it — it just isn't what the guest sees.

**Testing on a phone needs `allowedDevOrigins`, and the failure looks like a broken feature.** Next blocks `/_next/*` dev resources from any non-localhost origin. Open the dev server from a phone at `http://<lan-ip>:3030` without it and the page renders *perfectly* — server HTML is unaffected — buttons even highlight on tap, but **React never hydrates and nothing is interactive**. It reads as "the RSVP modal is broken", not "the JavaScript never loaded". The only visible clue is a warning in the dev server's own output.

```ts
// next.config.ts — development only, production serves no such resources
allowedDevOrigins: ['192.168.68.114'],
```

Update that address when the machine's LAN IP changes, and pair it with `NEXT_PUBLIC_SITE_URL` so copy-link produces reachable URLs.

**`<input type="datetime-local">` resolves in the BROWSER's timezone, not the wedding's.** It emits a naive wall-clock string, and `new Date("2026-10-08T19:00")` reads it wherever the laptop happens to be set — while every *display* in this app is pinned to Asia/Jerusalem by `lib/datetime.ts`. Editing the date from a laptop on another timezone would look correct in the form and be wrong in every guest's calendar.

Both directions therefore go through `toDateTimeLocalValue()` / `fromDateTimeLocalValue()` in `lib/datetime.ts`, which read and write Jerusalem wall-clock explicitly; the form sends a full ISO string with an offset, so `PATCH /api/config` stays unaware of any of it.

The autumn DST boundary is the case that catches a naive implementation: `02:30` on the night the clocks go back **does not exist** — 01:59 IDT becomes 01:00 IST — and the obvious single-correction algorithm happily returns that non-existent reading. `fromDateTimeLocalValue()` converts its answer back and checks it reproduces what was typed, trying the other offset when it doesn't. Verified across both boundaries.

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

- **⚠️ `wedding_config.wedding_date_time` is a PLACEHOLDER: `2026-10-08T16:00:00Z` = 19:00 Israel time.** Set on 2026-07-30 only so the הוספה ליומן button would render — the real ceremony time was not known, and the invitation artwork still shows `00:00`. **Every guest who taps הוספה ליומן gets this time in their calendar.** Fix it before a single invitation goes out.
- **`couple_names` is still `"דמיטרי ו..."` and `contact_phone` is empty.** The couple's name appears in the `.ics` SUMMARY, and the phone is what the past-deadline screen tells guests to call. `venue_name` is filled and correct.
- **A white gap sits between the artwork and the action bar on the demo.** The backdrop uses `contain` so the floral arch is never sliced; the leftover height is the aspect mismatch (0.708 art vs 0.462 phone) shown honestly. It disappears with the 1290×2796 asset — at which point switch the backdrop to `bg-cover bg-center`, as commented in `invitation-backdrop.tsx`.
- **The RSVP sheet has not been verified visually**, only structurally and functionally. No headless browser here can click, so tap through it once on a real phone before invitations go out.
- **`docs/project-explainer.html` describes the old brownfield app.** Historical; regenerate once the app is complete.
- **Free-tier Supabase projects pause after ~a week of inactivity** — a paused project means guests clicking their link see errors. Must be addressed before real invitations go out. See `setup-database.md` §1.
- **The app exports no OpenGraph metadata whatsoever.** `generateMetadata` appears nowhere, so an invite link shared on WhatsApp previews as the bare title `אישורי הגעה` plus the raw URL — no image, no couple names, no date. This is §6.15 and it is the largest remaining guest-facing gap. Note it cannot be truly verified without a public domain: WhatsApp fetches the URL from its own servers and can reach neither localhost nor the LAN address.
- **⚠️ `NEXT_PUBLIC_SITE_URL` is currently `http://192.168.68.114:3030`** — a LAN address, set 2026-07-30 so copy-link works when testing on a phone over Wi-Fi. It is **dead outside the house**. Every invite link built from it — the admin copy-link button and the WhatsApp message — carries this address. Set it to the real domain before a single invitation goes out; left wrong, you find out from a guest.

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
