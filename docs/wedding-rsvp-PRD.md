# Wedding RSVP App — Product Requirements (Greenfield)

**Owner:** Dmitri
**Status:** v1 — greenfield spec. Supersedes `wedding-app-brownfield-PRD.md` (v3), which described adapting `amirgal/wedding-rsvp`.
**Date:** 2026-07-30
**Companion docs:** `claude-workflow.md` (process + hard rules), `carry-over.md` (what was worth learning from the base repo)

---

## 1. Mission

A wedding RSVP app for one wedding. Guests receive a personal link by WhatsApp and confirm who is coming. The couple manages the guest list, tracks who has responded, and sends every message by hand.

This phase delivers a **working, guest-data-safe MVP — function and data only.** Visual design is a later phase.

**Why greenfield:** the app was originally being adapted from a friend's repo (`amirgal/wedding-rsvp`, informal verbal permission, no LICENSE). Understanding someone else's structure before being able to change it cost more time than it saved. Rebuilding from this spec also makes ownership unambiguous. Patterns and ideas carry over (see `carry-over.md`); code does not.

## 2. Scope Boundaries

| In scope | Out of scope |
|---|---|
| Full data model and schema | Real Supabase project (mock data only — §8) |
| API routes / server logic | Visual design and styling polish |
| Guest RSVP flow end to end | Automated or bulk WhatsApp sending of any kind |
| Admin dashboard: list, add, edit, delete, import | Seating / floor-plan tool |
| Manual `wa.me` send + contact tracking | Multi-admin access |
| Config-driven wedding details | Guest-facing accounts or logins |

**On styling:** the brownfield PRD froze an existing design. There is no existing design now, so the rule translates to: **build the function and the data first; make it work before making it beautiful.** Screens should be plain, legible, and Hebrew/RTL-correct. Deliberate visual design is a separate later phase.

## 3. Hard Rules

Carried from `claude-workflow.md`. Not to be relitigated.

1. **No automated, scheduled, or bulk WhatsApp/SMS sending — ever.** Every outbound message is a manual human tap on a per-row `wa.me` button. Reason: risk of the couple's number being flagged or banned for spam-like behaviour. The app's job is to *prepare* messages and *flag who needs one*; a human always decides when to send.
2. **Function and data before styling.**
3. **Mock data until explicitly told otherwise.** No real guest data anywhere until Dmitri deliberately points the app at his own Supabase project.
4. **Data access stays swappable.** Mock vs. real is a backing-store swap behind one set of functions — never mock logic scattered through components or routes.
5. **Never touch the base repo author's live systems or real data.**

## 4. The Two Journeys

They never overlap. A guest never sees a login. An admin never sees the RSVP form.

**Guest — no login, ever.** Opens their personal link → sees their own household → ticks who is coming, optionally adds unnamed extras → submits → can return via the same link to edit.

**Admin — behind a login.** Signs in → sees every invite with status and headcount → adds/edits/deletes guests or imports a spreadsheet → taps `wa.me` per row to send → tracks who hasn't responded → reads answers and history → checks totals → edits wedding details and message templates.

## 5. Data Model

Four tables.

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

  -- outreach tracking (admin -> guest)
  last_contacted_at  timestamptz
  contact_attempts   int not null default 0

  -- their answer (no separate table; strictly 1:1 with the invite)
  attending     boolean                   -- null = hasn't answered yet
  responded_at  timestamptz               -- first submission
  updated_at    timestamptz               -- most recent change

  -- unnamed extras the guest added on top of the ticked names
  extra_adults  int not null default 0 check (extra_adults >= 0)
  extra_kids    int not null default 0 check (extra_kids  >= 0)

  created_at    timestamptz not null default now()

attendees  (one row per named person; ONLY the admin ever creates these)
  id            uuid pk
  invite_id     uuid not null references invites(id) on delete cascade
  name          text not null             -- always known: guests never type names
  is_child      boolean not null default false
  is_attending  boolean not null default false   -- the guest's per-person tick
  created_at    timestamptz not null default now()

response_history  (append-only; never updated, never deleted)
  id            uuid pk
  invite_id     uuid not null references invites(id) on delete cascade
  attending     boolean not null
  adult_count   int not null default 0
  kid_count     int not null default 0
  submitted_at  timestamptz not null default now()

wedding_config  (exactly one row, editable from the admin panel, no redeploy)
  couple_names
  wedding_date_time
  venue_name
  invite_message_template       ({{name}} / {{link}})
  day_of_message_template       ({{name}} / {{link}})
  thank_you_message_template    ({{name}} / {{link}})
```

**Indexes:** `token`, `status`, and every foreign key (`attendees.invite_id`, `response_history.invite_id`), plus `response_history.submitted_at desc`.

### 5.1 Headcount is always derived, never stored

```
adults = count(attendees where is_attending and not is_child) + invites.extra_adults
kids   = count(attendees where is_attending and     is_child) + invites.extra_kids
```

Single source of truth for every headcount in the app — row totals, stats, exports, the caterer number. The guest ticks names and adds extras but **never types a total**, so the two inputs cannot contradict each other. The only place counts are *stored* is `response_history`, which snapshots the totals computed by this formula at each submission.

### 5.2 Status state machine

Strictly one-directional. Never reverts.

```
added → pending → opened → submitted → edited
```

| Status | Meaning | Advanced by |
|---|---|---|
| `added` | on the guest list, **no message sent yet** | admin taps `wa.me` |
| `pending` | invite sent, waiting for them to open it | guest opens their link (client-side, §6.10) |
| `opened` | link opened, not yet answered | guest submits the form |
| `submitted` | answered once | guest submits again |
| `edited` | changed at least once — **terminal**, stays `edited` forever | — |

The `added → pending` transition is the same action that increments `contact_attempts` and sets `last_contacted_at`. The follow-up flag (§6.5) applies to invites sitting in `pending` or `opened`.

## 6. Functional Requirements

### 6.1 Guest RSVP flow
Guest opens `/?token=…`. The page resolves the invite, shows the invitation label and any named people the admin added, and lets the guest:
- answer attending yes/no for the invitation as a whole;
- **tick each named person individually** — so declining Tolik while approving Nastya is expressible, and the admin learns *who* dropped out rather than inferring it from a falling number;
- **add unnamed extras** (adults and/or kids), available on every invite including ones that already have named people, so a guest can swap a listed person for someone the admin doesn't know;
- return later via the same link and edit, with previous answers pre-filled.

Only the admin ever types a name. Guests never enter names.

**No cap on extras.** Trade-off accepted knowingly: an unexpected headcount surfaces via the derived total rather than being blocked at entry.

### 6.2 Config-driven wedding details
Couple names, date/time, venue, and all three message templates live in `wedding_config` and are editable from the admin panel. No hardcoded string literals, no redeploy to change the date.

Three **separate, independently-editable** templates (invite / day-of / thank-you) — each keeps its own saved content, so switching between them never means re-typing or losing what was there.

### 6.3 Admin guest management
Add, **edit**, and delete an invite (name, phone, side, relation). Add, edit, and remove named people under an invite. Bulk import from `.xlsx` — each row needs at least a name.

**Admin table shape:** one row per invite with its derived total ("3 people"). Named people appear as indented sub-rows behind an expand/collapse toggle, each showing approved/declined, plus a final `+N guest(s)` line for unnamed extras. Invites with no named people have no toggle. Keeps a 150-row list scannable with no new screens.

**Delete is permanent and cascades** — removing an invite destroys its attendees and its entire history with no undo. Requires a confirmation dialog; the database will not save you.

### 6.4 Per-row `wa.me` send button
Each invite row gets a button opening `wa.me` with that guest's phone and the rendered message pre-filled, from the **shared editable template** with `{{name}}`/`{{link}}` substituted. One tap opens WhatsApp ready to send; the admin still taps send inside WhatsApp.

Never bulk. Never automatic. Never scheduled.

Phone numbers are used **as-is** — no auto-formatting or country-code logic. The admin's phone input carries a visible hint showing the expected international format (e.g. `+972501234567`). Validation is explicitly not being built.

### 6.5 Manual non-responder tracking
Tapping the `wa.me` button is the **only** thing that marks a guest as contacted: it increments `contact_attempts`, sets `last_contacted_at`, and moves `added → pending`. No separate "mark contacted" toggle.

Invites reaching **5 contact attempts with still no response** get a distinct badge — "needs a phone call" — on top of the existing status filters. The app counts and flags; the couple decides if and when to send again.

### 6.6 Stats
Counts per status, total adults and kids attending, total declined, total invited — all from the §5.1 formula.

### 6.7 Answers and history
Open any invite to see its current answer plus every previous submission, newest first. History is counts-only (no per-person snapshot) — see §10.

### 6.8 Day-of-wedding reminder — prep only
Generate the reminder message (venue/time, via the template mechanism) and list confirmed guests, each with a `wa.me` button. No scheduling, no auto-send.

### 6.9 Post-wedding thank-you — prep only
Same shape, for guests who attended.

### 6.10 WhatsApp preview image, and client-side `opened` marking

`wa.me` prefills **text only** — click-to-chat supports no media parameter. A real attachment would mean manual per-message work or the Business Cloud API (rejected: automated sending, violates §3.1). The supported path is the **link preview card** WhatsApp renders from OpenGraph tags.

- The invite page emits `og:image`, `og:title`, `og:description`.
- The image is **generated per guest** (`next/og` `ImageResponse`) so the card carries that guest's name. No per-person design work.
- A **static fallback** covers generation failure and the no-token landing page.
- Constraints: publicly reachable, absolute URL, JPG/PNG, ~1200×630, well under ~600 KB, fast — WhatsApp drops the preview after a few seconds.

**Companion requirement — `opened` is marked from client-side JavaScript, never during server rendering.**

Every invite triggers **two** non-human fetches: the page's meta tags and the generated image. Server-side marking would flip every invite to `opened` the moment it's *sent*, destroying the "who hasn't looked yet" filter that §6.5 depends on entirely. Crawlers fetch HTML but don't execute JavaScript; real browsers do.

- Primary: a client-side call that fires only in a real browser session.
- Backstop: User-Agent checks for known crawlers (`WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`) — a heuristic, not a guarantee.
- **The OG image route must never mutate invite status.** It is crawler-facing by definition.

### 6.11 Not building
Dietary tracking — decided against, not relevant to this wedding.

## 7. Security Architecture

Non-negotiable, and the reason the base repo was worth studying at all.

1. **Token-as-credential.** The UUID in the invite URL *is* the guest's password. No guest accounts, no logins, no password resets. Also what makes each link an individual landing page showing that guest's own household.
2. **RLS `deny all` on every table.** The anon key ships to browsers by design; RLS makes it powerless. Every real operation goes through server code holding the service-role key.
3. **Three clients, one strict rule each** — browser (anon) / server (anon + cookies, auth checks only) / admin (service role, API routes only). The service-role key is server-only and **never** prefixed `NEXT_PUBLIC_`; importing it into anything client-rendered ships it to browsers and opens the whole database.
4. **Defense in depth on `/admin`.** A proxy gates `/admin/*` before any admin page renders, **and** every admin API route independently re-verifies the session. Redundant on purpose: API routes are separate URLs reachable by `curl` without ever touching a page, and middleware/proxy bypass CVEs are real and recurring. Two locks turn a critical bug into a cosmetic one.
5. **`getUser()`, never `getSession()`** for anything deciding access. A cookie is controlled by whoever sends the request; `getSession()` isn't guaranteed to revalidate the token, `getUser()` verifies it against the auth server.
6. **Bot-aware status transitions** — see §6.10.

## 8. Mock Data First

Build and test against an **in-memory data layer with the same function signatures as the real Supabase calls**, switched by a flag. Never mock logic scattered through components or routes. Swapping to a real Supabase project must be a backing-store change only — not a rewrite of routes, components, or business logic.

Seed ~10–15 invites spanning all five statuses, both sides, several relations, and some with 5+ `contact_attempts`. To exercise §6.1 specifically, include at least one of each:

- several named people, all approved
- some approved and some declined
- named people **plus** unnamed extras
- no named people, with an extra added
- no named people, no extras
- declined entirely (`attending = false`)
- no answer yet (`attending = null`)
- at least two with multiple `response_history` rows, including one that went **declined → attending** (the case that is otherwise invisible — see §10)

## 9. Stack

- **Next.js (App Router, TypeScript)** — note the version's specifics: middleware is `proxy.ts` exporting `proxy`; `searchParams` and `params` are Promises and must be awaited.
- **Supabase** — Postgres + Auth, three clients per §7.3.
- **Tailwind v4** — CSS-based config via `@theme`, no `tailwind.config.ts`.
- **shadcn/ui** — added on demand with `npx shadcn@latest add <name>`. **Not** a devDependency: it drags in ~201 packages including an HTTP server stack and the MCP SDK.
- **Sonner** for toasts.
- **`exceljs`** for spreadsheet import — **not `xlsx`**. SheetJS stopped publishing to npm at 0.18.5, which carries unfixable prototype-pollution and ReDoS advisories.

## 10. Resolved Decisions

- **Who types names:** the admin, only. Keeps `attendees.name` `NOT NULL` and needs no "added by" column.
- **Per-person approve/decline:** yes — a declined person is identifiable by name, which is what makes a later seating tool and name cards possible.
- **Unnamed extras:** allowed on every invite, stored as adult/kid counts. Split by age because the caterer prices them differently.
- **No cap on extras.**
- **Guest never types a total** — headcount is computed, making contradictory input structurally impossible rather than something to validate.
- **No separate `responses` table.** It would be strictly 1:1 with `invites` and always read alongside it; once counts are derived it would hold three columns. Not worth a table, an FK, a unique constraint, a cascade rule and an index. Cost accepted: `attending` is nullable, with `status` already signalling whether an answer exists.
- **History kept, counts only.** No per-person snapshot — the extra fidelity isn't worth the complexity for a one-off event. Its value is catching the money-relevant change, especially **declined → attending**, which is otherwise invisible: an "edited" badge says *something* changed, never that a no became a yes. That matters because the caterer is paid per plate against a fixed deadline.
- **New `added` status** so "on the list" and "message sent" are distinguishable, making `pending` mean *invited and waiting* — the thing worth filtering on.
- **Three separate message templates**, not one reused.
- **Seating deferred, but its data shape is being built now.** `attendees` is what a seating tool needs; building it now makes the later work UI-only, with no migration against a populated real guest list.

## 11. Explicitly Deferred

- Deliberate visual design (colors, layout, animation, typography) — beyond making screens legible and RTL-correct.
- Real Supabase project setup and data migration.
- Seating / floor-plan tool.
- Multi-admin access.
- Any form of automated or scheduled message sending — permanently, not just this phase.

## 12. Definition of Done

- Every requirement in §6 works against mock data.
- Per-person tracking works end to end: admin adds/edits named people, guest sees them with per-person ticks, can decline individuals, and can add unnamed extras.
- Every headcount in the app comes from the single §5.1 formula — no stored counts outside `response_history`.
- Status moves `added → pending` only on a `wa.me` tap, and never moves backwards.
- Sending an invite produces a WhatsApp preview card carrying the guest's name, with a static fallback on failure.
- **Sending an invite does not move it to `opened`** — verified by loading the page with a crawler User-Agent and with JavaScript disabled and confirming the status is unchanged. The OG image route never mutates status.
- All four security rules in §7 hold: RLS denies all, the service-role key appears in no client bundle, `/admin` is double-gated, and no access decision uses `getSession()`.
- No automated or bulk sending exists anywhere in the code.
- Mock seed data covers every case in §8.
- Swapping mock for real Supabase requires changing only the data layer's backing store.
