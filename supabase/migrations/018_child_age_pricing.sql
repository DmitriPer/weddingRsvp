-- ---------------------------------------------------------------------------
-- 018 — age groups for children, and a child price (docs/child-age-pricing-PRD.md)
--
--   adult   7+     adult price, counts toward the committed minimum
--   child   3–7    the line's child price
--   infant  0–3    free, but takes a chair
--
-- Additive only. No existing row changes meaning:
--   * is_infant defaults to false, so every current child stays "child 3–7"
--     until the admin marks an infant;
--   * child_amount defaults to null, meaning "a child pays the adult price" —
--     exactly how every per-guest line was priced before.
--
-- Re-runnable.
-- ---------------------------------------------------------------------------

-- An infant IS a child (is_child stays true), so import, export, the guest form
-- and seating keep working untouched; is_infant only narrows it.
alter table attendees
  add column if not exists is_infant boolean not null default false;

-- An infant that isn't a child would be a contradiction; refuse it outright.
alter table attendees drop constraint if exists attendees_infant_is_child;
alter table attendees
  add constraint attendees_infant_is_child check (not is_infant or is_child);

-- AGOROT, like amount (009). Only meaningful on per_person lines.
alter table budget_items
  add column if not exists child_amount bigint check (child_amount is null or child_amount >= 0);

-- Verify:
--   select count(*) filter (where is_infant) as infants,
--          count(*) filter (where is_child)  as children
--   from attendees;                                   -- infants 0 after a first run
--   select column_name from information_schema.columns
--   where table_name = 'budget_items' and column_name = 'child_amount';
