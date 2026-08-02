# Progress & Handoff

**Last updated:** 2026-08-02 · branch `main` · pushed to `DmitriPer/weddingRsvp`

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
| §6.15 | OG image + client-side `opened` | ✅ **built, unverifiable locally** | `generateMetadata` in `app/page.tsx`, card at `public/assets/og-card.jpg`. `opened` wired from `mark-opened.tsx`. WhatsApp itself can only confirm it once the site is on a public domain |
| §6.16 | Asset upload | ❌ | bucket exists (migration 003) |
| §6.17 | Seating | ⚠️ **API only** | `/api/tables` CRUD done; `app/admin/seating` is a placeholder |
| §6.7b | Bilingual guest side (he/ru) | ✅ | `lib/strings.ts` `guestText()`, `guest-shell.tsx` |
| §6.18 | Admin auth | ✅ | `lib/auth.ts`, `proxy.ts`, `app/admin/login` |
| §6.19 | Empty / loading / error states | ⚠️ partial | `components/ui/states.tsx` exists, used in some places |

**Backend is complete; the guest side, settings and the WhatsApp preview are built.** What remains is import/export and seating.

---

## 4. What to do next, in order

### `wedding_config` — filled in, 2026-07-31

Set from `/admin/settings`: **ניקול ודימה**, **8 באוקטובר 2026, 18:30**, "החצר של רוז", המלאכה 27, נתניה. Read back live from the WhatsApp preview tags, so these are the values guests now see in the card, the calendar file and the confirmation screen.

The invitation artwork in `public/assets/demo-invitation.jpeg` still shows `00:00` for both ceremony times — the artwork is the designer's to correct, not the app's.

Still worth checking: `contact_phone`, which the deadline-closed screen offers as "call us instead".

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
2. **Look at the WhatsApp card the moment the domain is live** (§6.15, built 2026-07-31). Send yourself one invite. If the picture is missing, the causes in order of likelihood are: `NEXT_PUBLIC_SITE_URL` still wrong, the URL not reachable from outside, or the file over ~600 KB — `npm run og-card` refuses that last one, so it should be impossible.
3. **Swap in the final artwork** when the designer delivers — see the spec in §5. Two steps, not one: the constant in `components/guest/invitation-backdrop.tsx`, then `npm run og-card <new-file>` to rebuild the preview card and commit it. Forgetting the second leaves the chat preview showing the *old* invitation, which nothing in a build will tell you.
4. **Import** (§6.7) — hand-typing 150 households is the next real pain. `exceljs` is already installed.
5. **Seating** (§6.17) — API is done, needs the board UI. `attendees.table_id` is the assignment.
6. **Day-of and thank-you lists** (§6.13, §6.14) — same shape as the invitee list, filtered.
7. **Desktop pass on the guest page**, then mobile on admin — in that order, per the viewport rule.
8. **Export** (§6.7) — caterer headcount, arrival list.

---

## 5. Things not to rediscover the hard way

Each of these cost real time or was found by testing. They are all live decisions, not history.

**Israeli phones are normalised on input** (2026-08-02, `lib/phone.ts`). `0549546899` becomes `+972549546899` at every entry point — the add form, the edit form and the importer — so the database holds one form. The failure it prevents is silent: `wa.me` takes digits only, so a locally-written number stored as typed produced `wa.me/0549546899`, which resolves to nothing while looking perfectly fine.

**A leading `+` is never touched.** That is the escape hatch for a foreign guest, and it means the Israel assumption can stay hardcoded without trapping anyone. Anything unrecognisable is stored AS TYPED and flagged rather than guessed at — a wrong number that looks right is worse than one that looks wrong.

**The preview card PAINTS the date and venue onto the artwork** (2026-08-02), so they are language-dependent and `npm run og-card` now builds two files — `og-card.jpg` and `og-card-ru.jpg`. Rebuild BOTH and commit both whenever the date, the venue or the artwork changes; they are static files, so nothing at runtime regenerates them and nothing in a build will notice they are stale.

The Latin couple name is identical in both by design — the invitation is lettered "NICOLE & DIMA".

**The venue name has two jobs, split by job rather than by language** (2026-08-02). `venue_name` is what Waze searches and is never translated; `venue_name_ru` is display only, for the preview line and the guest page. Waze finds the Hebrew address and may find nothing for a Cyrillic transliteration, so a guest tapping "Как добраться" into a dead end is the failure this avoids. Blank `venue_name_ru` falls back to Hebrew — the OPPOSITE of the message templates, which must not fall back, because a Hebrew address is still usable to a Russian speaker while a whole Hebrew invitation is not. See `lib/venue.ts`.

**Ship the migration BEFORE the code that needs it** (2026-08-02). The settings form started sending `venue_name_ru` while the column did not exist yet, so the first thing Dmitri saw was a 500 on save rather than a new field. Migration first, then the code.

**Never `rm -rf .next` while the dev server is running** — it wipes the manifests mid-session and the server starts throwing ENOENT for `build-manifest.json`, which looks like an application bug and is not. Stop the server first.

**`do $$ … end $$;` blocks did not execute in the Supabase SQL editor** (2026-08-02). Migration 005 was written with DO blocks to make its `RENAME COLUMN` statements re-runnable. Running the file reported no error and changed nothing — the columns simply were not there afterwards, and only a query against `information_schema` revealed it. Rewritten as plain statements, which ran first time.

The lesson is not about DO blocks specifically: **a migration that silently does nothing is worse than one that fails loudly.** Always verify a migration against `information_schema` rather than trusting the editor's "Success". 005 is therefore NOT re-runnable, and says so at the top.

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

**The guest surface is green and white. The four pastels were applied and then removed** (2026-07-31, Dmitri's call). The designer's "Hortênsia" set — butter `#FFECB5`, sky `#B7C6E6`, lilac `#CDB7D9`, blush `#FAC6DF` — was used as butter action buttons, a lilac ring on the greeting pill, a lilac sheet handle, a sky checked-row tint and a blush declined panel. All five usages are gone, and the tokens are **deleted from `app/globals.css`** rather than left unused: an unused token gets reached for.

The reason is not contrast — butter and blush both passed. The artwork already carries the colour, and a second palette laid on top of it competes with the thing it is supposed to frame. What replaced each: the secondary action buttons are `.frosted` with a green hairline, the greeting pill has no ring, the headcount and declined panels use `border-bloom-ink/25 bg-paper/60` — the same box the form's counters already used.

**Colour that is not text goes on as an edge or a faint wash of the ink itself** — `border-bloom-ink/25`, `bg-bloom-ink/10` — never a filled panel of another hue. That is the rule the removal leaves behind.

The greens stay. Not one of the palette's colours could carry body text on white — the best, the green, is 2.83:1 against a 4.5:1 requirement — so the two ink values are **derived**, not supplied: the palette green's own hue (100°) darkened until it passes.

| Token | Hex | On white | Use |
|---|---|---|---|
| `--bloom-display` | `#7FA46D` | **2.83:1** | the palette green — **large text only** |
| `--bloom-ink` | `#567348` | 5.33:1 | AA — labels, buttons, body |
| `--bloom-strong` | `#475F3B` | 7.08:1 | AAA |

Using `--bloom-display` for a form label is the mistake to avoid: it looks right on a monitor and vanishes on a phone outdoors.

The palette green also confirms the artwork: sampling the invitation's own ink gave `#7DA169`, within a few points of `#7FA46D`. Artwork and palette are one system — which is why removing the pastels costs nothing.

**The frosted sheet is 88% white, not less.** It rises over the bottom florals — the most saturated part of the artwork — where `--bloom-strong` still measures 7.46:1. At 50% it fails. See `.frosted` in `app/globals.css`.

**The artwork path lives in exactly one constant**, `ARTWORK` in `components/guest/invitation-backdrop.tsx`. Swapping the designer's final file is a one-line change, which is the whole reason it is not referenced anywhere else.

**Artwork spec for the designer** — written up in full, in Hebrew, at `docs/designer-brief.html`. The demo card is 597×843 (aspect 0.708) and a phone is ~0.462, so `cover` would slice the floral arch down both sides; the backdrop uses `contain` until the tall asset arrives.

- **Phone background — 1290×2796 (9:19.5, the phone's own shape).** Not 1080×1920: modern phones are taller than 16:9. Florals rearranged into a tall frame. Keep the top ~320px and bottom ~520px clear of anything load-bearing — the greeting and action bar sit there. JPEG, ≤400 KB so it paints on cellular.
- **WhatsApp card — 1200×630 landscape.** Names and date legible as a chat thumbnail. Under 600 KB or WhatsApp drops the preview.

**The WhatsApp card is a committed file, not a rendered route** (built 2026-07-31). `npm run og-card [source]` → `public/assets/og-card.jpg`, 1200×630, currently **49 KB**: the floral banner in `public/assets/demo-og-source.jpg` with the monogram, then the names, date and venue painted into its centre from `wedding_config`. Things worth knowing before touching it:

- **It does not follow the settings tab.** A page re-reads config on every request; a file does not. Change the date in `/admin/settings` and the card keeps showing the old one until someone re-runs the script — silently, because every screen in the app will be correct. This is the most likely way the card goes wrong.
- **Hebrew is painted through an SVG overlay, NOT `next/og`.** Satori, which `next/og` uses, does no bidirectional reordering: `ניקול ודימה` renders as `המידו לוקינ` — right glyphs, laid out left-to-right. It looks like a font problem and no font fixes it. librsvg shapes through Pango, which implements bidi, and gets both the Hebrew and the mixed Hebrew/number date line right. Verified by rendering both.
- **The names on the card are Latin, and deliberately not from config.** `OG_COUPLE_NAMES` in `lib/og.ts` is `Nicole & Dima`, read by *both* the card builder and `generateMetadata`, so the picture and the bold line WhatsApp prints beneath it cannot disagree — they did once, which is why the constant is shared. `wedding_config.couple_names` stays Hebrew because it titles the `.ics` event. Blank the constant and both fall back to config.
- **Two renderers, each where it works.** The Latin name goes through Satori (`next/og`) because Satori accepts a typeface **as a buffer**, which is the only way to guarantee identical lettering on every machine; the Hebrew lines go through Pango, which is the only one of the two that implements bidi. A Hebrew name falling back from config takes the Pango path too, rather than being silently reversed.
- **The names are set in Cormorant SC**, vendored at `assets/fonts/CormorantSC-Light.ttf` (290 KB, build-time only, never served). Chosen by rendering Cormorant SC, Cormorant Garamond, EB Garamond and Cinzel beside a crop of the invitation: the Garamonds have no small caps at all, and Cinzel is wider and more evenly stroked than the artwork's fine hairlines.
- **The Hebrew lines still come from whatever the machine has**, through fontconfig — Heebo when installed, otherwise Noto Sans Hebrew, which is what the committed card is set in. Worth *looking at* the card after a rebuild for that reason, which is why the script prints the values it painted.
- **Moving the name changes the spacing of everything below it.** The Satori block is a positioned layer of its own, so the rule, date and venue are placed relative to it by hand. Getting this wrong once put the rule straight through the middle of the names.
- **The 600 KB ceiling fails silently.** Over it, WhatsApp shows the preview with *no picture* and reports nothing — you would be left inspecting tags that are all perfectly correct. `scripts/build-og-card.ts` refuses to write a file that big, because the only other place this surfaces is a guest's phone.
- **Portrait art cannot fill a landscape slot, and WhatsApp resolves that by cropping from the centre** — straight through the floral arch. The script composes the exact 1200×630 frame instead: a landscape source is cropped to fill, a portrait one is fitted whole onto its own sampled paper colour.
- **`generateMetadata` takes no arguments on purpose.** It runs on the crawler's fetch. Without the token it *cannot* look an invite up, so the "never mark `opened` server-side" rule holds by construction rather than by remembering to. If you ever give it `searchParams`, you have re-opened the bug that flips every invite to `opened` the day they are sent.
- **`sharp` is a devDependency and script-only.** It was already in the tree as a `next` dependency; declaring it stops `npm prune` removing it. Never import it from `app/` or `lib/`.

**The monogram is one file, `public/assets/wedding-logo.svg`** (Dmitri's, 2026-07-31) — the couple's ND mark traced from the invitation, three paths, 3.8 KB, `#88A574`. It appears on the WhatsApp card, in the admin header, and as the app icons. **Its viewBox was tightened before use:** the supplied file was 1002×877 with the mark sitting in the lower middle, which at 32 px renders as a few green specks in a mostly empty square. The trimmed box is `275 364 466 399` plus 10 units of padding.

The icons are built from it: `app/favicon.ico` (16/32/48 in one 2.7 KB file, replacing the 25 KB Next default), `app/icon.png` 256, `app/apple-icon.png` 180 — Next emits all three `<link>` tags from the filenames alone, no config. They are a **white mark on a green tile**, not green on white: at 16 px in a tab strip a mostly-white icon disappears into the browser chrome. Rebuilding them is a scratchpad script, not a repo one — it has run once and the outputs are committed.

In the admin header the mark goes through `next/image` with `unoptimized`. The optimiser refuses SVG unless `dangerouslyAllowSVG` is turned on, and there is nothing it can do to a 3.8 KB vector — turning that flag on to no benefit would be the wrong trade.

**The card's source banner must be textless.** `public/assets/demo-og-source.jpg` was generated by Dmitri from an AI prompt (2026-07-31) — corner florals in the invitation's palette around an empty white middle, which is the space the names sit in. Ask any image generator for Hebrew and it returns letter-shaped nonsense, so the words are always composited afterwards by the script, never drawn by the tool.

**The wedding details are pixels, not text.** Dmitri's design puts names, date, time and venue inside the artwork. Changing the ceremony times means a new image from the designer, **not** a `wedding_config` edit. Config must still be filled, because navigation, the calendar file and the WhatsApp card all read from it — it just isn't what the guest sees on the invitation itself.

The card is the one place where config text is *rendered as artwork*, which is why it needs rebuilding when config changes. Everywhere else, config edits take effect on the next page load.

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
- **`NEXT_PUBLIC_SITE_URL` is also inside the WhatsApp card now.** `og:image` must be an *absolute* URL — a crawler has no page context to resolve a relative one against — so the card's address is built from the same variable as the invite links. While it reads `http://192.168.68.114:3030`, the tags point the whole world at a machine on Dmitri's Wi-Fi. One variable, three things that break together.
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
