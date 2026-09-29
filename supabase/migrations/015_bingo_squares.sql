-- Wedding bingo squares (docs/games-bingo-PRD.md §4).
--
-- One row per square, PAIRED: the Hebrew and Russian text of the same task sit
-- on the same row. Two independent lists drifted apart in the original page —
-- four Russian squares no longer said what the Hebrew said. A pair also lets a
-- Hebrew card and its Russian twin share the same squares in the same spots.
--
-- An empty side is allowed and means "not on cards in that language". The API
-- refuses a square with both sides empty (lib/validation.ts).
--
-- Nothing here touches guest data: a new table, and a seed that only runs
-- while that table is empty.
--
-- Re-runnable.

create table if not exists bingo_squares (
  id          uuid primary key default gen_random_uuid(),
  text_he     text not null default '',
  text_ru     text not null default '',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists bingo_squares_sort_order_idx on bingo_squares (sort_order);

-- RLS deny-all, like every other table (PRD §7.2). No policies: the
-- publishable key can read and write nothing; all access is the secret key
-- inside an API route.
alter table bingo_squares enable row level security;

-- ---------------------------------------------------------------------------
-- Seed: the 28 squares from the original page (PRD §6). Rows 7, 11, 17 and 25
-- carry corrected Russian, approved 2026-09-29.
--
-- Guarded by `where not exists`, so re-running the migration after squares
-- were edited or deleted in the app never brings the defaults back.
-- ---------------------------------------------------------------------------
insert into bingo_squares (sort_order, text_he, text_ru)
select v.sort_order, v.text_he, v.text_ru
from (values
  ( 1, 'לשתות שוט עם החתן',                        'Выпить шот с женихом'),
  ( 2, 'לשתות שוט עם הכלה',                        'Выпить шот с невестой'),
  ( 3, 'להרים כוסית עם כל השולחן',                  'Поднять бокал со всем столом'),
  ( 4, 'להזמין קוקטייל לפי המלצת הברמן',             'Заказать коктейль по совету бармена'),
  ( 5, 'לנסות משקה שמעולם לא שתיתם',                'Попробовать напиток, который никогда не пробовали'),
  ( 6, 'לצייר ציור לחתן ולכלה',                     'Нарисовать рисунок жениху и невесте'),
  ( 7, 'לשחק משחק עם מישהו שלא מכירים',             'Сыграть в игру с незнакомым гостем'),
  ( 8, 'לנצח במשחק בעמדת המשחקים',                  'Выиграть в игру на игровой стойке'),
  ( 9, 'לשים קעקוע זמני על היד',                    'Сделать временную татуировку на руке'),
  (10, 'לשכנע עוד מישהו לשים קעקוע',                'Уговорить кого-то сделать татуировку'),
  (11, 'להשלים חלק בפאזל הברכות',                   'Дополнить пазл пожеланий'),
  (12, 'לטעום מכל 4 עמדות האוכל',                   'Попробовать еду со всех 4 станций'),
  (13, 'לנפח בועות סבון בעצמכם',                    'Самим надуть мыльные пузыри'),
  (14, 'לצלם תמונה בתוך ענן בועות',                 'Сделать фото среди пузырей'),
  (15, 'לרקוד לשיר האהוב עליכם ביותר',              'Танцевать под свою любимую песню'),
  (16, 'לשיר בקול רם עם כולם',                      'Громко петь вместе со всеми'),
  (17, 'לצרף מישהו חדש לריקוד',                     'Позвать в танец нового человека'),
  (18, 'לעשות ריקוד מצחיק ברחבה',                   'Станцевать смешной танец на танцполе'),
  (19, 'לרקוד לבד באמצע הרחבה',                     'Танцевать одному в центре танцпола'),
  (20, 'לרקוד בקבוצה של 4 ומעלה',                   'Танцевать в группе от 4 человек'),
  (21, 'לשכנע מישהו ביישן לרקוד',                   'Уговорить стеснительного потанцевать'),
  (22, 'לצלם סטורי מהרחבה ולתייג את הזוג',           'Снять сторис с танцпола и отметить пару'),
  (23, 'לצלם סלפי עם 3 אנשים לא מוכרים',             'Сделать селфи с 3 незнакомцами'),
  (24, 'לצלם תמונה עם כל השולחן',                   'Сделать фото со всем столом'),
  (25, 'לגרום למישהו לצחוק בקול רם',                'Рассмешить кого-то до громкого смеха'),
  (26, 'להחליף מקום ישיבה לרגע',                    'Поменяться местом на минуту'),
  (27, 'לרקוד עם מישהו גבוה או נמוך מכם משמעותית',   'Потанцевать с тем, кто намного выше или ниже вас'),
  (28, 'להצטלם עם החתן או הכלה',                    'Сделать фото с женихом или невестой')
) as v(sort_order, text_he, text_ru)
where not exists (select 1 from bingo_squares);

-- Verify against information_schema, never the editor's "Success" (see 005):
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name = 'bingo_squares' order by ordinal_position;
--
--   select relrowsecurity from pg_class where relname = 'bingo_squares';  -- must be true
--
--   select count(*) from bingo_squares;  -- 28 after a first run
