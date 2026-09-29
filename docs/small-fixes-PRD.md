# Small Fixes: Seats on Decline, Bulk-Delete Count, Phone Warning

**Owner:** Dmitri
**Status:** built 2026-09-29 (branch feat/small-fixes)
**From:** the PRD-vs-code audit of 2026-09-29

## 1. A decline gives up the seat

**Before:** a decline hid the person from the seating board but left `attendees.table_id` set. If they later changed to yes, they silently reappeared at their old table, which had since been planned without them.

**Rule** (`lib/seating.ts` `losesSeat`, applied in `submitRsvp`):

| The guest's answer | Seat |
|---|---|
| Household answers **no** | Everyone in it loses their table |
| Household answers **yes**, a person unticked | That person loses their table |
| Household answers **undecided** | Seats **kept**: undecided people are seated on purpose |

`table_id` is cleared in the same update that marks the person as not attending.

**Older declines:** a one-off preview query was run on 2026-09-29. It found **nobody** still holding a table, so no cleanup was needed and the script was not kept.

## 2. Bulk-delete count includes +1s

The confirmation counted invited people only (`countInvited`, which excludes guest-added +1s by design), so it understated what a cascade deletes. It now counts every person row (`countPeopleRows` in `lib/headcount.ts`).

## 3. Phone warning in the add and edit forms

A number `lib/phone.ts` doesn't recognise, such as a short one or letters, shows a warning under the field: "המספר לא נראה תקין — ה-WhatsApp עלול לא להגיע. אפשר לשמור בכל זאת."
- It is **a warning, not a block**, like the duplicate-phone warning.
- It uses the same check the importer already flags.
- Israeli numbers in any common format, and `+` international numbers, get no warning.

## 4. Out of scope

- A cap on +1s: not needed.
- The admin check: the decision is to keep it as is.
- The page without an invite link.
- A Russian preview card.

## 5. Definition of done

- The rules are checked directly: no → loses the seat; undecided and yes → keep it; phone cases as in §3.
- `npm run build` and `npm run lint` pass.
- No test writes to the real database.
