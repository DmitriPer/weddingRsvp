# Wedding Photos — QR Upload and Private Gallery

**Owner:** Dmitri
**Status:** draft 2026-09-29, parked. Not planned or built. Confirm the two open questions in §8, then Plan Mode.

## 1. Mission

Guests take photos at the wedding and the couple never sees most of them. A **QR code** on the tables opens an upload page on the guest's phone. The guest picks photos and they upload. **Afterwards the couple sees everything in a private gallery in admin and can download it all.**

## 2. Scope

| In scope | Out of scope |
|---|---|
| Printable QR code in admin | Videos (too large for the free plan) |
| Guest upload page: optional name, multi-select, progress | Guests viewing the gallery |
| Photos shrunk on the phone before upload | Original full-quality files |
| Admin gallery: grid, delete one, download all as ZIP | Moderation, likes, comments, albums |
| Upload open/close switch; regenerable QR key | Automatic open/close by date (see §8) |

## 3. Guest flow

1. The guest scans the QR code and opens `/photos?k=<key>`.
2. The page shows:
   - a Hebrew/Russian toggle (Hebrew by default);
   - an optional name field;
   - a "choose photos" button (multi-select, camera roll or camera);
   - a progress bar for each photo.
3. Each photo is resized **on the phone** to ~2500px on the long side, JPEG ~85% (~0.5–1 MB), before it is sent. That keeps it sharp enough to print up to ~A4, makes it fast on venue Wi-Fi, and fits ~1,000–2,000 photos in the free 1 GB.
4. The page ends with a thank-you, and an "upload more" button.

What the guest page does in each case:
- The key is wrong: an "invalid link" message.
- Uploads are closed: an "uploads are closed" message.
- Neither case reveals anything about the gallery.

**Accepted:** JPEG, PNG, WebP and HEIC. HEIC (iPhone) is converted to JPEG on the phone.

## 4. Admin

New **"תמונות"** tab:

- **The QR code** and a print button. The QR holds the full upload URL including the key.
- **Upload switch:** open or closed. Closed by default.
- **"New key":** regenerates `photo_upload_key`, which invalidates printed QR codes. It asks for confirmation first.
- **Gallery:**
  - a grid of photos, newest first, each with the name if one was given and the time;
  - delete one photo, with a confirmation;
  - a count and total size, against the 1 GB plan.
- **Download all as a ZIP.** The ZIP is built in the browser from the signed URLs, not on the server. A serverless function can't hold hundreds of MB.

## 5. Security and upload path

- **A secret key in the QR** (`wedding_config.photo_upload_key`, a random UUID). Without it nobody can upload. It can be regenerated.
- **`photo_upload_open`** must be true, or uploads are refused.
- **Uploads go directly from the phone to Storage.** Serverless request bodies are capped (~4.5 MB on Vercel), so photos can't pass through an API route. Instead:
  1. `POST /api/photos/upload-url` checks the key, the open switch, the file type and the declared size (≤ 5 MB);
  2. it records the row and returns a **one-time signed upload URL** for a unique path;
  3. the phone PUTs the file straight to Storage.
- **Private bucket `wedding-photos`**, separate from the public `assets` bucket. The admin gallery shows photos through short-lived **signed URLs**.
- **Limits:** a cap on photos per request, and on photos per key per minute (basic abuse guard).
- **The admin gallery routes** (`/api/photos`, `/api/photos/[id]`) call `verifyAdmin()` like every admin route. The upload page is public by design; its only gate is the key.

## 6. Data model

Migration `017_wedding_photos.sql`:

```sql
create table if not exists wedding_photos (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  uploader_name text not null default '',
  size_bytes    int  not null check (size_bytes > 0),
  created_at    timestamptz not null default now()
);
alter table wedding_photos enable row level security;  -- deny-all

alter table wedding_config add column if not exists photo_upload_key  uuid    not null default gen_random_uuid();
alter table wedding_config add column if not exists photo_upload_open boolean not null default false;
```

- Plus a private Storage bucket `wedding-photos`, with no public read.
- No guest table is touched.
- Dmitri runs the migration in the Supabase SQL editor.

## 7. Constraints

- **Needs the site on a public domain.** A QR code pointing at `localhost` is useless. It depends on the pre-launch deploy and `NEXT_PUBLIC_SITE_URL`.
- **Supabase free plan:** 1 GB storage and monthly egress limits. Downloading everything as a ZIP counts against egress, so download once. If it fills up, Supabase Pro ($25/mo, 100 GB) for a month or two covers it.
- The free-tier project pausing after inactivity (progress.md §6) must be solved before the wedding, or the upload page will be down.

## 8. Open questions (recommendations noted)

1. **Language on the guest page:** Hebrew with a רוסית/עברית toggle, *recommended*; or two QR codes, one per language.
2. **When uploads are open:** a manual switch in admin only, *recommended*; or automatic from the wedding day until N days after.

## 9. Definition of done

- Scanning the printed QR code on a phone uploads photos, and they appear in the admin gallery.
- A wrong key and a closed switch are both refused, **server-side**.
- The gallery and its API routes are unreachable without the admin login.
- Delete works, and the ZIP download contains every photo.
- `npm run build` and `npm run lint` pass.
- Tested end to end on a real phone against the deployed site.
