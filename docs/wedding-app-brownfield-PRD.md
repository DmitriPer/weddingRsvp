# Wedding RSVP App — Brownfield Adjustment PRD

**Owner:** Dmitri
**Base:** `amirgal/wedding-rsvp` (adapted, friend's explicit OK obtained — no LICENSE file exists, permission is informal/verbal)
**Status:** Draft v1 — scopes the next build phase before implementation starts
**Relates to:** the original mission PRD and the base-repo investigation this adaptation decision was built on (see project history / ask Dmitri for the source docs if not present in this checkout)

---

## 1. Mission for This Phase

Turn the adapted repo into a working, guest-data-safe MVP that matches the original PRD's Section 4 scope — **function and data only**. Visual/styling work is explicitly deferred to a later phase.

## 2. Scope Boundaries (read this before touching anything)

| In scope this phase | Out of scope this phase |
|---|---|
| Data model changes (new fields/tables) | Any styling, layout, or visual redesign — the existing "Garden Letter" look stays as-is |
| API routes / server logic | Real Supabase project connection (mock data only — see Section 5) |
| Admin functionality (edit guest, manual reminder list) | Automated or bulk WhatsApp sending of any kind |
| Config-driven wedding details (replacing hardcoded values) | Multi-admin access, seating/floor-plan tool (still v2, per original PRD) |

**Hard rule carried over from the original PRD, reaffirmed this session:** no automated or scheduled WhatsApp sending — not even semi-automated retry cron jobs. Reason: risk of the couple's WhatsApp number being flagged/banned for spam-like bulk behavior, which would be catastrophic 2 months before the wedding. Every send action must be a human tap. The system's job is to **prepare** messages and **surface who needs one**, never to send on its own.

## 3. Why Mock Data First

The base repo's data flows already go through Supabase (RLS deny-all + service-role bypass, verified working). Rather than creating a real Supabase project and populating it with real guest data this early, this phase builds and tests everything against **mock/seed data in the same shape as the real schema**, so:
- No real guest data exists anywhere until Dmitri deliberately sets up and points the app at his own Supabase project.
- The swap from mock data to real Supabase is a config change, not a rewrite — the data-access layer should be written the same way whether it's reading mocked rows or real ones.

**Implementation note for later (not a decision to make now):** the cleanest way to keep this swap cheap is to keep all data access behind the existing `lib/supabase/admin.ts`-style functions and only change what backs them (a mock in-memory/JSON store vs. a real Supabase client) — not scattering mock logic through components or API routes.

## 4. Functional Gaps to Close

1. **Config-driven wedding details.** Couple names, date/time, venue, and the default WhatsApp message signature are currently hardcoded string literals in `wedding-landing.tsx` and `rsvp-form.tsx` (and the template in `invitees-tab.tsx`). Move these into a `wedding_config` DB table/row (editable from the admin panel, no redeploy needed — see Section 5).

2. **Edit existing guest.** Admin can currently add and delete guests, but not edit an existing guest's name/phone. Add this.

3. **Per-row `wa.me` send button.** Each guest row in the admin table gets a button that opens `wa.me` with that guest's phone number and the rendered message pre-filled — one tap opens WhatsApp ready to send, admin still taps send inside WhatsApp themselves (never bulk, never automatic). The message content comes from the **same shared, editable template** that already exists in the admin's message-template box (with `{{name}}`/`{{link}}` variables substituted per guest) — not a separate one-off message per guest. Confirm the template editor stays easy to find/use since it's now feeding both the copy-message action and this new send button.

4. **Manual non-responder tracking.** Add `last_contacted_at` and `contact_attempts` fields. **Clicking the per-row `wa.me` send button (item 3) is what marks a guest as contacted** — it increments `contact_attempts` and updates `last_contacted_at` (this is the only trigger; there's no separate manual "mark contacted" toggle needed since sending *is* the tracked action). Guests who hit **5 contact attempts with still no response** get a distinct visual flag/badge ("needs a phone call") on top of the existing status filters — replacing the original PRD's *automated* 5-attempt retry with a **human-driven** one: the app counts and flags, the couple decides if/when to actually send each time.

5. **Day-of-wedding reminder — prep only.** Add a way to generate the reminder message (venue/time, via the same template mechanism) and list confirmed guests, each with their own `wa.me` send button. No scheduling, no auto-send.

6. **Post-wedding thank-you — prep only.** Same shape as above: generate message + recipient list (attended guests), each with a `wa.me` send button, human sends manually.

7. **Two separate guest-tagging fields** (not present in the base repo):
   - **`side`**: single-select — `bride` / `groom` / `shared`.
   - **`relation`**: single-select — `family` / `friend` / `work` / `invited_by_family` (a guest is exactly one of these, not multiple).

8. ~~Dietary tracking~~ — **Decided: skip.** Not relevant to this wedding. The unmerged `feat/dietery-responses` branch has already been deleted from this repo entirely (both locally and on GitHub) as part of this phase's cleanup.

## 5. Data Model Changes Needed

Building on the existing verified schema (`invites`, `responses`, `response_history`):

```
invites
  + side (text, check: 'bride' | 'groom' | 'shared')
  + relation (text, check: 'family' | 'friend' | 'work' | 'invited_by_family')
  + last_contacted_at (timestamptz, nullable)
  + contact_attempts (int, default 0)
  (name, phone, token, status unchanged)

responses / response_history
  (unchanged — dietary tracking decided against, see Section 4.8)

wedding_config (new table — one row, editable from admin panel, no redeploy needed)
  - couple_names
  - wedding_date_time
  - venue_name
  - invite_message_template   ({{name}}/{{link}} vars)
  - day_of_message_template   ({{name}}/{{link}} vars)
  - thank_you_message_template ({{name}}/{{link}} vars)
```

Three separate, independently-editable templates (not one reused template) — each purpose (invite / day-of reminder / thank-you) keeps its own saved content so switching between them never means re-typing or losing what was there before.

Mock data for this phase should seed a realistic-but-fake set of ~10-15 guest rows spanning all status values (pending/opened/submitted/edited), both sides, a few different relations, some with 5+ contact_attempts (to exercise the follow-up flag), some with responses/history, so every screen and filter has something real to render against during development.

## 6. Explicitly Deferred to a Later Phase

- Any visual/styling changes (colors, layout, animations, fonts) — current design stays untouched.
- Real Supabase project setup and data migration.
- Seating/floor-plan tool (already v2 in the original PRD).
- Multi-admin access.
- Any form of automated/scheduled message sending.

## 7. Resolved Decisions (from clarification rounds)

- **Mock data:** an in-memory data-access layer with the *same function signatures* as the real Supabase calls (e.g. `getInvites()`, `createInvite()`), switched by a flag — never scattered mock logic through components/routes. This makes the later swap to a real Supabase project a backing-store change only.
- **Message templates:** three separate, independently-editable templates (invite / day-of / thank-you), not one reused template.
- **Phone numbers:** used as-is in the `wa.me` link, no auto-formatting/country-code logic. Add a visible note/placeholder hint in the admin's phone input field clarifying the expected format (international, with country code, e.g. `+972501234567`) so the admin enters it correctly themselves — validation logic is explicitly not being built for this.

## 8. Open Questions

(none remaining — all resolved above)

## 9. Definition of Done for This Phase

- All functional gaps in Section 4 implemented and working against mock data.
- `feat/dietery-responses` branch deleted (locally and from `DmitriPer/weddingRsvp` on GitHub) — done.
- No styling changes made.
- No real Supabase project touched.
- No automated/bulk WhatsApp sending exists anywhere in the code — every send is a human tap on a per-row `wa.me` button.
- Swapping mock data for a real Supabase project requires changing only the data-access layer's backing store (Section 7), not the API routes, components, or business logic.
