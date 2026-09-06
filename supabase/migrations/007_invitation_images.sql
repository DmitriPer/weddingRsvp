-- Admin-uploadable invitation backdrop image, per language (PRD §6.16).
--
-- Was a hardcoded constant in components/guest/invitation-backdrop.tsx
-- (ARTWORK, pointing at the committed public/assets/demo-invitation.jpeg).
-- Changing it meant editing code and redeploying; every other wedding detail
-- already lives in wedding_config and takes effect on the next page load, so
-- this brings the invitation image in line with that.
--
-- `invitation_image_he` defaults to the CURRENT static path, so existing
-- guests see the identical image until an admin uploads a new one through
-- /admin/settings — nothing changes on deploy of this migration by itself.
--
-- `invitation_image_ru` blank falls back to the Hebrew image (lib/invitation-image.ts),
-- same reasoning as venue_name_ru (006_venue_ru.sql): a household seeing the
-- Hebrew artwork is a lesser gap than seeing no background at all.
--
-- Both hold a Supabase Storage public URL once uploaded (bucket 'assets',
-- 003_storage.sql), never the raw image.
--
-- Re-runnable.

alter table wedding_config
  add column if not exists invitation_image_he text not null default '/assets/demo-invitation.jpeg',
  add column if not exists invitation_image_ru text not null default '';
