-- ---------------------------------------------------------------------------
-- 010 — a third answer: "עדיין לא יודעים" / "Ещё не знаем"
--
-- `invites.attending` is a boolean, so it holds two answers. The guest page now
-- offers three, and the third cannot be squeezed in: `null` already means "has
-- not answered yet". Encoding undecided as "null, but only when the status is
-- also submitted" would work and would be wrong — every read of `attending`
-- alone would silently report those households as silent.
--
-- So the answer becomes its own column, with the states named.
--
--   answer IS NULL   has not answered
--   'yes'            coming
--   'no'             not coming
--   'undecided'      answered, and does not know yet
--
-- NOT a new `status` value. Status is the workflow — sent, opened, answered —
-- and it is one-directional. Making "undecided" a status would forbid a
-- household that answered yes from later changing to undecided, because that is
-- backwards. The answer is not a stage; it is what the answer said.
--
-- ADDITIVE ON PURPOSE. `attending` is left in place and still correct for the
-- two answers it can express, so this migration is reversible by ignoring the
-- new column. A later migration drops it, once the app has been running on
-- `answer` long enough to trust it.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------
alter table invites
  add column if not exists answer text
  check (answer in ('yes', 'no', 'undecided'));

comment on column invites.answer is
  'null = has not answered. Supersedes `attending`, which cannot express undecided.';

-- Backfill from the column it replaces. `attending is not null` is exactly the
-- set that has answered — verified before running: 17 rows, all true, and no
-- row where `attending` and `status` disagreed.
update invites
   set answer = case when attending then 'yes' else 'no' end
 where attending is not null
   and answer is null;

-- ---------------------------------------------------------------------------
-- response_history — append-only snapshots of what was true at submission.
--
-- Its `attending` is `not null`, so an undecided answer could not be recorded
-- at all. Same column, same three states; `attending` becomes nullable so the
-- app can stop writing it without inventing a value it does not have.
-- ---------------------------------------------------------------------------
alter table response_history
  add column if not exists answer text
  check (answer in ('yes', 'no', 'undecided'));

update response_history
   set answer = case when attending then 'yes' else 'no' end
 where answer is null;

alter table response_history alter column answer set not null;
alter table response_history alter column attending drop not null;

commit;

-- ---------------------------------------------------------------------------
-- Verification — run this after, and read it before trusting the migration.
-- Every row must line up; `mismatched` must be 0.
-- ---------------------------------------------------------------------------
-- select
--   count(*)                                            as invites,
--   count(*) filter (where answer is null)              as unanswered,
--   count(*) filter (where answer = 'yes')              as coming,
--   count(*) filter (where answer = 'no')               as not_coming,
--   count(*) filter (where answer = 'undecided')        as undecided,
--   count(*) filter (
--     where (attending is null) <> (answer is null)
--        or (attending = true  and answer <> 'yes')
--        or (attending = false and answer <> 'no')
--   )                                                   as mismatched
-- from invites;
