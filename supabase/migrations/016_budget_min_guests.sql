-- ---------------------------------------------------------------------------
-- 016 — the committed minimum guest count (docs/budget-min-guests-PRD.md)
--
-- כמות התחייבות: the number of guests the couple pays for whatever the
-- turnout. A per-guest EXPENSE line is billed for max(approved, this) people
-- (lib/budget.ts). One value for the whole budget, so it sits on the single
-- wedding_config row rather than on each budget line.
--
-- 0 means no minimum. Default 120, the number agreed with the venue.
--
-- Additive only — one column on the one config row; no guest data is
-- touched. Safe to run more than once.
-- ---------------------------------------------------------------------------

alter table wedding_config
  add column if not exists budget_min_guests int not null default 120
  check (budget_min_guests >= 0);

comment on column wedding_config.budget_min_guests is
  'Committed minimum guests. Per-guest expense lines bill max(approved, this). 0 = no minimum.';

-- Verify against information_schema, never the editor's "Success" (see 005):
--
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_name = 'wedding_config' and column_name = 'budget_min_guests';
--
--   select budget_min_guests from wedding_config;  -- 120 after a first run
