# Wedding RSVP App — Product Requirements

**Owner:** Dmitri
**Status:** v3 — greenfield spec, the source of truth for what gets built.
**Date:** 2026-07-30
**Companion docs:** `claude-workflow.md` (process + hard rules) · `conventions.md` (code structure rules) · `carry-over.md` (what was learned from the abandoned base repo)

**v3 (2026-08-02):** bilingual guest side, Hebrew default and Russian per household (§6.7b) · six message templates · the import spreadsheet format, preview-before-write, and multi-select delete (§6.6, §6.7).

**v2 changes:** seating is in scope · unnamed +1s are now real person rows, removing `extra_adults`/`extra_kids` entirely · assets upload through the admin panel · RSVP deadline with a hard close · thank-you list redefined · search, sort, export, copy-link, confirmation screen added.

---

## 1. Mission

A wedding RSVP app for one wedding. Guests receive a personal link by WhatsApp and confirm who is coming. The couple manages the guest list, tracks who has responded, sends every message by hand, and arranges the seating.

This phase delivers a **working, guest-data-safe MVP — function and data first.** Deliberate visual design comes later.

## 2. Scope Boundaries

| In scope | Out of scope |
|---|---|
| Full data model and schema | Real guest data (invented test rows only — §8) |
| API routes and server logic | Deliberate visual design |
| Guest RSVP flow end to end | Automated or bulk WhatsApp sending, ever |
| Admin: list, search, add, edit, delete, import, export | Multi-admin access |
| Manual `wa.me` send + contact tracking | Guest-facing accounts or logins |
| Config-driven wedding details and templates | |
| Asset upload | |
| Seating / table arrangement | |

**On styling:** build the function and the data first. Screens should be plain, legible, and Hebrew/RTL-correct. Deliberate design is a separate later phase.

## 3. Hard Rules

Carried from `claude-workflow.md`. Not to be relitigated.

1. **No automated, scheduled, or bulk WhatsApp/SMS sending — ever.** Every outbound message is a manual human tap on a per-row `wa.me` button. Reason: risk of the couple's number being flagged or banned. The app *prepares* messages and *flags who needs one*; a human always decides when to send.
2. **Function and data before styling.**
3. **No real guest data until explicitly told otherwise.** The Supabase project exists and holds only invented test rows. Dmitri's actual guest list goes in when he says so, not before.
4. **All data access goes through one layer.** Every read and write goes through `lib/data` — never a Supabase client reached directly from a route or a component.
5. **Never touch the base repo author's live systems or real data.**

## 4. The Two Journeys

They never overlap. A guest never sees a login. An admin never sees the RSVP form.

**Guest — no login, ever.** Opens their personal link → sees their own household → ticks who is coming, optionally adds guests the admin doesn't know about → submits → sees confirmation → can return via the same link to edit, until the deadline.

**Admin — behind a login.** Signs in → sees every invite with status and headcount → adds/edits/deletes guests, imports or exports a spreadsheet → taps `wa.me` per row to send → tracks who hasn't responded → reads answers and history → edits wedding details and templates → arranges seating.

## 5. Data Model

Five tables.

```
invites  (one row per invitation)
  id            uuid pk
  token         uuid unique not null      -- the guest's credential
  name          text not null             -- invitation label, e.g. "Slava"; feeds {{name}}
  phone         text                      -- international format, for wa.me
  status        text not null default 'added'
                check ('added'|'pending'|'opened'|'submitted'|'edited')
  side          text check ('bride'|'groom'|'shared')
  relation      text check ('family'|'friend'|'work'|'invited_by_family')
  language      text not null default 'he' check ('he'|'ru')
                -- which language THIS household reads. Drives the guest page's
                -- text, its direction, its artwork, and which WhatsApp template
                -- the wa.me button renders. Hebrew is the default; Russian is
                -- the exception, so existing rows stay valid.

  -- outreach tracking (admin -> guest)
  last_contacted_at  timestamptz
  contact_attempts   int not null default 0

  -- their answer (no separate table; strictly 1:1 with the invite)
  attending     boolean                   -- null = hasn't answered yet
  responded_at  timestamptz               -- first submission
  updated_at    timestamptz               -- most recent change

  created_at    timestamptz not null default now()

attendees  (one row per PERSON — the only place people exist)
  id             uuid pk
  invite_id      uuid not null references invites(id) on delete cascade
  name           text not null
  is_child       boolean not null default false
  is_attending   boolean not null default false   -- the guest's per-person tick
  is_placeholder boolean not null default false   -- a guest-added "+1"; renameable by admin
  table_id       uuid references tables(id) on delete set null
  created_at     timestamptz not null default now()

tables  (seating)
  id          uuid pk
  name        text not null              -- "שולחן 1"
  capacity    int not null check (capacity > 0)
  sort_order  int not null default 0
  created_at  timestamptz not null default now()

response_history  (append-only; never updated, never deleted)
  id            uuid pk
  invite_id     uuid not null references invites(id) on delete cascade
  attending     boolean not null
  adult_count   int not null default 0
  kid_count     int not null default 0
  submitted_at  timestamptz not null default now()

wedding_config  (exactly one row, seeded by migration, editable from the admin panel)
  couple_names
  wedding_date_time            timestamptz
  venue_name
  rsvp_deadline                timestamptz null   -- null = no deadline, form always open
  contact_phone                text               -- shown when RSVP has closed
  -- Three purposes x two languages. Six columns rather than a templates
  -- table: wedding_config is a single row by design, the set is fixed at six,
  -- and a table would add a join to read what is effectively six settings.
  invite_message_template_he      ({{name}} / {{link}})
  invite_message_template_ru
  day_of_message_template_he
  day_of_message_template_ru
  thank_you_message_template_he
  thank_you_message_template_ru
```

**Indexes:** `invites.token`, `invites.status`, `attendees.invite_id`, `attendees.table_id`, `response_history.invite_id`, `response_history.submitted_at desc`.

**Seating lives on `attendees.table_id`, not a join table.** One person sits at one table — strictly 1:1, so it is a column. The same reasoning that ruled out a separate `responses` table, applied consistently.

### 5.1 Headcount is derived, never stored

```
adults = count(attendees where is_attending and not is_child)
kids   = count(attendees where is_attending and     is_child)
```

Every attending person — named by the admin or added by the guest as a +1 — is a row. There are no count columns to drift out of sync, and the guest never types a total. This is the single source of truth for every headcount: row totals, stats, exports, seating, the caterer number. The only place counts are *stored* is `response_history`, which snapshots these totals at each submission.

### 5.2 Status state machine

Strictly one-directional. Never reverts.

```
added → pending → opened → submitted → edited
```

| Status | Meaning | Advanced by |
|---|---|---|
| `added` | on the guest list, **no message sent yet** | admin taps `wa.me` |
| `pending` | invite sent, waiting for them to open it | guest opens their link (client-side — §6.15) |
| `opened` | link opened, not yet answered | guest submits the form |
| `submitted` | answered once | guest submits again |
| `edited` | changed at least once — **terminal** | — |

The `added → pending` transition is the same action that increments `contact_attempts` and sets `last_contacted_at`. The follow-up flag (§6.10) applies to invites in `pending` or `opened`.

### 5.3 Placeholder lifecycle

A guest adding a +1 creates a real `attendees` row with `is_placeholder = true`, named `אורח של {invite.name}` (numbered when there is more than one). The guest chooses adult or child; they never type a name.

- **On submit**, placeholder rows are reconciled to match the requested number — create or delete the difference. The guest is not editing rows directly, they are choosing a count.
- **On decline**, every placeholder is **deleted** and every named person set `is_attending = false`. A placeholder represents nobody, so it must not survive a decline.
- **The admin can rename a placeholder** if they later learn who it is, which clears `is_placeholder`. This is what makes seating complete.

## 6. Functional Requirements

### 6.1 Guest RSVP flow
Guest opens `/?token=…`. The page shows the invitation label and the people the admin listed, and lets the guest:
- answer attending yes/no for the invitation as a whole;
- **tick each named person individually** — declining Tolik while approving Nastya must be expressible, so the admin learns *who* dropped out rather than inferring it from a falling number;
- **add guests the admin doesn't know about** (adult or child), creating placeholder rows per §5.3;
- return via the same link and edit, with previous answers pre-filled, until the deadline.

Only the admin ever types a real name. **No cap on added guests** — an unexpected headcount surfaces in the total rather than being blocked at entry.

**Declining zeroes everything.** Answering "not coming" sets `is_attending = false` on every named person and deletes every placeholder. An invite showing "3 people" becomes **"0 people · declined"**. Switching back to yes starts from a blank form. No contradictory state can exist.

### 6.2 Guest confirmation screen
After submitting, the guest sees what was saved — who is coming and the total — plus the wedding date and venue from `wedding_config`. Without it a guest cannot tell the submission worked.

### 6.3 RSVP deadline — hard close
Past `rsvp_deadline` the guest sees their answer **read-only**, with a message to call `contact_phone` instead. A null deadline means always open. The admin is never restricted by it.

**Enforced server-side in `POST /api/rsvp`, not only by disabling the form.** A disabled form is bypassed with one `curl`, and the entire point is that numbers cannot move after the caterer has been committed to.

### 6.4 Public landing page
The site root with no token, or a token that doesn't resolve, shows a public page with couple names, date, and venue from `wedding_config`. It exposes no guest data and offers no way to RSVP.

### 6.5 Config-driven wedding details
Couple names, date/time, venue, deadline, contact phone, and all three templates live in `wedding_config`, editable from the admin panel. No hardcoded strings, no redeploy to change the date.

**Six separate, independently-editable** templates — invite, day-of and thank-you, each in Hebrew and Russian (§6.7b). Each keeps its own content, so switching never means re-typing.

### 6.6 Admin guest management
Add, edit, and delete an invite (name, phone, side, relation). Add, edit, rename, and remove people under an invite, including renaming a placeholder.

**Table shape:** one row per invite with its derived total ("3 people"). People appear as indented sub-rows behind an expand toggle, each showing approved/declined, with placeholders visibly marked and renameable. Invites with no people have no toggle.

**Search** by name or phone. **Sort** by name, status, headcount, or last-contacted. **Filter** by all five statuses.

**Duplicate phone warning** on add/edit when the number already exists — a warning, never a block.

**Delete is permanent and cascades**, destroying that invite's people and entire history. Requires a confirmation dialog; the database will not save you.

**Multi-select delete.** A checkbox per row plus "select all shown", which respects the current filter — so filtering to something and clearing it is one action rather than forty confirmations. The confirmation must state the real damage in people, not rows: *"40 invitations, 96 people and their answers. Permanent."* Bulk operations are exactly where a vague confirm gets clicked through.

### 6.7 Import and export

**Import adds; it never updates.** Every row becomes a new invitation. No matching against existing rows, no merge, no upsert. Editing happens in the UI afterwards; a bad import is cleared with multi-select delete and re-run. Decided knowingly (2026-08-02): matching logic would need a stable key the spreadsheet does not have, and would fail in ways that are hard to see.

**Columns are matched by header name, not position**, so column order and extra columns don't matter.

| Header | Maps to | Notes |
|---|---|---|
| `שם` | `invites.name` | required — the invitation label, feeds `{{name}}` |
| `אנשים` | `attendees` rows, `is_child = false` | comma-separated names |
| `ילדים` | `attendees` rows, `is_child = true` | comma-separated names |
| `טלפון` | `invites.phone` | international format, `+972…` |
| `צד` | `invites.side` | `חתן` · `כלה` · `משותף` |
| `קשר` | `invites.relation` | `משפחה` · `חברים` · `עבודה` · `הוזמן ע״י המשפחה` |
| `שפה` | `invites.language` | `he` · `ru`, blank defaults to `he` |

People are named, never counted — the spreadsheet carries names in `אנשים` and `ילדים` rather than a quantity, because a count cannot be ticked, cannot show *who* dropped out, and cannot be seated. Children get their own column rather than a marker inside the names, as the marker is easier to get wrong.

**Preview before writing.** The importer parses the file and reports what it found — rows ready, rows with warnings, rows rejected and why — and writes **nothing** until confirmed. This is the point of the feature, not a nicety: a mistyped phone silently breaks that guest's `wa.me` link, and `שפה = rus` would send a Russian family a Hebrew invitation. Both are cheap to fix in the sheet and expensive to find afterwards.

**Export** the guest list (for the caterer) and a seating/arrival list. Both via **`exceljs`**.

### 6.7b Bilingual guest side — Hebrew and Russian

**Hebrew is the default; Russian is the exception.** `invites.language` decides, per household, and defaults to `he` so nothing existing changes.

**The guest side only.** The admin panel stays Hebrew — Dmitri is its only user. Roughly 40 guest-facing strings need translating rather than the whole app, and `lib/strings.ts` keeps its admin section untouched.

What the language drives, for that household:

| | |
|---|---|
| **Text** | every guest-facing string — invitation, form, confirmation, closed-state |
| **Direction** | Hebrew is RTL, **Russian is LTR** — the page mirrors, it is not Russian text poured into a right-to-left layout |
| **Artwork** | a second Russian invitation image, chosen by language |
| **Preview card** | its own OpenGraph image, since the card carries the artwork |
| **WhatsApp message** | the `_ru` template instead of the `_he` one, picked automatically by the `wa.me` button |

**Direction cannot be set on `<html>` in the root layout.** The layout has no access to `searchParams`, so it cannot know the token, so it cannot know the language. The guest subtree carries its own `dir` on a wrapper element instead. The root stays `dir="rtl"` for the admin.

**A missing Russian template must not silently send Hebrew.** If `invite_message_template_ru` is empty and the household reads Russian, the settings tab flags it rather than the `wa.me` button quietly falling back — a Russian family receiving a Hebrew invitation is the exact failure this feature exists to prevent.

### 6.8 Copy invite link
A row action copying that guest's raw invite URL, for guests not reachable on WhatsApp.

### 6.9 Per-row `wa.me` send button
Opens `wa.me` with that guest's phone and the rendered message from the editable template **for that household's language** (§6.7b), `{{name}}`/`{{link}}` substituted. One tap opens WhatsApp ready to send; the admin still taps send inside WhatsApp.

Never bulk. Never automatic. Never scheduled.

Phone numbers are used **as-is** — no formatting or country-code logic. The phone input carries a hint showing the expected international format (e.g. `+972501234567`). Validation is explicitly not built.

### 6.10 Manual non-responder tracking
Sending a WhatsApp is the **only** thing that marks a guest contacted: it increments `contact_attempts`, sets `last_contacted_at`, and moves `added → pending`. No separate toggle.

**Confirmed, not assumed.** WhatsApp gives no callback, so the app cannot know whether send was actually pressed. Tapping the button opens the chat and asks **"נשלח?"** on the row; nothing is recorded until that is answered. Opening a chat and abandoning it records nothing.

This matters because an inflated `contact_attempts` corrupts the follow-up flag below — the list would claim people were contacted five times when they were never messaged at all — and would move an invite to `pending` while it is still unsent.

Invites reaching **5 attempts with still no response** get a "needs a phone call" badge. The app counts and flags; the couple decides whether to send again.

### 6.11 Stats — on the invitees screen, not a tab
Counts per status, total adults and kids attending, total declined, total invited — all from §5.1. Displayed as tiles at the **top of the invitees list**, not on a separate page: they are four numbers, and they read better beside the list than on their own screen.

### 6.12 Answers and history — a modal, not a tab
The invitee row already shows status, headcount, and each person's approved/declined. The only thing it does not show is the **change log**, so that opens as a small modal from the row: every previous submission, newest first, counts only.

Folding both into the invitees screen leaves three tabs — **מוזמנים · סידור שולחנות · הגדרות** — instead of five, with nothing lost.

### 6.13 Day-of reminder — prep only
Generate the reminder message and list confirmed guests, each with a `wa.me` button. No scheduling, no auto-send.

### 6.14 Thank-you — prep only
Same shape, for **everyone who said yes**. The app has no attendance data — it knows who confirmed, not who turned up — so "attended" is deliberately not the criterion.

### 6.15 WhatsApp preview image, and client-side `opened` marking

`wa.me` prefills **text only** — click-to-chat supports no media parameter. A real attachment would mean manual per-message work or the Business Cloud API (rejected: automated sending, violates §3.1). The supported path is the **link preview card** WhatsApp builds from OpenGraph tags.

- The invite page emits `og:image`, `og:title`, `og:description`.
- **The card is one static 1200×630 JPEG** at `public/assets/og-card.jpg`, built by `npm run og-card <source>` and committed: the floral artwork, with the couple's names, date and venue painted into its empty centre from `wedding_config`. It is identical for every guest — the personal greeting is in the message template WhatsApp prints beneath it.
- **The card does not follow the settings tab.** It is a file, not a page. Changing the date or venue in `/admin/settings` requires re-running `npm run og-card`, or the preview advertises the old details while every screen shows the new ones.
- Constraints: publicly reachable, absolute URL, JPG/PNG, ~1200×630, well under ~600 KB, fast — WhatsApp drops the preview after a few seconds.
- The artwork is portrait and the preview slot is landscape (~1.91:1). **Whatever is not composed is cropped by WhatsApp from the centre**, slicing the floral arch, so the card is built to the exact dimensions rather than handed over as-is.

**Superseded, 2026-07-31 (Dmitri):** this section previously required the image to be **generated per guest** via `next/og` `ImageResponse`, carrying that guest's name, with a static fallback. With no per-guest content on the card, per-request rendering buys nothing and spends time on the one path that cannot afford it — the crawler abandons the fetch after a few seconds. It also demanded an embedded Hebrew font, since the renderer cannot use `next/font`. One committed file replaces all of it.

**Companion requirement — `opened` is marked from client-side JavaScript, never during server rendering.**

Every invite triggers **two** non-human fetches: the meta tags and the generated image. Server-side marking would flip every invite to `opened` the moment it is *sent*, destroying the "who hasn't looked yet" filter that §6.10 depends on entirely. Crawlers fetch HTML but don't run JavaScript; real browsers do.

- Primary: a client-side call firing only in a real browser session.
- Backstop only: User-Agent checks for `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`.
- **Nothing on the crawler path may mutate status.** Satisfied structurally rather than by a guard: the card is a static file, so no code runs to serve it, and `generateMetadata` **takes no arguments** — it never receives the token, so it cannot look an invite up even by mistake.

### 6.16 Asset upload
An admin screen uploading images to a Supabase Storage bucket — the invitation picture and the OG card artwork — so they can be changed without touching code. Admin writes, public reads. Mock mode stores locally so the flow works without a real project.

### 6.17 Seating
- Manage tables: name, capacity, ordering.
- Assign any attending person — named or placeholder — to a table via `attendees.table_id`.
- Show per-table occupancy against capacity, and a list of unseated people.
- Export/print the seating list.

Only attending people are seatable. Declining a guest frees their seats.

### 6.18 Admin authentication
Supabase Auth, with the single admin account created by a one-off script (§9). The app ships a login form only — no signup route, no password reset, no user management. A signup endpoint would be a door that has to be locked; not building one removes the problem.

### 6.19 Empty, loading, and error states
Cross-cutting, not a feature. Every list and every form has all three. First run has zero guests and nothing should render blank.

### 6.20 Not building
- Dietary tracking — not relevant to this wedding.
- Attendance / day-of check-in — see §6.14.
- A "needs re-confirmation" flag for people added after a guest responded. Handled by creating a separate invite or phoning them.

## 7. Security Architecture

Non-negotiable.

1. **Token-as-credential.** The UUID in the invite URL *is* the guest's password. No guest accounts, no logins. Also what makes each link an individual landing page showing that guest's own household.
2. **RLS `deny all` on every table.** The publishable key ships to browsers by design; RLS makes it powerless. Every real operation goes through server code holding the secret key.
3. **Three clients, one strict rule each** — browser (anon) / server (anon + cookies, auth checks only) / admin (service role, API routes only). The service-role key is server-only and **never** prefixed `NEXT_PUBLIC_`; importing it into anything client-rendered ships it to browsers and opens the whole database.
4. **Defense in depth on `/admin`.** A proxy gates `/admin/*` before any admin page renders, **and** every admin API route independently re-verifies the session. Redundant on purpose: API routes are separate URLs reachable by `curl` without touching a page, and middleware bypass CVEs are real and recurring. Two locks turn a critical bug into a cosmetic one.
5. **`getUser()`, never `getSession()`** for anything deciding access. A cookie is controlled by whoever sends the request; `getSession()` isn't guaranteed to revalidate the token.
6. **Bot-aware status transitions** — §6.15.
7. **Deadline enforced server-side** — §6.3.

## 8. Test Data

**There is no mock store.** One was specified here originally, and dropped on 2026-07-30 once the real Supabase project was working: maintaining a second implementation meant hand-mirroring Postgres `ON DELETE CASCADE` and `ON DELETE SET NULL` in TypeScript, and anything hand-mirrored drifts from the thing it mirrors. Test data is a seed migration instead, so Postgres enforces the rules rather than code imitating them.

`supabase/migrations/004_seed_test_data.sql` seeds ~12 **invented** invites spanning all five statuses, both sides, several relations, and some at 5+ `contact_attempts`. Every row is marked `__test__` so `delete from invites where name like '%__test__%'` clears it before the real list goes in. Include at least one of each:

- several named people, all approved
- some approved and some declined
- named people **plus** placeholder +1s
- no named people, with a placeholder added
- no named people, nobody added
- declined entirely (`attending = false`)
- no answer yet (`attending = null`)
- two with multiple `response_history` rows, one going **declined → attending**
- several people pre-assigned to tables, and some left unseated

## 9. Stack

- **Next.js 16** (App Router, TypeScript) — middleware is `proxy.ts` exporting `proxy`; `searchParams` and `params` are Promises and must be awaited, including in `generateMetadata`.
- **Supabase** — Postgres, Auth, Storage. Three clients per §7.3.
- **Tailwind v4** — CSS-based config via `@theme`; no `tailwind.config.ts`.
- **shadcn/ui** — added on demand with `npx shadcn@latest add <name>`. **Not** a devDependency: it pulls ~201 packages including an HTTP server stack and the MCP SDK.
- **Sonner** for toasts.
- **`exceljs`** for spreadsheets — **never `xlsx`**. SheetJS stopped publishing to npm at 0.18.5, leaving unfixable prototype-pollution and ReDoS advisories.

**First admin account:** created by `scripts/create-admin.ts` using `supabase.auth.admin.createUser()` with the service-role key. Supabase Auth users cannot be created reliably by plain SQL — `auth.users` is managed, with password hashing and a linked `identities` row.

## 10. Resolved Decisions

- **Who types names:** the admin. Guests choose a *count* of extra guests, never a name.
- **Every attending person is a row.** Extras are placeholder `attendees`, not count columns — which is what makes seating possible and removes any chance of counts drifting.
- **Per-person approve/decline:** yes — a declined person is identifiable by name, which is what makes seating and name cards work.
- **No cap on added guests.**
- **Guest never types a total** — headcount is computed, making contradictory input structurally impossible rather than something to validate.
- **No separate `responses` table.** Strictly 1:1 with `invites` and always read alongside it. Cost accepted: `attending` is nullable, with `status` signalling whether an answer exists.
- **Seating is a column on `attendees`, not a join table** — same 1:1 reasoning.
- **History kept, counts only.** Its value is catching the money-relevant change, especially **declined → attending**, which is otherwise invisible: an "edited" badge says *something* changed, never that a no became a yes. The caterer is paid per plate against a fixed deadline.
- **`added` status** so "on the list" and "message sent" are distinguishable, making `pending` mean *invited and waiting*.
- **Declining zeroes everything** rather than hiding ticks and keeping them. A declined invite must read 0 with no stored state contradicting it, even at the cost of re-ticking if the guest changes their mind.
- **Deadline hard-closes**, enforced server-side.
- **Thank-you = everyone who said yes.** No attendance tracking.
- **Admin auth:** Supabase Auth, one account created by script. No signup route to defend.
- **`is_child` boundary:** adults 7+, children 2–7, under-2 not counted. A caterer convention.
- **Assets upload through the admin panel**, not committed to the repo.

### Added 2026-08-02

- **Hebrew is the default language, Russian is the exception.** Per-household, on `invites.language`, defaulting to `he` so no existing row changes.
- **Only the guest side is bilingual.** The admin stays Hebrew because one person uses it. Translating settings labels and toast messages nobody reads in Russian is work with no reader.
- **Russian mirrors the page to LTR** rather than pouring Russian into an RTL layout. Half-mirrored reads wrong to a native speaker, and the direction is per-household so it cannot live on `<html>`.
- **A second Russian artwork**, with its own preview card.
- **Six template columns, not a templates table.** `wedding_config` is a single row by design and the set is fixed at six; a table would add a join to read what are effectively six settings.
- **Import adds, never updates.** Matching would need a stable key the spreadsheet doesn't have. A bad import is cleared with multi-select delete and re-run.
- **People are imported by name, never as a count.** A count cannot be ticked, cannot show who dropped out, and cannot be seated. Children get their own column rather than a marker inside the names.
- **The importer previews before writing.** The failures it catches — a mistyped phone, `שפה = rus` — are silent and expensive later: a broken `wa.me` link is discovered from a guest who never replied.

### Declined, with consequences recorded

- **Import duplicate detection** — importing the same spreadsheet twice creates duplicate invites with different tokens, so one household can receive two links and RSVP twice. Mitigation is checking the list after importing.
- **Token rotation** — a link forwarded to the wrong person cannot be invalidated.
- **Audit log, response notifications, rate limiting, analytics** — rate limiting is unnecessary because UUIDv4 tokens make guessing impractical; the rest are not worth the weight for one wedding.

## 11. Explicitly Deferred

- Deliberate visual design, beyond legible and RTL-correct.
- Loading the real guest list.
- Multi-admin access.
- Any form of automated or scheduled sending — permanently, not just this phase.

## 12. Definition of Done

- Every requirement in §6 works against mock data.
- Every headcount comes from the single §5.1 count — no stored counts outside `response_history`.
- Guests can tick individuals and add +1s; +1s exist as real rows and are seatable.
- Declining deletes placeholders, unticks everyone, and reads 0.
- Status moves `added → pending` only on a `wa.me` tap, and never backwards.
- **Sending an invite does not move it to `opened`** — verified with a crawler User-Agent and with JavaScript disabled. The OG route never mutates status.
- **Past the deadline, `POST /api/rsvp` is rejected server-side**, not merely hidden in the UI.
- All security rules in §7 hold: RLS denies all, the service-role key appears in no client bundle, `/admin` is double-gated, no access decision uses `getSession()`.
- No automated or bulk sending exists anywhere in the code.
- Every list and form has empty, loading, and error states.
- Seating assigns named and placeholder people, tracks occupancy against capacity, and lists the unseated.
- The seed migration covers every case in §8.
- Swapping mock for real Supabase changes only the data layer's backing store.
