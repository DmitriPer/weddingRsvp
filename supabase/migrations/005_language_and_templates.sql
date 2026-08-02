-- Bilingual guest side (PRD §6.7b).
--
-- Two changes:
--   1. invites.language — which language THAT household reads.
--   2. wedding_config — three templates become six, one pair per purpose.
--
-- Hebrew is the default and Russian the exception, so every existing row stays
-- valid without being touched.
--
-- ---------------------------------------------------------------------------
-- NOT RE-RUNNABLE, unlike 001–004. Run it once.
--
-- The three RENAMEs below have no `if exists` form, so a second run errors on
-- them. The first version of this file wrapped them in `do $$ … end $$;` blocks
-- to guard on information_schema — and that version did not execute in the
-- Supabase SQL editor at all, silently doing nothing while reporting no error.
-- A migration that runs beats a migration that is elegantly re-runnable, so the
-- guards are gone. This is the file as it was actually executed on 2026-08-02.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- invites.language
--
-- Drives the guest page's text, its direction (Hebrew RTL, Russian LTR), its
-- artwork, and which WhatsApp template the wa.me button renders.
--
-- `language` is a non-reserved Postgres keyword, so it is legal unquoted.
-- ---------------------------------------------------------------------------
alter table invites
  add column if not exists language text not null default 'he';

alter table invites
  add constraint invites_language_check check (language in ('he','ru'));

-- ---------------------------------------------------------------------------
-- wedding_config: three templates -> six
--
-- RENAME rather than add-new-and-drop-old: these hold real content written in
-- the settings tab, and add-and-drop would silently empty them with nothing in
-- a build to notice.
-- ---------------------------------------------------------------------------
alter table wedding_config rename column invite_message_template    to invite_message_template_he;
alter table wedding_config rename column day_of_message_template    to day_of_message_template_he;
alter table wedding_config rename column thank_you_message_template to thank_you_message_template_he;

-- The Russian half. Empty by default: a blank Russian template is surfaced as a
-- warning in the settings tab (PRD §6.7b) rather than silently falling back to
-- Hebrew, because a Russian family receiving a Hebrew invitation is the exact
-- failure this feature exists to prevent.
alter table wedding_config add column if not exists invite_message_template_ru    text not null default '';
alter table wedding_config add column if not exists day_of_message_template_ru    text not null default '';
alter table wedding_config add column if not exists thank_you_message_template_ru text not null default '';

-- The admin filters and counts by language, and the settings tab asks "does any
-- Russian household exist?" to decide whether to warn.
create index if not exists idx_invites_language on invites(language);
