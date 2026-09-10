-- Expenses and income: the wedding's budget (PRD §6.22).
--
-- One row per line item. `kind` says which direction the money moves;
-- `pricing` says how to read `amount`:
--
--   flat        amount IS the full price          (a DJ: ₪8,000)
--   per_person  amount is the price PER GUEST     (a caterer: ₪250/head)
--
-- ---------------------------------------------------------------------------
-- Money is stored in AGOROT as an integer, never numeric or float.
--
-- A budget is repeated addition plus one multiplication, and `0.1 + 0.2` is
-- not `0.3` in JavaScript. Integers make every sum exact; lib/money.ts is the
-- only place agorot are parsed or formatted, so they never reach a screen.
-- bigint, not int: int would cap a line item at ~₪21m, and there is no reason
-- for the schema to hold an opinion about that.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- What is NOT here: no full_price column, and no amount_to_pay column.
--
-- Both are DERIVED in lib/budget.ts, for the same reason headcounts are
-- derived (PRD §5.1). A per-guest line's full price depends on the guest list,
-- which changes every time an RSVP lands — a stored copy would be stale within
-- the hour and nothing would say so. The only stored numbers are the two a
-- human types: the price, and what has already been paid.
-- ---------------------------------------------------------------------------
--
-- Re-runnable.

create table if not exists budget_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null check (kind in ('expense', 'income')),
  pricing         text not null default 'flat' check (pricing in ('flat', 'per_person')),
  amount          bigint not null check (amount >= 0),
  paid_in_advance bigint not null default 0 check (paid_in_advance >= 0),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- The table's own reading order. Ties fall back to created_at in the query.
create index if not exists budget_items_sort_order_idx on budget_items (sort_order);

-- RLS deny-all, like every other table (PRD §7.2). No policies are created, so
-- the publishable key can read and write nothing; all access is the secret key
-- inside an API route. Enabling RLS without policies IS the deny — a table
-- with RLS off would be fully readable by anyone holding the public key.
alter table budget_items enable row level security;

-- Verify against information_schema, never the editor's "Success" (see 005):
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name = 'budget_items' order by ordinal_position;
--
--   select relrowsecurity from pg_class where relname = 'budget_items';  -- must be true
