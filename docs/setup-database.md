# Setting Up the Database

How to create a free Supabase project and get this app talking to it.

**You don't need this yet.** With `NEXT_PUBLIC_MOCK_MODE=true` the app runs entirely on seeded in-memory data — no account, no database, no keys. Do this when you want real persistence.

**Do not put real guest data in until you've decided to.** Setting up the database and loading your actual guest list are two separate decisions (PRD §3.3).

---

## 1. Create the project

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign in with GitHub.
2. **New project**, and fill in:

| Field | What to put |
|---|---|
| **Name** | `wedding-rsvp` |
| **Database password** | Generate one and **save it in your password manager**. It is shown once. You won't need it for this app — the app uses API keys — but you'll want it for direct SQL access. |
| **Region** | **Central EU (Frankfurt)** — closest to Israel, so the lowest latency for your guests. |
| **Plan** | Free |

Provisioning takes a minute or two.

### ⚠️ Read this before the wedding

**Free-tier projects pause after about a week with no activity.** A paused project returns errors — meaning guests clicking their invite link would see a broken page.

That's fine during development. It is **not** fine in the weeks around your wedding, when a guest might open their link at any hour. Before you send real invitations, either upgrade to the paid tier for that period, or make certain the project is being hit often enough to stay awake. Check Supabase's current free-tier terms when you get there; this behaviour changes.

Other free-tier limits — 500 MB database, 1 GB file storage — are far beyond what 150 guests need.

## 2. Get your keys

**Project Settings** (gear icon) → **API Keys**.

Supabase replaced the old `anon` / `service_role` JWTs with **publishable** and **secret** keys. New projects get the new format. If you see a "Legacy anon, service_role API keys" tab, ignore it — use the new keys.

| In the dashboard | Looks like | Goes in | Safe in a browser? |
|---|---|---|---|
| **Project URL** (under *Data API*) | `https://xxxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` | yes |
| **Publishable key** | `sb_publishable_…` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes — RLS makes it powerless |
| **Secret key** | `sb_secret_…` | `SUPABASE_SECRET_KEY` | **NEVER** |

The secret key is masked in the dashboard — click to reveal or copy it.

**The secret key bypasses every security rule in the database.** It belongs only in `.env.local`, which is gitignored. Never prefix it `NEXT_PUBLIC_` — that prefix literally means "ship this to the browser." Never paste it into a chat, an issue, or a screenshot. If it leaks, rotate it on this same page; the old one dies immediately.

The publishable key is designed to be public and is safe to share — it can only do what RLS allows, which here is nothing.

## 3. Run the migrations

Left sidebar → **SQL Editor** → **New query**. Run these **in order**, one at a time, pasting the file's whole contents and clicking **Run**:

| # | File | Creates |
|---|---|---|
| 1 | `supabase/migrations/001_initial_schema.sql` | all 5 tables, indexes, RLS deny-all |
| 2 | `supabase/migrations/002_seed_config.sql` | the single `wedding_config` row |
| 3 | `supabase/migrations/003_storage.sql` | the `assets` storage bucket + policies |

All three are **safe to run more than once** — they use `if not exists` and `on conflict do nothing`, so a half-finished run can simply be re-run.

**Verify:** left sidebar → **Table Editor**. You should see `invites`, `attendees`, `tables`, `response_history`, `wedding_config`. Open `wedding_config` — it should have exactly one row.

If step 3 errors on permissions, the bucket can be made by hand instead: **Storage** → **New bucket** → name it `assets`, tick **Public bucket**.

## 4. Create your admin account

There's no signup page in the app — deliberately, since a signup route is a door that has to be locked (PRD §6.18). The single account is made by script.

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Then:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password-here' npm run create-admin
```

It prints the new user's id. Password must be at least 12 characters. **Don't put these two values in `.env.local`** — they're needed once, and passing them inline keeps them out of the file.

Verify: **Authentication** → **Users** in the Supabase dashboard.

## 5. Point the app at it

Full `.env.local`:

```bash
# Flip to false to use the real database
NEXT_PUBLIC_MOCK_MODE=false

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

NEXT_PUBLIC_SITE_URL=http://localhost:3030
```

`NEXT_PUBLIC_SITE_URL` builds invite links and the absolute OpenGraph image URLs. **No trailing slash.** When you deploy, this becomes your real domain — otherwise every invite link you send points at `localhost`.

Restart the dev server; `NEXT_PUBLIC_` variables are read at build time.

## 6. Check it works

```bash
npm run dev     # http://localhost:3030
```

1. `/admin` → redirected to the login page.
2. Log in with the account from step 4.
3. The guest list is **empty** — the real database has no seed data. That's correct.
4. Add one guest, copy their invite link, open it in a private window, submit an RSVP.
5. Supabase **Table Editor** → `invites` and `attendees` should show what you just did.

## Switching back to mock

Set `NEXT_PUBLIC_MOCK_MODE=true` and restart. You're back on seeded in-memory data, and the real database is untouched. Useful for development once real guest data exists — the whole reason the data layer is swappable (PRD §8).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Everything returns empty, no errors | Using the publishable key where the secret key is needed. RLS denies everything by design. |
| `Missing required environment variable` | `.env.local` not created, or the dev server wasn't restarted. |
| Login always fails | The admin account wasn't created — step 4. There is no signup page. |
| Invite links point at `localhost` | `NEXT_PUBLIC_SITE_URL` still set to localhost. |
| Errors after a quiet week | The free project paused. Open the dashboard to wake it — and re-read the warning in step 1. |
