# Admin Answer & Phone Calls

**Owner:** Dmitri
**Status:** built 2026-10-01 (branch feat/admin-answer-calls). Needs migrations 020 and 021 run before deploy.
**From:** live use. Guests who don't answer on WhatsApp get a phone call, and the answer they give on the phone had nowhere to go.

## 1. Mission

Close the loop for the follow-up call:
1. Flag a silent household for a call **sooner**.
2. Let the admin **dial it from the row**.
3. Let the admin **record each person's answer** from the phone call: coming, maybe or not coming. One household can hold all three.

## 2. Scope boundaries

| In | Out |
|---|---|
| Lower the call threshold from 5 to 2 | Any automated, scheduled or bulk calling or messaging (hard rule) |
| A `tel:` button on flagged rows | Logging calls or counting them as contact attempts |
| A per-person answer (yes / maybe / no), set by the admin | Per-person answers on the guest page; its form is unchanged |
| The household answer derived from its people | Changes to `/api/rsvp`'s request shape |
| History names the person and marks admin changes | Styling beyond what's needed to fit the selector in |

## 3. Phone call flag

**Rule** (`lib/status.ts`): `FOLLOW_UP_ATTEMPT_THRESHOLD` goes from **5 to 2**. Nothing else changes: the flag applies only to households that are invited and still silent (`pending` / `opened`).

Undecided households are **not** flagged. They answered, and the flag is about silence.

## 4. Call button

- Shown **only on flagged rows**, and only when the row has a phone number. On those rows it works as a to-do list.
- It is a plain `tel:` link with the stored number, which is already normalised to `+972…` (`lib/phone.ts`).
- Tapping it **records nothing**. It does not touch `contact_attempts`, `last_contacted_at` or `status`, because nothing tells the app whether the call actually connected.

## 5. Per-person answer

### The control

In the expanded people list on each invitee row, the mark next to each name (✓ / ? / ✕ / ○) is a **selector**: טרם ענו (only shown while unset) / מגיעים / עדיין לא יודעים / לא מגיעים. Changing it saves **that person only**. +1 placeholders have one too.

There is no household-level control. *(A first version had one, "עדכון תשובה"; it was replaced the same day because the need is per person.)*

### What a change does

1. The person's `answer` is set, and `is_attending` is set in the same update (`answer = 'yes'`).
2. "Not coming" clears their table; "maybe" keeps it (`lib/seating.ts` `losesSeat`, unchanged).
3. The **household answer is recalculated** from all its people (`householdAnswer` in `lib/headcount.ts`):

   | People | Household |
   |---|---|
   | anyone coming | yes |
   | else anyone maybe | undecided |
   | else anyone not coming | no |
   | nobody answered | — (unchanged) |

   People still unset don't count either way. If one person says "not coming" and the others haven't answered, the household reads **not coming** and counts 0 until someone says yes.
4. Status moves to `submitted`, or to `edited` if the household had already answered (`statusAfterSubmit`). `responded_at` is set if empty.
5. A `response_history` row is appended: the household snapshot, `source = 'admin'`, and `person_name`.

**The RSVP deadline does not apply.** Late phone confirmations still need recording; the guest route keeps enforcing it.

### API

`POST /api/attendees/[id]/answer`, body `{ answer: 'yes' | 'no' | 'undecided' }`. Admin-only (lock #2): 401 without a session, 400 on a bad answer, 404 on an unknown person.

### The guest page

Unchanged on screen. When a guest submits, every person's `answer` is **overwritten** from the form:
- household yes → ticked people `yes`, unticked `no`, +1s `yes`
- household no / maybe → everyone `no` / `undecided`, and +1s deleted, as before

A guest whose household holds a per-person "maybe" sees that person unticked; submitting makes them `no`. That's acceptable, because the guest is answering for the household.

## 6. Data model

Migration `020_history_source.sql` (already in the branch): `response_history.source`, `'guest'` / `'admin'`, default `'guest'`.

Migration `021_person_answer.sql`:
- `attendees.answer text null`, check `in ('yes', 'no', 'undecided')`. `null` = not answered yet.
- **Backfill**, one statement, only rows still `null`, derived from today's rule (`answerForPerson` as it was):
  - household unanswered → `null`
  - household yes → `yes` if ticked, else `no`
  - household no / undecided → the same
- `response_history.person_name text null`. Null for guest submissions and for older rows.

**The backfill writes to every existing person row on the real database.** It changes only the new column, is derived entirely from data already there, and is re-runnable because it only touches nulls. Run it deliberately, then verify:
- no row has `answer = 'yes'` with `is_attending = false`
- the per-answer counts match the dashboard from before the migration

**`is_attending` stays.** It is kept equal to `answer = 'yes'` on every write, so headcount, budget and the guest form need no change. **`invites.answer` stays stored**, recalculated on every per-person change, so filters, stats and send kinds need no change.

### Readers that switch to the person's own answer

- `answerForPerson(person)` returns `person.answer`. Its callers are the seating board, the site export and the people list.
- `countDeclined`, `countAwaiting`, `countUndecided` count people by their own answer (`lib/stats.ts`).
- The row summary shows a mixed household as "2 מגיעים מתוך 3 · 1 עדיין לא יודעים".

## 7. Explicitly deferred

- Call outcome logging ("no answer", "call back later").
- Flagging undecided households for a call.
- Per-person answers on the guest page.
- Recalculating the household answer when a person is **added or deleted** in the editor. Only answer changes recalculate it.

## 8. Open questions

None. Resolved 2026-10-01:
- Threshold: 2. Call button: flagged rows only.
- Per person: yes / maybe / no each; admin only; in the expanded people list; replaces the household form.
- Partial answers: the household counts as answered, and the rest stay awaiting.
- History: a row per change, naming the person.
- Deadline: the admin bypasses it.

## 9. Definition of done

- Migrations 020 and 021 are applied and verified via `information_schema`, plus the backfill checks in §6.
- The rules are checked directly: threshold (1 → no flag, 2 pending → flag, 2 submitted → no flag), and `householdAnswer` for each row of the table in §5.
- The call button appears only on flagged rows that have a phone, and its `href` is `tel:+972…`.
- `POST /api/attendees/[id]/answer` returns 401 without a session.
- The write path is verified on **one real person** and restored immediately, with Dmitri's OK at the time. It leaves two history rows behind, since history is append-only.
- `npx tsc --noEmit && npm run lint && npm run build` pass.
- `docs/progress.md` and `docs/architecture.md` are updated.
