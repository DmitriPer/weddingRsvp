-- ---------------------------------------------------------------------------
-- 017 — guest photo uploads into Google Drive (docs/wedding-photos-PRD.md)
--
-- A QR code on the tables opens /photos?k=<key>. Guests upload photos (already
-- shrunk on the phone) through our API into a private folder in Dmitri's
-- Google Drive. The photos themselves never touch this database or Supabase
-- Storage; this migration only holds the bookkeeping. No guest table is touched.
--
-- Three parts:
--   1. wedding_photos — one row per photo that reached Drive.
--   2. google_drive   — the single Drive connection (token, folder).
--   3. wedding_config — the QR key and the manual open/close switch.
--
-- Re-runnable.
-- ---------------------------------------------------------------------------

-- 1. -------------------------------------------------------------------------
-- For the admin's counter and the per-minute rate limit. The photo itself is
-- in Drive, found by drive_file_id.
create table if not exists wedding_photos (
  id            uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  uploader_name text not null default '',
  size_bytes    int  not null check (size_bytes > 0),
  created_at    timestamptz not null default now()
);

create index if not exists wedding_photos_created_at_idx on wedding_photos (created_at desc);

-- RLS deny-all, like every table (PRD §7.2).
alter table wedding_photos enable row level security;

-- 2. -------------------------------------------------------------------------
-- One row, like wedding_config: `id boolean primary key check (id)` means only
-- `true` is valid, so the database rejects a second connection.
--
-- refresh_token is a CREDENTIAL for Dmitri's Drive (scope drive.file: only
-- files this app created). RLS deny-all with no policies keeps it readable by
-- the secret key alone, inside an API route; it is never sent to a browser.
create table if not exists google_drive (
  id            boolean primary key default true check (id),
  refresh_token text not null,
  folder_id     text not null,
  account_email text not null default '',
  connected_at  timestamptz not null default now()
);

alter table google_drive enable row level security;

-- 3. -------------------------------------------------------------------------
-- The key is the only gate on the public upload page, so it is random and can
-- be regenerated from admin (which retires every printed QR code).
alter table wedding_config
  add column if not exists photo_upload_key uuid not null default gen_random_uuid();

-- Closed until Dmitri opens it on the night.
alter table wedding_config
  add column if not exists photo_upload_open boolean not null default false;

-- Verify against information_schema, never the editor's "Success" (see 005):
--
--   select relname, relrowsecurity from pg_class
--   where relname in ('wedding_photos', 'google_drive');          -- both true
--   select photo_upload_open, photo_upload_key from wedding_config; -- false, a uuid
