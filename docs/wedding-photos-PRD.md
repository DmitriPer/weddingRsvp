# Wedding Photos — QR Upload into Google Drive

**Owner:** Dmitri
**Status:** agreed 2026-09-29, built on `feat/wedding-photos`. Needs migration 017, the Google setup in §7, and a real-phone test before the wedding (2026-10-08).

## 1. Mission

Guests take photos at the wedding and the couple never sees most of them. A **QR code** on the tables opens an upload page on the guest's phone. The guest picks photos, and they land **in a private folder in Dmitri's Google Drive**. Only Dmitri can see it.

## 2. Scope

| In scope | Out of scope |
|---|---|
| Printable QR code in admin | Videos |
| Guest upload page: optional name, multi-select, progress, retry | Guests viewing any photos |
| Photos shrunk on the phone; EXIF and GPS removed | Original full-quality files |
| A one-time "חיבור ל-Google Drive" in admin | Google Photos |
| Upload open/close switch; a QR key that can be regenerated | Automatic open/close by date |
| An admin counter and an "open the folder in Drive" link | An in-app gallery or ZIP (Drive does both) |

## 3. Guest flow

1. The guest scans the QR code and opens `/photos?k=<key>`. The page is **Hebrew with a Русский toggle**.
2. They enter an optional name, then tap **"בחירת תמונות"** (multi-select, camera roll or camera). At most 50 photos per selection; they can pick again.
3. Each photo is resized **on the phone**: 3200px on the long side, JPEG 0.88, ~1.5–2 MB. Quality steps down automatically if a photo would pass 4 MB.
   - Drawing to a canvas **removes EXIF, including GPS location.**
   - iOS hands a web page JPEG, not HEIC.
4. Each photo is one POST to our server, which puts it into Drive. 3 upload at a time, each with a progress bar, a ✓, or "retry".
5. The page ends with a thank-you, and "להעלות עוד".

**What the guest sees in each case:**
- The key is wrong: "the link isn't valid".
- Uploads are closed: "uploads are closed".
- Both screens are bilingual, and **a wrong key never reveals whether uploads are open**.
- Drive isn't connected, or the connection dropped: "not ready yet — try in a few minutes".

## 4. Admin: the "תמונות" tab

- **Google Drive card:**
  - not connected → **"חיבור ל-Google Drive"**;
  - connected → the account email, **"פתיחת התיקייה ב-Drive"** and "ניתוק";
  - broken (token revoked or expired) → **"התחברות מחדש"**.
  - The connection is **checked live on every visit** by reading the folder, so a broken one shows here before a guest meets it.
- **QR code**, with a print button. The printout is a big QR plus "צלמו ושתפו אותנו · Поделитесь с нами фото".
- **Upload switch.** It is closed by default, and **it can't be opened while Drive isn't connected** (refused server-side too). Disconnecting closes it.
- **"מפתח חדש"** regenerates the key, which retires every printed QR code. It asks for confirmation first.
- **Counter:** how many photos have reached Drive, and their total MB.

## 5. How it works

- **OAuth as Dmitri, scope `drive.file`,** plus `openid email` to show which account is connected.
  - `drive.file` lets the app see **only files and folders it created**, never the rest of the Drive.
  - It is Google's *non-sensitive* Drive scope, so the app can be **published to production without verification**. In "testing" mode the connection would expire every 7 days.
- **Connect:** `/api/google/connect` → Google consent → `/api/google/callback`.
  - A random `state` in an httpOnly cookie must match, so nobody can trick the admin into connecting someone else's Drive.
  - A folder **"תמונות מהחתונה"** is created, or reused on reconnect.
  - The **refresh token** is stored in the one-row `google_drive` table: RLS deny-all, secret key only, never sent to a browser.
- **Upload:** `POST /api/photos/upload` (public, multipart `k` + `name` + `file`) does this in order:
  1. checks the key (400) and the switch (410);
  2. checks the file is JPEG, ≤ 4 MB (400);
  3. applies the global rate limit (429);
  4. checks Drive is connected (503);
  5. uploads a Drive multipart to the folder, then records a `wedding_photos` row.
- **Why the photo goes through our server** instead of straight from the phone to Drive: the Google token must stay on the server, and a resized photo fits a serverless body (~4.5 MB) easily.
- **File names (revised 2026-09-30):** `דנה · 17.jpg`, or `17.jpg` when the guest left no name. There is no date: Drive shows when each file was created, and the number keeps upload order. The uploader's name is also in the Drive file description.
  - The number is the row's **running number** (`wedding_photos.photo_number`, migration 019).
  - The route **reserves the row first** so the number exists for the name, uploads, then attaches `drive_file_id`. A failed upload releases the reservation.
  - The counter and the MB total count only rows that reached Drive.
- **The rate limit is global,** 600 photos a minute. Every guest shares one key, so a per-key limit would throttle the whole room; this one only stops a script.

## 6. Data model

Migration `017_wedding_photos.sql`:
- `wedding_photos`: `id`, `drive_file_id` (unique), `uploader_name`, `size_bytes`, `created_at`. It is for the counter and the rate limit; the photo itself is in Drive.
- `google_drive`: a single row (`id boolean pk check (id)`) with `refresh_token`, `folder_id`, `account_email` and `connected_at`.
- `wedding_config` gets `photo_upload_key` (a random uuid) and `photo_upload_open` (default false).
- RLS is on for both new tables, with no policies. No guest table is touched. **Dmitri runs it** in the Supabase SQL editor.

## 7. Google Cloud: one-time setup (Dmitri)

At **console.cloud.google.com**, signed in with the Google account whose Drive should get the photos:

1. **Create a project**, e.g. "wedding-photos".
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **Google Auth Platform:**
   - **Branding:** an app name and your email.
   - **Audience:** External, then **Publish app**, so the status reads "In production".
   - **Data access:** add the scopes `.../auth/drive.file`, `openid` and `email`.
4. **Clients → Create client → Web application.** Under **Authorized redirect URIs**, add both:
   - `https://<live domain>/api/google/callback`
   - `http://localhost:3030/api/google/callback`
5. Put the Client ID and secret in `.env.local` **and** in Vercel's environment variables, then redeploy. **Never with a `NEXT_PUBLIC_` prefix.**
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
6. In admin → "תמונות", click **"חיבור ל-Google Drive"** and approve. The folder "תמונות מהחתונה" appears in Drive.

## 8. Decisions (2026-09-29)

1. **Language:** Hebrew with a Русский toggle. One QR code for everyone.
2. **Open/close:** a manual switch in admin only.
3. **Destination: Google Drive only.** Dmitri chose this over a private Supabase bucket, and over a bucket plus copying to Drive.
   - An earlier version of this spec used a private Supabase bucket, with a gallery, thumbnails and a ZIP download. It was built, then replaced before it was committed or migrated.
   - **The trade-off Dmitri accepted:** if the Google connection breaks on the night, uploads fail with "not ready" until he reconnects. The admin tab's live check is the early warning.
4. **Google Photos was declined.** Its API needs sensitive scopes, and after March 2025 its access model is narrower.
5. **The guest page is a plain page,** not the invitation backdrop: an upload form over the artwork's text would be hard to read.

## 9. Constraints

- **Space:** the Google account's quota, 15 GB free, shared with Gmail. At ~2 MB a photo, that's roughly 5,000+ photos.
- **Supabase free-tier pausing** (progress.md §6) must not happen around the wedding, because the upload route reads config from the database.
- The password on the Google account can change freely: the connection survives it, since the scope isn't Gmail. Removing the app at myaccount.google.com/permissions breaks it, and admin then shows "reconnect".

## 10. Definition of done

- Connecting Drive creates the folder, and admin shows the email.
- Scanning the printed QR on an **iPhone and an Android**, against the live site, puts photos into the folder with the name.
- A downloaded photo has **no GPS**.
- A wrong key and a closed switch are refused **server-side**. Opening with no Drive is refused.
- Every admin route rejects a logged-out request with 401.
- `npm run build` and `npm run lint` pass.
