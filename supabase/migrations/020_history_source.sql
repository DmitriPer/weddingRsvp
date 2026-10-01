-- ---------------------------------------------------------------------------
-- 020 — who recorded an answer (docs/admin-answer-and-calls-PRD.md §6)
--
-- The admin can now set a household's answer after a phone call. It is written
-- exactly like a guest's, so history needs to say which one it was.
--
-- Every existing row becomes 'guest', which is true: before this, only guests
-- could answer. Plain statements, no DO blocks (docs/progress.md §5). Re-runnable.
-- ---------------------------------------------------------------------------

alter table response_history
  add column if not exists source text not null default 'guest';

alter table response_history drop constraint if exists response_history_source_check;
alter table response_history
  add constraint response_history_source_check check (source in ('guest', 'admin'));

-- Verify (the editor's "Success" is not proof):
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_name = 'response_history' and column_name = 'source';
