-- ---------------------------------------------------------------------------
-- 021 — each person has their own answer (docs/admin-answer-and-calls-PRD.md §6)
--
-- Until now a person's answer was derived: the household's answer, and for a
-- 'yes' household the person's tick. That cannot say "mom is coming, dad is a
-- maybe". After a phone call the admin records it per person.
--
-- `is_attending` stays and is kept equal to (answer = 'yes') by every write,
-- so headcount and budget are untouched. `invites.answer` stays too, now
-- recalculated from the people whenever one of them changes.
--
-- ⚠️ The backfill writes the NEW column on every existing person row of the
-- real database. It derives it entirely from data already there, using the
-- rule the app used until now, and only touches rows still null — so re-running
-- it changes nothing. Plain statements, no DO blocks (docs/progress.md §5).
-- ---------------------------------------------------------------------------

alter table attendees add column if not exists answer text;

alter table attendees drop constraint if exists attendees_answer_check;
alter table attendees
  add constraint attendees_answer_check check (answer in ('yes', 'no', 'undecided'));

update attendees a
set answer = case
  when i.answer = 'yes' then case when a.is_attending then 'yes' else 'no' end
  else i.answer
end
from invites i
where a.invite_id = i.id
  and a.answer is null
  and i.answer is not null;

-- Which person a history row was about. Null for a guest's whole-household
-- submission and for every row before this migration.
alter table response_history add column if not exists person_name text;

-- Verify (the editor's "Success" is not proof):
--   select table_name, column_name from information_schema.columns
--   where (table_name, column_name) in (('attendees','answer'), ('response_history','person_name'));
--
--   -- must be 0: a 'yes' that isn't attending, or attending without a 'yes'
--   select count(*) from attendees
--   where (answer = 'yes') is distinct from is_attending and answer is not null;
--
--   -- per-answer counts, to compare with the dashboard
--   select coalesce(answer, 'none') as answer, count(*) from attendees group by 1;
