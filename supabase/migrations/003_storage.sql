-- Storage bucket for uploaded assets (PRD §6.16).
--
-- Holds the invitation picture and the OpenGraph card artwork. Public read is
-- required: WhatsApp fetches og:image from its own servers with no session, so
-- a private bucket would mean no preview card at all (PRD §6.15).
--
-- Writes are restricted to authenticated users — there is exactly one account,
-- created by scripts/create-admin.ts (PRD §6.18).

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Public read: needed by WhatsApp's crawler and by the guest's browser.
drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read"
  on storage.objects for select
  using (bucket_id = 'assets');

-- Authenticated write. The service role bypasses RLS entirely, so uploads
-- performed by an API route work regardless of these.
drop policy if exists "assets_authenticated_insert" on storage.objects;
create policy "assets_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'assets');

drop policy if exists "assets_authenticated_update" on storage.objects;
create policy "assets_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'assets');

drop policy if exists "assets_authenticated_delete" on storage.objects;
create policy "assets_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'assets');
