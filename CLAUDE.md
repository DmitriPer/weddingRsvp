# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Before doing any non-trivial work, read `docs/claude-workflow.md`** — it defines the required process (PRD first, clarify by asking, Plan Mode before coding) and hard rules (no automated WhatsApp sending, function/data before styling, mock data until told otherwise) for this project. Also check `docs/` for the current phase's PRD.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3030)
npm run build    # Production build — run this to verify TypeScript + compilation
npm run lint     # ESLint
```

No test suite is configured yet.

## Stack

- **Next.js 16** (App Router, TypeScript) — note: this is Next.js **16**, not 15. `middleware.ts` is now `proxy.ts` and must export `proxy` (not `middleware`). `searchParams` and `params` are Promises — always `await` them.
- **Supabase** — Postgres + Auth. Three client types, each with a strict usage rule (see below).
- **Tailwind v4** — CSS-based config via `@theme` in `app/globals.css`. No `tailwind.config.ts`.
- **shadcn/ui** — components in `components/ui/`. Add new ones with `npx shadcn@latest add <name>`.
- **Sonner** — toast notifications (`import { toast } from 'sonner'`). Not the deprecated `toast` from shadcn.

## Architecture

### Supabase Client Rules

Three clients in `lib/supabase/` — using the wrong one causes auth or RLS bugs:

| File | Usage | Notes |
|------|-------|-------|
| `client.ts` | Browser / Client Components only | Anon key, reads cookies |
| `server.ts` | Server Components, API routes needing auth check | Anon key + cookie awareness |
| `admin.ts` | API routes for data mutations | Service role key, bypasses RLS |

All tables have RLS set to `deny all`. Every data operation goes through `admin.ts` (service role) in API routes. Auth verification uses `server.ts` — call `createServerSupabaseClient()` then `getUser()` (never `getSession()`).

### Request Flow

- **Guest RSVP** (`app/page.tsx`): Server Component reads `?token=` from `searchParams`, fetches invite via admin client, marks `pending → opened` server-side, passes data to `<RsvpForm>` (Client Component). No guest auth — token is the credential.
- **Admin area** (`app/admin/`): Protected by `proxy.ts` (Next.js 16 proxy, formerly middleware). Every API route also calls `verifyAdmin()` as defense-in-depth.
- **API routes** (`app/api/`): All use `createAdminClient()` for DB access. Auth-required routes also call `createServerSupabaseClient()` + `getUser()` to verify the admin session.

### Status State Machine

Invite statuses flow in one direction: `pending → opened → submitted → edited`

- `opened`: set server-side when guest loads their RSVP page
- `submitted`: first RSVP form submission
- `edited`: any subsequent submission — terminal state, never reverts to `submitted`

### Database

Three tables: `invites`, `responses` (one per invite, upserted), `response_history` (immutable append-only log). The `UNIQUE` constraint on `responses.invite_id` is what enables upsert with `onConflict: 'invite_id'`.

SQL migrations are in `supabase/migrations/` — run them manually in the Supabase SQL editor or via `supabase db push`.

### Fonts & Styling

Custom fonts defined in `lib/fonts.ts` (Heebo Bold/Black for display + Heebo Light/Regular for body + Varela Round for accents), applied as CSS variables `--font-display-var`, `--font-body-var`, and `--font-accent-var` via the root layout. Use `font-display`, `font-body`, and `font-accent` CSS classes (defined in `globals.css`) rather than Tailwind font utilities. Single font family (Heebo) provides clean hierarchy through weight variation.

CSS custom properties for the "Garden Letter" palette: `--color-cream`, `--color-parchment`, `--color-ink`, `--color-forest`, `--color-stone`, `--color-warm-border`. Animation utility classes (`animate-fade-up`, `animate-line-grow`, `delay-*`) are also defined in `globals.css`.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Public
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Public
SUPABASE_SERVICE_ROLE_KEY       # Server-only — never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL            # Used to build invite links (e.g. https://yoursite.com)
```

Copy `.env.example` → `.env.local` to get started.
