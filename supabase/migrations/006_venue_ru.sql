-- A Russian venue name, for DISPLAY only (PRD §6.7b).
--
-- The WhatsApp preview line is date · venue. The date already follows the
-- household's language; the venue did not, so a Russian guest read
-- "8 октября 2026 г. · החצר של רוז, המלאכה 27, נתניה".
--
-- WHY A SECOND COLUMN RATHER THAN TRANSLATING THE EXISTING ONE:
-- `venue_name` is also what the Waze button searches. Waze finds the Hebrew
-- address; a Cyrillic transliteration it may not find at all. One field cannot
-- serve both jobs, so they are separated by job, not by language:
--
--   venue_name      navigation, always. Never translated.
--   venue_name_ru   display, for Russian households. Optional.
--
-- Blank means "no Russian version" and display falls back to `venue_name` —
-- correct here, unlike the message templates, where a blank must NOT fall back:
-- a Hebrew address is still usable to a Russian speaker, whereas a whole Hebrew
-- invitation is not.
--
-- Re-runnable.

alter table wedding_config
  add column if not exists venue_name_ru text not null default '';
