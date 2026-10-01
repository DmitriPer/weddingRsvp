# Admin Answer & Phone Calls

**Owner:** Dmitri
**Status:** built 2026-10-01 (branch feat/admin-answer-calls). Needs migration 020 run before deploy.
**From:** live use. Guests who don't answer on WhatsApp get a phone call, and the answer they give on the phone had nowhere to go.

## 1. Mission

Close the loop for the follow-up call:
1. Flag a silent household for a call **sooner**.
2. Let the admin **dial it from the row**.
3. Let the admin **record the answer** given on the phone, the same way a guest's own answer is recorded.

## 2. Scope boundaries

| In | Out |
|---|---|
| Lower the call threshold from 5 to 2 | Any automated, scheduled or bulk calling or messaging (hard rule) |
| A `tel:` button on flagged rows | Logging calls or counting them as contact attempts |
| Admin sets yes / undecided / no from the invitee row | Admin adding unnamed +1s from the answer control (see §6) |
| Admin picks which people are coming for "yes" | Changes to the guest page or `/api/rsvp` |
| History marks admin-set answers | Styling beyond what's needed to fit the controls in |

## 3. Phone call flag

**Rule** (`lib/status.ts`): `FOLLOW_UP_ATTEMPT_THRESHOLD` goes from **5 to 2**. Nothing else changes: the flag applies only to households that are invited and still silent (`pending` / `opened`).

The master PRD §6.10 ("5 attempts") is updated to say 2.

Undecided households are **not** flagged. They answered, and the flag is about silence.

## 4. Call button

- Shown **only on flagged rows**, and only when the row has a phone number. On those rows it works as a to-do list.
- It is a plain `tel:` link with the stored number, which is already normalised to `+972…` (`lib/phone.ts`).
- Tapping it **records nothing**. It does not touch `contact_attempts`, `last_contacted_at` or `status`, because nothing tells the app whether the call actually connected.
- It sits beside the WhatsApp button.

## 5. Admin sets the answer

### Behaviour

- A control on each invitee row sets the household's answer: **coming / maybe / not coming**.
- **Coming:** the admin ticks which of the household's existing people are attending. At least one person must be ticked, the same rule the guest form follows.
- **Maybe / not coming:** nobody is attending. This is the same clearing the guest path does, including the seat rules in `docs/small-fixes-PRD.md` §1.
- +1 placeholder rows are **kept on a yes** and **deleted on maybe / not coming**, exactly as in the guest path (see §6).
- It is **the same as a guest answer** in every effect:
  - status goes to `submitted`, or to `edited` if the household already answered (`statusAfterSubmit`)
  - a `response_history` row is appended, with its count snapshot
  - `responded_at` is set if empty
  - stats and the headcount pick it up, since they are derived
- **The RSVP deadline does not apply** to the admin. Late phone confirmations still need recording. The guest route keeps enforcing it.
- The pending state follows the UI convention: `use-action` + `requestJson` + `Spinner` (`docs/error-loading-PRD.md`).

### API

A new admin route, `POST /api/invites/[id]/answer`, with body `{ answer, attendingIds }`.
- It re-checks the admin session itself (lock #2). `/api/invites/*` is under the admin area, not the public RSVP route.
- It checks the shape with `parseAdminAnswer`, loads the invite (404 if unknown), then `fitAdminAnswer` narrows the ticks to this household's named people and refuses a yes with nobody coming (400).

### Data layer

`submitRsvp`'s body moved into a shared helper, `recordAnswer(invite, { answer, attendingIds, extras, source })`. The guest path finds the invite by token and passes its extra counts. The admin path, `setAnswerAsAdmin(invite, input)`, passes `extras: 'keep'`, which skips the placeholder plan. One code path writes answers, so the two cannot drift apart.

## 6. Data model

Migration `020_history_source.sql`:

```sql
alter table response_history
  add column source text not null default 'guest'
  check (source in ('guest', 'admin'));
```

- Existing rows become `guest`, which is true: before this feature only guests could answer.
- `ResponseHistoryEntry` gains `source: 'guest' | 'admin'`.
- The history modal labels admin entries **"עודכן ע״י מנהל"** ("updated by admin").
- **The migration ships before the code.** Verify it with `information_schema`, not the SQL editor's "Success" (`docs/progress.md` §5).

**Placeholders:** they are managed by count, not by tick, and are always attending. The admin control never adds them. On "coming" the existing ones are kept and shown read-only ("+N אורחים לא מזוהים"); on "maybe" or "not coming" they are deleted, as the guest path does. To add a +1, use the existing attendee editor.

*(The first draft said placeholders were "left as they are" for every answer. That contradicted the guest path, which deletes them when nobody is coming; corrected while planning, 2026-10-01.)*

## 7. Explicitly deferred

- Call outcome logging ("no answer", "call back later").
- Flagging undecided households for a call.
- A per-household or configurable threshold. It stays one constant.

## 8. Open questions

None. Resolved 2026-10-01:
- Threshold: 2.
- Call button: on flagged rows only.
- Answer control: on the admin invitee row, not the guest page.
- "Coming": the admin picks people.
- Effects: identical to a guest answer, with history marked admin.
- Deadline: the admin bypasses it.
- +1s: not added from the answer control; kept on yes, cleared on maybe / no.

## 9. Definition of done

- Migration 020 is applied and verified via `information_schema`.
- The threshold rule is checked directly: 1 attempt → no flag; 2 attempts, pending → flag; 2 attempts, submitted → no flag.
- The call button appears only on flagged rows that have a phone, and its `href` is `tel:+972…`.
- The admin answer route returns 401 without a session.
- The write path is verified on **one real row** and restored immediately: set the answer, check status, history (`source = 'admin'`) and headcount, then put the answer back. The extra history rows that leaves behind are expected, since history is append-only. Get Dmitri's OK before doing this.
- `npx tsc --noEmit && npm run lint && npm run build` pass.
- `docs/progress.md`, `CLAUDE.md`'s PRD list and master PRD §6.10 are updated.
