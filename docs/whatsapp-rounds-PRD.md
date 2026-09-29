# WhatsApp — Choose Which Template to Send, and a "Please Answer" Reminder

**Owner:** Dmitri
**Status:** built 2026-09-28 (PR #22); migration 014 run
**Extends:** `wedding-rsvp-PRD.md` §6.7b (templates), §6.9 (wa.me), §6.10 (contact tracking), §6.13–6.14 (day-of and thank-you, until now prep only)

## 1. Mission

Most invitations are out. The work now comes in **rounds**, each aimed at a different group:

| Round | Who gets it |
|---|---|
| Reminder | whoever hasn't answered |
| Day-of message | whoever is coming |
| Thank-you | whoever said yes |

Today the row's WhatsApp button can only send the invitation. The day-of and thank-you templates can be edited but never sent, and there is no reminder template at all. This adds the reminder and lets the admin choose which template the row buttons send.

## 2. Scope

| In scope | Out of scope |
|---|---|
| A new reminder template (Hebrew and Russian), editable in Settings | New placeholders such as `{{date}}` or `{{venue}}` |
| A toolbar mode choosing which template row buttons send | Sending history per template |
| Greying out rows a template doesn't apply to | Any bulk, scheduled or automatic sending |
| Recording a send according to its template | |

**The hard rule is unchanged:** every send is one human tap on one row, then send pressed inside WhatsApp.

## 3. Functionality

### 3.1 New template: תזכורת לתשובה

- Two new `wedding_config` columns: `reminder_message_template_he` and `reminder_message_template_ru`.
- They're edited in Settings beside the other templates, and substitute `{{name}}` and `{{link}}` like them.
- They start empty. Dmitri pastes his text in Settings after the migration.

### 3.2 Mode selector

`שליחה: [הזמנה ▾]` in the invitees toolbar. The options are הזמנה / תזכורת לתשובה / יום האירוע / תודה.

- Every row's WhatsApp button sends the chosen template, in that household's language.
- When the mode isn't הזמנה, the button shows the template's name, e.g. "WhatsApp · תזכורת".
- The mode **resets to הזמנה on refresh**.

A row the template doesn't apply to is **greyed out, with the reason on hover**:

| Template | Who can receive it |
|---|---|
| הזמנה | anyone with a phone (as today) |
| תזכורת לתשובה | invited, not answered yet (`isAwaitingResponse`: status `pending`/`opened`) |
| יום האירוע, תודה | households that answered yes |

A row is also greyed out when:
- the template is empty in the household's language: "התבנית ריקה — ממלאים בהגדרות"
- there's no phone number (as today)

### 3.3 Recording a send

"נשלח? כן / לא" is unchanged. The confirm request names the template, and **the server decides** what is recorded:

| Template | What is recorded |
|---|---|
| הזמנה | contact count +1, last contact time, `added` → `pending` (as today) |
| תזכורת לתשובה | contact count +1, last contact time. The reminder feeds the "needs a phone call" flag. |
| יום האירוע, תודה | last contact time only. No count and no status change: these messages aren't chasing an answer. |

An unknown or missing template name is treated as הזמנה. That keeps today's behaviour for anything already calling the route.

## 4. Data model

Migration `014_reminder_template.sql`:

```sql
alter table wedding_config add column if not exists reminder_message_template_he text not null default '';
alter table wedding_config add column if not exists reminder_message_template_ru text not null default '';
```

- It's additive only: no row data is changed.
- **Dmitri runs it in the Supabase SQL editor before this is merged**, like migrations 005–013.

## 5. Definition of done

- The reminder template can be saved in Settings in both languages.
- The mode selector switches every row's button, labels it, and greys out rows that don't fit, with the reason shown.
- Confirming a send records it per §3.3.
- `npm run build` and `npm run lint` pass.
- Tested by Dmitri, with a real send confirmed on one row of his choosing.
