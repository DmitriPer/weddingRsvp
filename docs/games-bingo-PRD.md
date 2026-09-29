# Games Area — Wedding Bingo

**Owner:** Dmitri
**Status:** built 2026-09-29 (PR #23)
**Source:** `~/Downloads/wedding_bingo.html` (standalone page, 2026-09-29) — ported, not linked

## 1. Mission

A `/games` area for printed games played at the wedding. The first game is **wedding bingo**: each guest gets an A5 card of 24 tasks around a free centre square, marks the ones they complete, and five in a row wins.

The standalone HTML page already does this, but its squares live in code and edits are lost on reload. Here the squares move into the database, are edited in Hebrew and Russian side by side, and cards are shuffled and printed from the page.

## 2. Scope

| In scope | Out of scope |
|---|---|
| `/games` shell with a vertical game list (Bingo only for now) | Any other game — the list is built so one can be added |
| `/games/bingo`: card count, language, shuffle, print | Saving generated cards / reprinting identical cards |
| Bingo squares in the DB — one row per square, Hebrew + Russian text, add/edit/delete from the page | Guests playing or scoring on their phones |
| A "Games" tab in the admin tab bar | Restyling — the card design is ported as-is |
| Login-only: `proxy.ts` matcher and every API route | Card settings (count, language) persisted anywhere |

## 3. Functionality

### 3.1 The `/games` shell

- `/games` redirects to `/games/bingo`.
- Layout: a **vertical** game list on the start side (right, RTL) plus a link back to `/admin`.
- **Desktop first**, like the rest of the admin surface — cards are generated and printed at a desk.
- Reachable from a new **"משחקים"** tab in the admin tab bar.

### 3.2 Access

Login only, the same two locks as `/admin` (CLAUDE.md "Defense in depth"):

1. `proxy.ts` matcher extended to `/games/*`; no session → redirect to `/admin/login`.
2. Each page re-checks `verifyAdmin()`, and each API route re-verifies the session itself.

### 3.3 Bingo controls

| Control | Behaviour |
|---|---|
| Card count | 1–80, default 20 |
| Language | Hebrew / Russian / both |
| חלוקה חדשה | Reshuffles all cards |
| הדפסה | `window.print()` |

- Controls are page state only; they reset on reload.
- **Changing language does not reshuffle.** Only the shuffle button does. (The original reshuffled silently.)
- **"Both"**: every Hebrew card has a Russian twin with **the same squares in the same positions**, so a table can be handed a matching pair. Possible because squares are paired rows.

### 3.4 Card rules

- 5×5 grid, centre square is "Free", the other 24 are drawn at random without repeats from the usable squares.
- A square is **usable in a language** when its text in that language is non-empty. A square with an empty Russian side is left off Russian cards (and so off "both" pairs).
- Fewer than 24 usable squares: a warning is shown and squares repeat to fill the card, as the original did.
- Zero usable squares: no cards; the page explains why.

### 3.5 Square editor

- A table: Hebrew | Russian | delete, plus an add row.
- Each row saves on its own, like the budget table.
- Both texts trimmed; a square needs at least one non-empty side.
- Text edits appear on the cards at once without reshuffling; adding or deleting a square reshuffles.

### 3.6 Print

Unchanged from the original: A5 page, 0.7cm margin, one card per page, cut lines. Controls, editor and navigation are hidden in print.

### 3.7 Mobile (added 2026-09-29)

Desktop first, but a phone must be able to **edit squares and see the result**, and print when needed.

- **Shell:** below `md` (768px) the game list becomes a horizontal strip above the game.
- **Cards:** shrunk on screen to fit the phone's width (CSS `zoom`, in steps), never scrolled sideways. **Screen only**: print is always true A5.
- **Editor:** open by default on a phone, collapsed on desktop. Below `md` each square stacks: Hebrew, Russian, delete. A phone-only "↓ לכרטיסים" link jumps from the list to the cards, since the stacked list is several screens long.
- **Touch:** buttons and links are at least 44px tall on phones. Inputs use 16px text so iOS Safari doesn't zoom in on focus.
- **Print from a phone** works through the browser's print or share sheet. iPhone Safari may ignore the A5 page size and use its default paper. The card prints at its true size either way; for the full print run, a computer is the reliable route.

## 4. Data model

Migration `015_bingo_squares.sql`:

```sql
create table if not exists bingo_squares (
  id          uuid primary key default gen_random_uuid(),
  text_he     text not null default '',
  text_ru     text not null default '',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table bingo_squares enable row level security;  -- deny-all, like every table
```

- **Seed:** the 28 squares from §6, inserted **only when the table is empty**, so re-running the migration never duplicates them. The table is new and holds no guest data; no existing row is touched.
- **Dmitri runs it in the Supabase SQL editor**, like migrations 005–014.

Layering (docs/conventions.md):

- `lib/data`: `listBingoSquares`, `createBingoSquare`, `updateBingoSquare`, `deleteBingoSquare`
- API: `/api/bingo-squares` (GET, POST), `/api/bingo-squares/[id]` (PATCH, DELETE) — each calls `verifyAdmin()`
- Validation in `lib/validation.ts`; UI text in `lib/strings.ts`
- Card generation (shuffle, pairing, fill rules) as pure functions in `lib/bingo.ts`

## 5. Optimisation of the original page

| Original | Here |
|---|---|
| Couple photo embedded as base64 — 84 KB of the 97 KB file, 736×981 shown at 130px | `public/assets/games/bingo-couple.jpg`, resized to ~260px wide (2× for print/retina), ~10 KB, cached |
| Google Fonts `<link>` — render-blocking, third-party request | `next/font`: self-hosted, no layout shift. Parisienne and Manrope scoped to `/games`; Heebo already loaded by the app |
| Cards built as HTML strings via `innerHTML`, editor text injected unescaped | React components; text escaped by default |
| Language change reshuffles | Only the shuffle button reshuffles |
| Edits lost on reload; Russian list not editable | Both languages in the DB, editable |

## 6. Squares (seed)

| # | Hebrew | Russian |
|---|---|---|
| 1 | לשתות שוט עם החתן | Выпить шот с женихом |
| 2 | לשתות שוט עם הכלה | Выпить шот с невестой |
| 3 | להרים כוסית עם כל השולחן | Поднять бокал со всем столом |
| 4 | להזמין קוקטייל לפי המלצת הברמן | Заказать коктейль по совету бармена |
| 5 | לנסות משקה שמעולם לא שתיתם | Попробовать напиток, который никогда не пробовали |
| 6 | לצייר ציור לחתן ולכלה | Нарисовать рисунок жениху и невесте |
| 7 | לשחק משחק עם מישהו שלא מכירים | Сыграть в игру с незнакомым гостем |
| 8 | לנצח במשחק בעמדת המשחקים | Выиграть в игру на игровой стойке |
| 9 | לשים קעקוע זמני על היד | Сделать временную татуировку на руке |
| 10 | לשכנע עוד מישהו לשים קעקוע | Уговорить кого-то сделать татуировку |
| 11 | להשלים חלק בפאזל הברכות | Дополнить пазл пожеланий |
| 12 | לטעום מכל 4 עמדות האוכל | Попробовать еду со всех 4 станций |
| 13 | לנפח בועות סבון בעצמכם | Самим надуть мыльные пузыри |
| 14 | לצלם תמונה בתוך ענן בועות | Сделать фото среди пузырей |
| 15 | לרקוד לשיר האהוב עליכם ביותר | Танцевать под свою любимую песню |
| 16 | לשיר בקול רם עם כולם | Громко петь вместе со всеми |
| 17 | לצרף מישהו חדש לריקוד | Позвать в танец нового человека |
| 18 | לעשות ריקוד מצחיק ברחבה | Станцевать смешной танец на танцполе |
| 19 | לרקוד לבד באמצע הרחבה | Танцевать одному в центре танцпола |
| 20 | לרקוד בקבוצה של 4 ומעלה | Танцевать в группе от 4 человек |
| 21 | לשכנע מישהו ביישן לרקוד | Уговорить стеснительного потанцевать |
| 22 | לצלם סטורי מהרחבה ולתייג את הזוג | Снять сторис с танцпола и отметить пару |
| 23 | לצלם סלפי עם 3 אנשים לא מוכרים | Сделать селфи с 3 незнакомцами |
| 24 | לצלם תמונה עם כל השולחן | Сделать фото со всем столом |
| 25 | לגרום למישהו לצחוק בקול רם | Рассмешить кого-то до громкого смеха |
| 26 | להחליף מקום ישיבה לרגע | Поменяться местом на минуту |
| 27 | לרקוד עם מישהו גבוה או נמוך מכם משמעותית | Потанцевать с тем, кто намного выше или ниже вас |
| 28 | להצטלם עם החתן או הכלה | Сделать фото с женихом или невестой |

Rows 7, 11, 17 and 25 carry corrected Russian (approved 2026-09-29); the original translations had drifted from the Hebrew.

## 7. Explicitly deferred

- Other games in the `/games` list.
- Saving or reprinting an exact set of generated cards.
- Reordering squares from the UI (`sort_order` exists; seed order is kept).
- Visual redesign of the card.

## 8. Definition of done

- Migration 015 run; 28 squares present.
- `/games/bingo` works behind the login; logged out → redirected to `/admin/login`; API routes return 401 without a session.
- Squares added, edited and deleted from the page survive a reload.
- "Both" produces matching Hebrew/Russian pairs; language change keeps the current shuffle.
- Print gives one A5 card per page with no screen chrome.
- `npm run build` and `npm run lint` pass.
- Checked in the browser; tested by Dmitri.
