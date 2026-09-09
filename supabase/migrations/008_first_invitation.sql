-- First-invitation coordination: who sends it, and whether it went out (PRD §6.21).
--
-- A planning aid for the couple, deliberately SEPARATE from the send pipeline.
-- `status` and `contact_attempts` are owned by the wa.me button and mean "a
-- message was actually prepared and confirmed sent" (PRD §6.9, §6.10). These
-- two columns mean something else entirely: dividing ~150 households between
-- the two of you before the first round goes out, and ticking them off as it
-- does. Deriving the tick from `status != 'added'` was considered and rejected —
-- it would let a planning note silently move a household into the pipeline.
--
-- `first_invite_sender` is free text, not an enum or a foreign key. The options
-- the dropdown offers are split out of wedding_config.couple_names at render
-- time (lib/senders.ts), so renaming the couple in /admin/settings changes the
-- dropdown with no migration. The cost is that an old name already stored here
-- stays stored — which is the right trade for a field whose whole job lasts a
-- few days.
--
-- Both columns are additive with defaults, so every existing row stays valid
-- and the guest side never reads either of them.
--
-- Re-runnable.

alter table invites
  add column if not exists first_invite_sent   boolean not null default false,
  add column if not exists first_invite_sender text;

-- Verify against information_schema, never the editor's "Success" (see 005).
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name = 'invites'
--     and column_name in ('first_invite_sent', 'first_invite_sender');
--
-- Run on the live project 2026-09-09, confirmed present by selecting both
-- columns back through the REST API.
