# Wedding RSVP App — Brownfield Adjustment PRD

**Owner:** Dmitri
**Base:** `amirgal/wedding-rsvp` (adapted, friend's explicit OK obtained — no LICENSE file exists, permission is informal/verbal)
**Status:** Draft v3 — scopes the next build phase before implementation starts.
- v2 revised the data model after a clarification round on per-person guest tracking (see §4.9, §5, §7).
- v3 (2026-07-30) adds the `added` status (§5), adds per-guest WhatsApp preview images with client-side `opened` marking (§4.10), and records the decision to **rebuild from scratch** rather than continue adapting the base repo — see `docs/carry-over.md`. The functional scope and data model in this document are unchanged by that decision and become the greenfield spec.
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

9. **Named attendees per invite, with per-person approval and unnamed extras.** *(New in v2 — replaces the base repo's count-only model.)*

   Today an invite stores only `adult_count` / `kid_count`, so the app knows *how many* are coming but never *who*. Since a seating/floor-plan tool is likely in a later phase, the per-person shape is being decided now — retrofitting it after the real guest list is loaded is far more expensive than doing it while mock data is the only data.

   **Only the admin ever types a name.** Guests never enter names. The admin builds the invite and optionally adds named people under it; the guest responds to whatever the admin built.

   - **Invite with named sub-people.** Admin adds `Slava`, then adds `Nastya` and `Tolik` under him. Slava's RSVP page lists all three with a checkbox each.
   - **Invite with no sub-people.** Admin adds `Dany` alone. Dany's RSVP page lists only himself.
   - **Per-person approve/decline.** The guest ticks each named person individually. Slava can approve himself and Nastya while declining Tolik — so the admin sees exactly *who* dropped out, not just that the number fell.
   - **Unnamed extras.** On top of the ticks, any guest (including one with named sub-people) can add extra people whose names nobody typed. Slava swapping Tolik for an unnamed guest = untick Tolik, add 1 extra → total 3. Dany bringing someone = add 1 extra → total 2.
   - **No headcount limit.** Guests may add as many extras as they want; there is no per-invite or global cap. *(Decided — see §7.)*
   - **The guest never types a total.** The headcount is always calculated as `ticked people + unnamed extras`, so the two can never contradict each other.

   **Resulting admin view (functional requirement, not a styling change):** the invitees table keeps **one row per invite** with the computed total shown on it (e.g. "3 people"). Named sub-people appear as indented sub-rows behind an expand/collapse toggle, each showing `approved` / `declined`, plus a final `+N guest(s)` line for unnamed extras. Invites with no named sub-people have no toggle. This keeps a 100+ row list scannable and requires no new screens. Adding/editing the names happens inside the edit-guest flow from item 2.

   **Note on scope:** this adds controls to the guest RSVP form (per-person checkboxes, an "add guest" action). That is functional work, not visual redesign — the existing "Garden Letter" look still applies unchanged, per §2.

10. **Per-guest WhatsApp link preview image (OpenGraph), and client-side `opened` marking.** *(New in v3.)*

    **Why:** `wa.me` links can only prefill **text** — WhatsApp's click-to-chat supports no image/media parameter, so a real attachment is impossible without manual per-message work or the Business Cloud API (rejected: automated sending, violates the standing hard rule). The supported path is the **link preview card** WhatsApp renders from OpenGraph meta tags on the invite page. It appears inside the message bubble and looks like an attachment, but requires no action per guest.

    **Current state:** `app/layout.tsx` sets only `title` and `description` — there is no `openGraph` block anywhere, so an invite currently renders as a bare text card with no image.

    **Requirements:**
    - The guest invite page emits `og:image`, `og:title`, `og:description`.
    - The image is **generated per guest** (via `next/og` `ImageResponse`) so the card carries that guest's name — e.g. "סלבה, הוזמנתם". No per-person design work.
    - A **static fallback image** covers generation failure and the no-token landing page.
    - Next 16 gotcha: `searchParams` is a Promise, so `generateMetadata` must `await` it before reading the token.
    - Image constraints: publicly reachable (no auth), absolute URL, JPG/PNG, ~1200×630, well under ~600 KB, and fast to respond — WhatsApp allows only a few seconds before silently dropping the preview.

    **Companion requirement — `opened` must be marked from client-side JavaScript, not during server rendering.**

    Each invite now causes **two** non-human fetches: one for the page's meta tags, one for the generated image. Server-side marking would flip every invite to `opened` the moment it is sent, destroying the "who hasn't looked yet" filter that the entire follow-up workflow in §4.4 depends on. Preview crawlers fetch HTML but do not execute JavaScript; real guests' browsers do. Therefore:
    - Primary mechanism: a client-side call that fires only in a real browser session.
    - Backstop: User-Agent checks for known crawlers (`WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`) — a heuristic, not a guarantee.
    - **The OG image route must never mutate invite status.** It is crawler-facing by definition.
    - Caching note: previews are cached per URL, and every guest has a unique token URL, so each invite triggers its own fetches. Personalization is the reason for the extra crawler traffic, and the reason this companion requirement is mandatory rather than optional.

## 5. Data Model Changes Needed

**Four tables after this phase.** The base repo has three (`invites`, `responses`, `response_history`); this phase adds `attendees` and `wedding_config` while **dropping `responses`** — a net of four rather than five. Rationale for the drop is in §7.

```
invites  (one row per invitation)
  id, token, name, phone, created_at   (unchanged)
  status  text, check ('added' | 'pending' | 'opened' | 'submitted' | 'edited')
          -- v3: 'added' is NEW and is now the initial state.
          -- 'added'   = on the guest list, no message sent yet
          -- 'pending' = invite sent, waiting for them to open it
          -- Moving 'added' -> 'pending' is the same action that increments
          --   contact_attempts and sets last_contacted_at (the manual wa.me tap).
          -- Still strictly one-directional; 'edited' remains terminal.

  + side               text, check ('bride' | 'groom' | 'shared')
  + relation           text, check ('family' | 'friend' | 'work' | 'invited_by_family')
  + last_contacted_at  timestamptz, nullable
  + contact_attempts   int, default 0

  -- merged in from the dropped `responses` table:
  + attending          boolean, nullable   -- null = hasn't answered yet
  + responded_at       timestamptz, nullable  -- first submission
  + updated_at         timestamptz, nullable  -- most recent change

  -- unnamed extras the guest added on top of the ticked names (§4.9):
  + extra_adults       int, default 0, check >= 0
  + extra_kids         int, default 0, check >= 0

  NOTE: adult_count / kid_count are NOT stored here. They are derived (see below).

attendees  (NEW — one row per named person; only the admin ever creates these)
  id
  invite_id     fk -> invites(id) on delete cascade
  name          text not null        -- always known: guests never type names
  is_child      boolean, default false
  is_attending  boolean, default false  -- the guest's per-person approve/decline tick
  created_at

response_history  (unchanged — append-only change log, counts only)
  id, invite_id, attending, adult_count, kid_count, submitted_at

wedding_config  (NEW — one row, editable from admin panel, no redeploy needed)
  - couple_names
  - wedding_date_time
  - venue_name
  - invite_message_template    ({{name}}/{{link}} vars)
  - day_of_message_template    ({{name}}/{{link}} vars)
  - thank_you_message_template ({{name}}/{{link}} vars)
```

### Headcount is always derived, never stored

```
adults = count(attendees where is_attending and not is_child) + invites.extra_adults
kids   = count(attendees where is_attending and     is_child) + invites.extra_kids
```

This is the single source of truth for every headcount in the app — the invitees table row total, the stats tab, and the caterer number. Because the guest ticks names and adds extras but never types a total, the two inputs cannot contradict each other. The only place counts are *stored* is `response_history`, where each submission snapshots the totals computed by the formula above at that moment.

### Templates

Three separate, independently-editable templates (not one reused template) — each purpose (invite / day-of reminder / thank-you) keeps its own saved content so switching between them never means re-typing or losing what was there before.

### Mock seed data

Seed a realistic-but-fake set of ~10-15 **invites** spanning all status values (pending/opened/submitted/edited), both sides, a few different relations, and some with 5+ `contact_attempts` (to exercise the follow-up flag). To exercise the §4.9 model specifically, the seed must include at least one of each of:

- an invite with **several named sub-people, all approved** (the Slava/Nastya/Tolik shape, all coming)
- an invite with **some approved and some declined** sub-people
- an invite with named sub-people **plus unnamed extras** (the Tolik-swapped-for-a-stranger case)
- an invite with **no named sub-people** that added an extra (the Dany case)
- an invite with **no named sub-people and no extras**
- an invite that **declined entirely** (`attending = false`)
- an invite with **no answer yet** (`attending = null`)
- at least two invites with **multiple `response_history` rows**, including one that went `declined → attending` so the history display has a meaningful trajectory to show

Current state to fix: `lib/mock/seed-data.ts` holds a single pending invite with no responses and no history, so most screens and every filter currently render empty.

## 6. Explicitly Deferred to a Later Phase

- Any visual/styling changes (colors, layout, animations, fonts) — current design stays untouched.
- Real Supabase project setup and data migration.
- Seating/floor-plan tool (already v2 in the original PRD). **Still deferred — but its data shape is being prepared now.** The `attendees` table from §4.9 is what a seating tool would need, so building it this phase means the later seating work is UI-only, with no migration against a populated real guest list.
- Multi-admin access.
- Any form of automated/scheduled message sending.

## 7. Resolved Decisions (from clarification rounds)

- **Mock data:** an in-memory data-access layer with the *same function signatures* as the real Supabase calls (e.g. `getInvites()`, `createInvite()`), switched by a flag — never scattered mock logic through components/routes. This makes the later swap to a real Supabase project a backing-store change only.
- **Message templates:** three separate, independently-editable templates (invite / day-of / thank-you), not one reused template.
- **Phone numbers:** used as-is in the `wa.me` link, no auto-formatting/country-code logic. Add a visible note/placeholder hint in the admin's phone input field clarifying the expected format (international, with country code, e.g. `+972501234567`) so the admin enters it correctly themselves — validation logic is explicitly not being built for this.

### Added in v2 — per-person attendee tracking

- **Who types names:** the admin, only. Guests never enter a name. This keeps `attendees.name` `NOT NULL` and means no "who added this person" column is needed.
- **Per-person approve/decline:** yes — the guest ticks each named person individually, so a declined person is identifiable by name rather than inferred from a falling number. This is what makes a later seating tool and printed name cards possible.
- **Unnamed extras:** allowed on every invite, including ones that already have named sub-people, so a guest can swap a listed person for someone the admin doesn't know. Stored as `extra_adults` / `extra_kids` counts, split adult/kid because the existing form already separates 7+ from 2–7 and the caterer prices them differently.
- **No cap on extras.** Guests can add any number; no per-invite or global limit is being built. Trade-off accepted knowingly — an unexpected headcount surfaces via the derived total, not via a block at entry time.
- **Guest never types a total.** Headcount is computed as `ticked + extras`, which makes contradictory input structurally impossible rather than something to validate against.
- **`responses` table dropped, merged into `invites`.** It had `UNIQUE (invite_id)`, i.e. it was strictly 1:1 with its parent, and every read in the codebase already fetched it nested (`select('*, responses(*)')` in `app/page.tsx:23`, `app/api/invites/route.ts:18`, `app/api/invites/[id]/route.ts:23`). The only standalone read was `app/api/stats/route.ts:17`, a second round trip that a merge collapses into one query. Once `adult_count`/`kid_count` become derived, the table would hold just three 1:1 columns — not worth a table, an FK, a UNIQUE constraint, a cascade rule and an index. Cost of the merge, accepted: `attending` becomes nullable (with `status` already signalling "has answered"), and the nested-select emulation in `lib/mock/query-builder.ts:117-134` plus every component reading `invite.responses.*` needs rewriting. The schema is changing for `attendees` regardless, and no real Supabase project is connected, so the migration itself is free.
- **`response_history` kept as-is** — counts only, no per-person snapshot. Decided against storing which specific people were coming at each submission: the extra fidelity wasn't worth the complexity for a one-off event. The log's value is catching the money-relevant change, especially `declined → attending`, which is otherwise invisible (the `edited` badge says *something* changed, never that a no became a yes). Known defect to fix while in this code: the history insert at `app/api/rsvp/route.ts:60` is awaited but its error is never checked, unlike the upsert above it, so a failed history write still reports success to the guest.

## 8. Open Questions

(none remaining — all resolved above)

## 9. Definition of Done for This Phase

- All functional gaps in Section 4 implemented and working against mock data.
- Per-person attendee tracking (§4.9) works end to end: admin can add/edit named people under an invite, the guest sees them with per-person ticks, can decline individuals, and can add unnamed extras.
- Every headcount in the app (invitees row total, stats tab, exports) comes from the single derived formula in §5 — no stored `adult_count`/`kid_count` outside `response_history`.
- The `responses` table no longer exists; its three surviving columns live on `invites`, and no component reads `invite.responses.*`.
- Mock seed data covers all of the §5 cases, so every screen and filter renders against something.
- Sending an invite produces a WhatsApp preview card carrying the guest's name (§4.10), with a static fallback image when generation fails.
- Sending an invite does **not** move it to `opened` — verified by loading the page with a crawler User-Agent and with JavaScript disabled, and confirming the status is unchanged. The OG image route never mutates status.
- `feat/dietery-responses` branch deleted (locally and from `DmitriPer/weddingRsvp` on GitHub) — done.
- No styling changes made.
- No real Supabase project touched.
- No automated/bulk WhatsApp sending exists anywhere in the code — every send is a human tap on a per-row `wa.me` button.
- Swapping mock data for a real Supabase project requires changing only the data-access layer's backing store (Section 7), not the API routes, components, or business logic.
