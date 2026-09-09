# Setting Up the Database

How to create a free Supabase project and get this app talking to it.

**The app requires this.** There is no offline mode — every read and write goes to Postgres. If you are setting up a second environment or a fresh machine, this is the whole procedure.

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
3. The guest list is **empty** until you run the test seed below. That's correct.
4. Add one guest, copy their invite link, open it in a private window, submit an RSVP.
5. Supabase **Table Editor** → `invites` and `attendees` should show what you just did.

## Test data

**Only ever on a fresh, empty project.** Dmitri's live project holds the real guest list (~107 invitations since 2026-09-09) and this seed was never run against it. Running it there would insert invented households into a list being messaged by hand, so the `__test__` marker below is a cleanup aid for a scratch environment, not permission to seed the live one.

`supabase/migrations/004_seed_test_data.sql` inserts ~12 invented guests covering every state — approved, partly declined, unnamed "+1"s, declined, unanswered, 5+ contact attempts, multi-row history, some seated. Run it the same way as the others when building a second environment to look at.

Every row it creates is marked `__test__`. Clear them all before your real guest list goes in:

```sql
delete from invites where name like '%__test__%';
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| Everything returns empty, no errors | Using the publishable key where the secret key is needed. RLS denies everything by design. |
| `Missing required environment variable` | `.env.local` not created, or the dev server wasn't restarted. |
| Login always fails | The admin account wasn't created — step 4. There is no signup page. |
| Invite links point at `localhost` | `NEXT_PUBLIC_SITE_URL` still set to localhost. |
| Errors after a quiet week | The free project paused. Open the dashboard to wake it — and re-read the warning in step 1. |
