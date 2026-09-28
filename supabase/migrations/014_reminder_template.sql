-- ---------------------------------------------------------------------------
-- 014 — a "please answer" reminder template (docs/whatsapp-rounds-PRD.md)
--
-- The fourth message purpose, beside invite, day-of and thank-you: sent to
-- households that were invited and have not answered yet. One column per
-- language, like the other three pairs (migration 005).
--
-- Empty by default. The admin writes the wording in Settings; an empty
-- template greys out the reminder button rather than sending a blank message.
--
-- Additive only — no existing row data changes. Safe to run more than once.
-- ---------------------------------------------------------------------------

alter table wedding_config
  add column if not exists reminder_message_template_he text not null default '';

alter table wedding_config
  add column if not exists reminder_message_template_ru text not null default '';

comment on column wedding_config.reminder_message_template_he is
  'Reminder to households that have not answered yet, Hebrew. {{name}} and {{link}} are substituted.';
comment on column wedding_config.reminder_message_template_ru is
  'Reminder to households that have not answered yet, Russian. {{name}} and {{link}} are substituted.';
