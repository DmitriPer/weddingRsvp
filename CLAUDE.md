# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

**Before doing any non-trivial work, read `docs/claude-workflow.md`** — it defines the required process (PRD first, clarify by asking, Plan Mode before coding) and the hard rules for this project.

**The spec is `docs/wedding-rsvp-PRD.md`.** It is the source of truth for scope, data model, and behaviour. Nothing gets built that isn't in it.

## Project state

This is a **greenfield rebuild**, started 2026-07-30 on the `greenfield` orphan branch. The app was previously an adaptation of `amirgal/wedding-rsvp`; that approach was abandoned (reasons in `docs/carry-over.md`). Right now the repo is a bare `create-next-app` scaffold plus the docs — **no feature code exists yet.**

`docs/architecture.md` and `docs/project-explainer.html` still describe the *old* app. Treat them as historical until regenerated.

## Commands

```bash
npm run dev      # dev server on http://localhost:3030
npm run build    # production build — the way to verify TypeScript + compilation
npm run lint     # ESLint
```

No test suite configured yet.

## Stack

- **Next.js 16.2.12** (App Router, TypeScript). Version specifics that bite:
  - middleware is **`proxy.ts`** and must export `proxy`, not `middleware`
  - **`searchParams` and `params` are Promises** — always `await` them, including inside `generateMetadata`
- **Tailwind v4** — CSS-based config via `@theme` in `app/globals.css`. There is no `tailwind.config.ts`.
- **Supabase** (not yet installed) — Postgres + Auth.
- **shadcn/ui** — add on demand with `npx shadcn@latest add <name>`. **Do not add `shadcn` as a devDependency**: it pulls ~201 packages including an HTTP server stack and the MCP SDK.
- **`exceljs`** for spreadsheet import — **never `xlsx`**. SheetJS stopped publishing to npm at 0.18.5, which carries permanently unfixable prototype-pollution and ReDoS advisories.

### Dependency notes

`npm audit` reports 12 high-severity issues on a **brand-new** Next.js scaffold. All of them are in the ESLint toolchain (`brace-expansion` → `minimatch` → the eslint plugins) or are `next` inheriting `postcss`/`sharp`. `next` itself has no direct advisories on 16.2.12, which is the latest stable release.

**Do not run `npm audit fix --force`** — it proposes downgrading `next` to 9.3.3. Plain `npm audit fix` changes nothing useful here and has previously introduced a `brace-expansion` *downgrade* that made things worse.

## Architecture (per the PRD — build to this)

### Supabase client rules

Three clients, each with a strict usage rule. Using the wrong one causes auth or RLS bugs:

| File | Key | Use in | Never |
|---|---|---|---|
| `lib/supabase/client.ts` | anon | Client Components | mutations |
| `lib/supabase/server.ts` | anon + cookies | Server Components, auth checks | bypassing RLS |
| `lib/supabase/admin.ts` | **service role** | API routes doing data work | anything client-rendered |

All tables get RLS `deny all`. Every data operation goes through the admin client in an API route. Auth verification uses the server client — call `getUser()`, **never `getSession()`** (it isn't guaranteed to revalidate the token, and a cookie is controlled by whoever sends the request).

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it `NEXT_PUBLIC_` — that prefix means "ship this to the browser", which would open the whole database.

### Defense in depth on `/admin`

Two independent locks, redundant on purpose:
1. `proxy.ts` gates `/admin/*` before any admin page renders.
2. Every admin API route independently re-verifies the session.

API routes are separate URLs reachable by `curl` without touching a page, and middleware-bypass CVEs are real and recurring. Two locks turn a critical bug into a cosmetic one.

### Status state machine

Strictly one-directional, never reverts:

```
added → pending → opened → submitted → edited
```

- `added` — on the list, **no message sent yet** (initial state)
- `pending` — invite sent; set by the admin tapping `wa.me`, which also increments `contact_attempts` and sets `last_contacted_at`
- `opened` — guest opened their link. **Set from client-side JavaScript only**, never during server rendering (see below)
- `submitted` → `edited` — first answer, then any subsequent one. `edited` is terminal.

### Bot-aware `opened` marking

WhatsApp and every other messenger fetches invite links to build preview cards, and the per-guest OG image means **two** non-human fetches per invite. Marking `opened` server-side would flip every invite the moment it's *sent*, destroying the "who hasn't looked yet" filter the whole follow-up workflow depends on.

- Primary: mark from client-side JS (crawlers don't execute JavaScript).
- Backstop only: User-Agent checks for `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`.
- **The OG image route must never mutate status.**

### Headcount is derived, never stored

```
adults = count(attendees where is_attending and not is_child) + invites.extra_adults
kids   = count(attendees where is_attending and     is_child) + invites.extra_kids
```

Guests tick named people and add unnamed extras — they never type a total, so the inputs cannot contradict each other. The only stored counts are the snapshots in `response_history`.

### Data model

Four tables: `invites`, `attendees`, `response_history`, `wedding_config`. There is deliberately **no `responses` table** — it would be strictly 1:1 with `invites`. Full schema and rationale in PRD §5 and §10.

## Hard rules

- **No automated, scheduled, or bulk WhatsApp/SMS sending — ever.** Every send is a human tap on a per-row `wa.me` button. This protects the couple's number from being flagged. Not a limitation to engineer around.
- **Function and data before styling.** Screens should be legible and RTL-correct; deliberate visual design is a later phase.
- **Mock data until explicitly told otherwise.** No real guest data anywhere until Dmitri points the app at his own Supabase project.
- **Keep the data layer swappable** — mock vs. real is a backing-store swap behind one set of functions, never mock logic scattered through components or routes.
- **Hebrew / RTL from day one**, not retrofitted.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL        # public
NEXT_PUBLIC_SUPABASE_ANON_KEY   # public
SUPABASE_SERVICE_ROLE_KEY       # server-only — never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL            # builds invite links and absolute OG image URLs
NEXT_PUBLIC_MOCK_MODE           # 'true' to use the in-memory data layer
```
