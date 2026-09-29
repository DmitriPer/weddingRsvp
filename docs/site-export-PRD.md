# Invitees — Export in the RSVP Site's Template Format

**Owner:** Dmitri
**Status:** built 2026-09-27 (PR #21)
**Replaces:** the invitees page's "ייצוא לסידור הושבה" export (`lib/seating-sheet.ts`)

## 1. Mission

The guest list has to be uploaded to an outside RSVP/invitation site that accepts its own Excel template (`wedding_invitations_template_he-IL.xls`). The app generates that format directly from the invitations on screen, so the list never has to be retyped.

## 2. Scope

| In scope | Out of scope |
|---|---|
| A new export in the site's template layout | Reading or filling the user's `.xls` file |
| Replacing "ייצוא לסידור הושבה" and removing its per-person seating sheet | The seating page's "ייצוא לאקסל" and the import panel's "ייצוא הרשימה" (unchanged) |
| | Address, email, landline and cheque data (the app doesn't hold them) |

## 3. Functionality

### 3.1 Button

"ייצוא לסידור הושבה" becomes **"ייצוא לאתר"**. It keeps today's behaviour: it exports the rows currently shown in the invitees list, whatever the filters.

### 3.2 File layout

The file is `.xlsx`, with a sheet named `הזמנות`, set right-to-left.

**Row 1** holds merged group headings:

| Heading | Spans |
|---|---|
| שיוך | C–D |
| פרטי התקשרות | E–G |
| כתובת | H–K |

**Row 2** holds the column headers:

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| הזמנה לכבוד | מס' אורחים שהוזמנו | צד | קבוצה | סלולרי | טלפון רגיל | אימייל | עיר | רחוב | מיקוד | תא דואר | צ'ק צפוי |

**Styling:** navy header fills with white bold text, and thin cell borders, matching the template.

### 3.3 Rows

**One row per person coming,** from row 3 on (revised 2026-09-27, replacing one row per invitation):

| Invitation | Rows |
|---|---|
| `אלי ויעל`, both coming | `אלי · 1` (with phone), `יעל · 1` (no phone) |
| named people + unnamed +1s | each named person at 1, then one row `+1 של <invitation name>` counting the +1s |
| only +1s coming | just the `+1 של …` row, carrying the phone |
| nobody coming | no rows |

- **Coming is per person:** the household answered yes and that person is ticked (`answerForPerson`). Named children get their own row like adults.
- **Unnamed +1s** have no name, and the app doesn't record who added them. So a household's +1s share one row, named `+1 של <invitation name>` (e.g. `+1 של אלי ויעל`).
- **The household's phone** goes on its first row only.

| Column | Value |
|---|---|
| הזמנה לכבוד | the person's name, or `+1 של <invitation name>` for the +1 row |
| מס' אורחים שהוזמנו | 1, or the number of +1s |
| צד | חתן / כלה / חתן וכלה (shared, as iPlan writes it) |
| קבוצה | משפחה / חברים / עבודה / הוזמן ע״י המשפחה |
| סלולרי | first row of the household only: an Israeli number as `050-1234567`, anything else as stored |
| All other columns | empty |

Households follow the list's order on screen. Inside a household, named people come in the order listed, then the +1 row.

## 4. Data model

No change.

## 5. Definition of done

- The file opens in Excel with the template's sheet name, headings, merges, colours and RTL direction.
- Each household's rows add up to its coming figure on screen.
- Only filtered invitations with at least one person coming produce rows.
- The old seating-sheet builder is removed with nothing left referencing it.
- `npm run build` and `npm run lint` pass.
- The download is checked from Dmitri's Chrome tab. It is read-only.
