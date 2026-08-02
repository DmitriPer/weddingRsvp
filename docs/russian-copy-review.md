# Russian copy — review sheet

Every word a Russian-speaking guest reads. The Russian column is **my draft**; correct anything that reads wrong and paste the changed rows back — the `key` column is what I use to apply them, so keep it with the row.

**Only UI text is here.** Guest names are never translated: you type `Слава` in the admin and `Слава` is what shows.

Status: **2 of 39 reviewed.**

---

## Already corrected by you

| key | עברית | русский |
|---|---|---|
| `rsvp.nav.navigate` | ניווט לאולם | Как добраться ✅ |
| `rsvp.nav.addToCalendar` | הוספה ליומן | Добавить в календарь ✅ |

> ⚠️ **Check `Добавить в календарь` on a phone.** The action bar puts three buttons side by side, about 110px each on a 375px screen. At 20 characters this will wrap to two or three lines and make the Russian bar taller than the Hebrew one. If it looks bad, `В календарь` fits. Not urgent — just look at it when you next open the page on your phone.

---

## 1. Greeting and the yes/no choice

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.greeting` | שלום {name} | Здравствуйте, {name} |
| `rsvp.intro` | נשמח לדעת אם תגיעו | Будем рады узнать, придёте ли вы |
| `rsvp.yes` | מגיעים | Придём |
| `rsvp.no` | לא נגיע | Не придём |

> **The line most worth your judgement is the greeting.** One greeting serves everyone — your grandmother and your closest friend read the same words. `Здравствуйте` is respectful but stiff; `Привет` is warm but casual. Hebrew's `שלום` sits between the two, and Russian has no exact middle.

## 2. The form

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.whoIsComing` | מי מגיע? | Кто придёт? |
| `rsvp.whoIsComingHint` | סמנו את מי שמגיע | Отметьте тех, кто придёт |
| `rsvp.extras` | אורחים נוספים | Дополнительные гости |
| `rsvp.extrasHint` | אפשר להוסיף אורחים שלא מופיעים ברשימה | Можно добавить гостей, которых нет в списке |
| `rsvp.extraAdults` | מבוגרים נוספים | Взрослые |
| `rsvp.extraKids` | ילדים נוספים | Дети |
| `rsvp.fewer` | פחות | Меньше |
| `rsvp.more` | עוד | Больше |
| `rsvp.submit` | שליחת התשובה | Отправить ответ |
| `rsvp.submitting` | שולח… | Отправляем… |
| `cancel` | ביטול | Отмена |

> `extraAdults` / `extraKids` are deliberately shorter than the Hebrew: the heading above them already says "Дополнительные", and repeating it on each label reads clumsy in Russian. Say if you'd rather they matched the Hebrew exactly.

## 3. Errors

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.chooseAnswer` | בחרו אם אתם מגיעים | Выберите, придёте ли вы |
| `rsvp.pickSomeone` | סמנו לפחות אדם אחד, או ענו שאינכם מגיעים | Отметьте хотя бы одного гостя или ответьте, что не придёте |
| `rsvp.failed` | השליחה נכשלה. נסו שוב. | Не удалось отправить. Попробуйте ещё раз. |

## 4. After submitting

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.confirmation.titleAttending` | תודה! נרשמתם | Спасибо! Мы вас записали |
| `rsvp.confirmation.titleDeclined` | תודה שעדכנתם | Спасибо, что сообщили |
| `rsvp.confirmation.declined` | רשמנו שלא תגיעו. חבל, נתגעגע! | Мы записали, что вы не придёте. Жаль, будем скучать! |
| `rsvp.confirmation.attending` | מגיע | Придёт |
| `rsvp.confirmation.extraGuest` | אורח נוסף | Дополнительный гость |
| `rsvp.confirmation.total` | סה״כ N אורחים | Всего N гость / гостя / гостей |
| `rsvp.confirmation.breakdown` | N מבוגרים · N ילדים | N взрослый/взрослых · N ребёнок / ребёнка / детей |
| `rsvp.confirmation.changeAnswer` | שינוי התשובה | Изменить ответ |

> **`total` and `breakdown` decline automatically** — 1 гость, 2 гостя, 5 гостей, 21 гость, and the same for ребёнок/ребёнка/детей. Tested across 1, 2, 4, 5, 11, 21, 22, 25. Only tell me if a *word choice* is wrong; the grammar is handled.

## 5. Past the deadline

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.closed.title` | אישורי ההגעה נסגרו | Подтверждение участия закрыто |
| `rsvp.closed.callInstead` | לשינויים אפשר להתקשר אלינו: | Для изменений позвоните нам: |
| `rsvp.closed.callInsteadNoPhone` | לשינויים אפשר ליצור איתנו קשר. | Для изменений свяжитесь с нами. |
| `rsvp.closed.yourAnswer` | התשובה שלכם | Ваш ответ |
| `rsvp.closed.noAnswer` | לא נרשמה תשובה | Ответ не получен |

## 6. Buttons and the landing page

| key | עברית | русский (draft) |
|---|---|---|
| `rsvp.nav.rsvp` | אישור הגעה | Подтвердить |
| `rsvp.nav.yourAnswer` | התשובה שלכם | Ваш ответ |
| `rsvp.nav.closeSheet` | סגירה | Закрыть |
| `rsvp.landing.invitation` | מתחתנים! | Мы женимся! |
| `rsvp.landing.seeYou` | נשמח לראותכם | Будем рады видеть вас |

> The bar buttons are the tightest space on the page — see the width note at the top. Shorter is better here.

## 7. The WhatsApp preview card

Not page copy. WhatsApp always prints these above the message, so the only choice is what they say.

| key | עברית | русский (draft) |
|---|---|---|
| `og.imageAlt` | ההזמנה לחתונה | Приглашение на свадьбу |
| `og.untitled` | אתם מוזמנים | Вы приглашены |
| `siteName` | אישורי הגעה | Подтверждение участия |

---

## Not on this sheet, and why

**The three WhatsApp message templates.** Those are yours to write, not translate — you'll type them in the admin under **הגדרות → הודעות ברוסית**. They're currently empty, which means a Russian household would get a blank message. Deliberate: it does not fall back to Hebrew, and the settings tab warns you as soon as a Russian household exists.

**The calendar file (`.ics`).** It names an Israeli venue and is titled with `couple_names`, both of which stay Hebrew. Decided, not overlooked.

**The admin panel.** Hebrew only — you're the only person who uses it.
