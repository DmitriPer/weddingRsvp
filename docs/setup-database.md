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

Left sidebar → **SQL Editor** → **New query**. Run these **in order**, one at a time, pasting the file's whole contents and clicking **Run**. All files are in `supabase/migrations/`:

| # | File | What it does |
|---|---|---|
| 1 | `001_initial_schema.sql` | the 5 core tables (`invites`, `attendees`, `tables`, `response_history`, `wedding_config`), indexes, RLS deny-all |
| 2 | `002_seed_config.sql` | the single `wedding_config` row, with placeholder values |
| 3 | `003_storage.sql` | the public `assets` storage bucket + authenticated-write policies |
| 4 | `004_seed_test_data.sql` | **Test data — skip it** unless this is an empty scratch project. See [Test data](#test-data). |
| 5 | `005_language_and_templates.sql` | `invites.language` (`he`/`ru`); the three message templates renamed to `_he` and given `_ru` twins. **Not re-runnable — run it once.** |
| 6 | `006_venue_ru.sql` | `wedding_config.venue_name_ru` — Russian venue name for display (Waze keeps using `venue_name`) |
| 7 | `007_invitation_images.sql` | `wedding_config.invitation_image_he` / `_ru` — admin-uploadable invitation backdrop per language |
| 8 | `008_first_invitation.sql` | `invites.first_invite_sent` / `first_invite_sender` — who sends the first invitation, and whether it went out |
| 9 | `009_budget_items.sql` | the `budget_items` table — expense/income lines, flat or per-guest, money in agorot; RLS deny-all |
| 10 | `010_answer_undecided.sql` | `invites.answer` and `response_history.answer` (`yes`/`no`/`undecided`), backfilled from `attending`; `response_history.attending` becomes nullable |
| 11 | `011_table_shape.sql` | `tables.shape` (`round`/`ellipse`/`rectangle`) |
| 12 | `012_table_position.sql` | `tables.pos_x` / `pos_y` — floor-plan position in percent (null = not placed) |
| 13 | `013_table_rotation.sql` | `tables.rotation` — degrees, 0–359 |
| 14 | `014_reminder_template.sql` | `wedding_config.reminder_message_template_he` / `_ru` — the "please answer" reminder |
| 15 | `015_bingo_squares.sql` | the `bingo_squares` table (Hebrew and Russian text paired per row), RLS deny-all, seeded with 28 squares only while the table is empty |
| 16 | `016_budget_min_guests.sql` | `wedding_config.budget_min_guests` (default 120) — the committed minimum that per-guest expenses are billed at |

**Re-running:** everything except `005` is written to be safe to run again (`if not exists`, `on conflict do nothing`, guarded updates), so a half-finished run can simply be re-run. **`005` is not** — its column renames have no `if exists` form and error on a second run.

**Don't trust the editor's "Success".** An earlier version of `005` reported success in the SQL editor while doing nothing. `008`, `009`, `010`, `015` and `016` end with commented-out verification queries (against `information_schema`, `pg_class`, or row counts) — run them after the migration and read the result. For `010`, `mismatched` must be 0.

**Verify:** left sidebar → **Table Editor**. You should see 7 tables: `invites`, `attendees`, `tables`, `response_history`, `wedding_config`, `budget_items`, `bingo_squares`. Open `wedding_config` — it should have exactly one row. `bingo_squares` should have 28.

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

**⚠️ Never run `004_seed_test_data.sql` on the live project. Only ever on a fresh, empty project.** Dmitri's live project holds the real guest list (~107 invitations since 2026-09-09) and this seed was never run against it. Running it there would insert invented households into a list being messaged by hand, so the `__test__` marker below is a cleanup aid for a scratch environment, not permission to seed the live one.

`supabase/migrations/004_seed_test_data.sql` inserts ~12 invented guests covering every state — approved, partly declined, unnamed "+1"s, declined, unanswered, 5+ contact attempts, multi-row history, some seated. It also overwrites the `wedding_config` row with test values. Run it the same way as the others, in its slot after `003`, only when building a second environment to look at.

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
