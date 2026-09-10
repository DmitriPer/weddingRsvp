/**
 * THE Hebrew copy. Every user-facing string lives here.
 *
 * Why one file: copy changes become a single-file edit, RTL text stays out of
 * component logic, and nothing gets hardcoded in a component where the next
 * person won't find it (docs/conventions.md §3).
 */

export const strings = {
  app: {
    title: 'אישורי הגעה',
    loading: 'טוען…',
    error: 'משהו השתבש',
    retry: 'נסו שוב',
    save: 'שמירה',
    saving: 'שומר…',
    cancel: 'ביטול',
    close: 'סגירה',
    delete: 'מחיקה',
    edit: 'עריכה',
    add: 'הוספה',
    search: 'חיפוש',
  },

  auth: {
    loginTitle: 'כניסת מנהל',
    email: 'אימייל',
    password: 'סיסמה',
    signIn: 'התחברות',
    signingIn: 'מתחבר…',
    signOut: 'יציאה',
    invalidCredentials: 'אימייל או סיסמה שגויים',
    genericError: 'ההתחברות נכשלה. נסו שוב.',
    /** The request never left the browser — not a wrong password. Admin-only
        screen, so it names the actual cause instead of being vague. */
    notConfigured: 'החיבור ל-Supabase לא מוגדר בשרת. יש להגדיר את משתני הסביבה ולפרוס מחדש.',
    signInFailed: 'לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב.',
  },

  admin: {
    tabs: {
      invitees: 'מוזמנים',
      seating: 'סידור שולחנות',
      budget: 'תקציב',
      settings: 'הגדרות',
    },
    comingSoon: 'בבנייה',
    history: 'היסטוריה',
    historyTitle: 'היסטוריית תשובות',
    noHistory: 'אין עדיין תשובות',
  },

  /** The settings tab (PRD §6.5) — wedding details and the three templates. */
  settings: {
    detailsTitle: 'פרטי החתונה',
    detailsHint: 'הפרטים האלה מופיעים בעמוד האורחים, בקובץ היומן ובכפתור הניווט.',
    coupleNames: 'שמות בני הזוג',
    weddingDateTime: 'תאריך ושעה',
    weddingDateTimeHint: 'שעון ישראל. זו השעה שתיכנס ליומן של האורחים.',
    /** The hour/minute selects that replaced the browser's AM/PM time field. */
    hour: 'שעה',
    minute: 'דקות',
    noTime: '—',
    venue: 'מקום האירוע',
    venueHint: 'שם האולם והכתובת — לפי זה עובד כפתור הניווט. תמיד בעברית.',
    venueRu: 'מקום האירוע ברוסית',
    venueRuHint:
      'מוצג למוזמנים דוברי רוסית. הניווט תמיד משתמש בכתובת בעברית, אז אפשר לכתוב כאן תעתיק. השאירו ריק כדי להציג להם את הכתובת בעברית.',
    deadline: 'תאריך אחרון לאישור',
    deadlineHint: 'אחרי התאריך הזה האורחים רואים את התשובה שלהם בלבד, ללא אפשרות לשנות. השאירו ריק כדי להשאיר את הטופס פתוח תמיד.',
    contactPhone: 'טלפון ליצירת קשר',
    contactPhoneHint: 'מוצג לאורחים אחרי שהאישורים נסגרו.',

    templatesTitle: 'הודעות WhatsApp',
    templatesHint:
      'ההודעות נפתחות ב-WhatsApp מוכנות לשליחה — הן לעולם לא נשלחות אוטומטית. אתם לוחצים שלח.',
    inviteTemplate: 'הזמנה',
    dayOfTemplate: 'תזכורת ביום האירוע',
    thankYouTemplate: 'תודה אחרי האירוע',

    /** Six templates now: three purposes in each language (PRD §6.7b). */
    hebrewGroup: 'הודעות בעברית',
    russianGroup: 'הודעות ברוסית',
    russianGroupHint: 'נשלחות למוזמנים שמסומנים כדוברי רוסית.',
    /** A blank Russian template must be visible, never a silent fallback. */
    missingRussian: (count: number) =>
      `יש ${count} מוזמנים דוברי רוסית, אבל ההודעה ברוסית ריקה — הם לא יקבלו הזמנה בשפה שלהם.`,

    variablesHint: 'אפשר להשתמש ב:',
    variableName: '{{name}} — שם ההזמנה',
    variableLink: '{{link}} — הקישור האישי של המוזמן',
    preview: 'תצוגה מקדימה',
    unknownVariable: (names: string[]) =>
      `לא מזוהה ולא יוחלף: ${names.map((one) => `{{${one}}}`).join(', ')}`,

    /** Shown on a collapsed template so unsaved work cannot hide behind it. */
    unsaved: 'לא נשמר',

    saved: 'ההגדרות נשמרו',
    saveFailed: 'השמירה נכשלה',

    /** The invitation backdrop image gallery (PRD §6.16). Uploading adds a new
        gallery entry and activates it immediately; past uploads are never
        deleted by an upload, only by an explicit action here. */
    image: {
      title: 'תמונת רקע להזמנה',
      hint: 'התמונה שממלאת את המסך כשהמוזמן פותח את הקישור שלו. JPEG, PNG או WebP, עד 2MB. אפשר להעלות כמה תמונות ולבחור ביניהן.',
      he: 'תמונה בעברית',
      ru: 'תמונה ברוסית',
      ruHint: 'השאירו ריק כדי להציג למוזמנים דוברי רוסית את התמונה העברית.',
      choose: 'העלאת תמונה חדשה',
      uploading: 'מעלה…',
      uploaded: 'התמונה עודכנה',
      failed: 'ההעלאה נכשלה',
      active: 'פעילה',
      selected: 'התמונה הפעילה עודכנה',
      selectFailed: 'הבחירה נכשלה',
      confirmDelete: 'למחוק את התמונה הזו לצמיתות?',
      deleteFailed: 'המחיקה נכשלה',
      empty: 'עדיין לא הועלו תמונות',
    },
  },

  status: {
    added: 'נוסף',
    pending: 'הוזמן',
    opened: 'נפתח',
    submitted: 'אישר',
    edited: 'עודכן',
  },

  /** Admin labels for invites.language. The guest never sees these. */
  language: {
    label: 'שפה',
    he: 'עברית',
    ru: 'רוסית',
    /** Shown on a row only when it is NOT Hebrew, so Russian households stand out. */
    badge: { he: '', ru: 'RU' },
  },

  side: {
    bride: 'צד הכלה',
    groom: 'צד החתן',
    shared: 'משותף',
  },

  relation: {
    family: 'משפחה',
    friend: 'חברים',
    work: 'עבודה',
    invited_by_family: 'הוזמן ע״י המשפחה',
  },

  guests: {
    people: (count: number) => (count === 1 ? 'אורח אחד' : `${count} אורחים`),
    adults: 'מבוגרים',
    kids: 'ילדים',
    placeholder: 'אורח לא מזוהה',
    needsPhoneCall: 'צריך טלפון',
    declined: 'לא מגיע',
    noAnswer: 'אין תשובה',

    /** Matches AttendanceSummary in lib/headcount.ts. */
    summary: {
      noPeople: 'אין אנשים בהזמנה',
      awaiting: (invited: number) => `${invited} מוזמנים · טרם ענו`,
      declined: (invited: number) => `${invited} מוזמנים · לא מגיעים`,
      coming: (coming: number, invited: number) =>
        coming === invited ? `${coming} מגיעים` : `${coming} מגיעים מתוך ${invited}`,
    },
  },

  row: {
    edit: 'עריכה',
    delete: 'מחיקה',
    confirmDelete: (name: string) =>
      `למחוק את "${name}"? כל האנשים בהזמנה וכל היסטוריית התשובות יימחקו לצמיתות.`,
    deleted: 'ההזמנה נמחקה',
    saved: 'נשמר',
    deleteFailed: 'המחיקה נכשלה',
    saveFailed: 'השמירה נכשלה',
    addPerson: 'הוספת אדם',
    removePerson: 'הסרת אדם',
    renamePlaceholder: 'מי זה?',
    attending: 'מגיע',
    notAttending: 'לא מגיע',
  },

  inviteForm: {
    addInvite: 'הוספת מוזמן',
    title: 'מוזמן חדש',
    name: 'שם ההזמנה',
    nameHint: 'איך לפנות אליהם בהודעה — למשל "אבא" או "משפחת כהן"',
    phone: 'טלפון',
    phoneHint: 'אפשר לכתוב כרגיל: 0549546899. הקידומת +972 תתווסף אוטומטית.',
    side: 'צד',
    relation: 'קשר',
    notSet: 'לא נבחר',
    people: 'אנשים בהזמנה',
    peopleHint: 'רק אתם מזינים שמות. האורחים מסמנים מי מגיע ויכולים להוסיף אורח ללא שם.',
    personName: 'שם',
    adult: 'מבוגר',
    child: 'ילד',
    addPerson: 'הוספת אדם',
    removePerson: 'הסרה',
    nameRequired: 'חובה להזין שם להזמנה',
    duplicatePhone: (names: string[]) => `מספר הטלפון הזה מופיע גם אצל: ${names.join(', ')}`,
    created: 'המוזמן נוסף',
    failed: 'ההוספה נכשלה',
  },

  /** The dashboard bar (PRD §6.11). */
  stats: {
    records: 'רשומות',
    invited: 'מוזמנים',
    awaiting: 'ממתין לתשובה',
    coming: 'מגיעים',
    notComing: 'לא מגיעים',
    /** The small line under a tile: the same figure counted in invitations. */
    invites: (n: number) => (n === 1 ? 'הזמנה אחת' : `${n} הזמנות`),

    detailsTitle: 'פירוט המגיעים',
    adults: 'מבוגרים',
    kids: 'ילדים',
    /** Guest-added "+1"s — already inside מגיעים, shown apart. */
    extras: 'לא מהרשימה',
    extrasHint: 'אורחים שהמוזמנים הוסיפו בעצמם',
    noneComing: 'עדיין אין מי שאישר הגעה',
  },

  /** Spreadsheet template, import and export (PRD §6.7). */
  importer: {
    title: 'ייבוא מקובץ',
    downloadTemplate: 'הורדת תבנית ריקה',
    downloadTemplateHint:
      'הורידו את הקובץ, מלאו אותו, והעלו אותו חזרה. העמודות צד, קשר ושפה הן רשימות לבחירה. טלפונים אפשר לכתוב כרגיל (0549546899) — הקידומת +972 תתווסף אוטומטית.',
    chooseFile: 'בחירת קובץ',
    checking: 'בודק…',
    importing: 'מייבא…',
    /** Nothing is written until this is pressed. */
    confirm: (count: number) => `ייבוא ${count} הזמנות`,
    cancel: 'ביטול',
    export: 'ייצוא הרשימה',

    ready: (invites: number, people: number) => `${invites} הזמנות · ${people} אנשים`,
    warnings: (n: number) => `${n} אזהרות — ייובאו בכל זאת`,
    errors: (n: number) => `${n} שורות לא ייובאו`,
    nothingReady: 'אף שורה לא עברה את הבדיקה',
    rowLabel: (row: number) => `שורה ${row}`,
    imported: (invites: number, people: number) =>
      `יובאו ${invites} הזמנות ו-${people} אנשים`,
    failed: 'הייבוא נכשל',
    /** Said plainly: the preview writes nothing. */
    previewOnly: 'עדיין לא נשמר כלום. בדקו את הרשימה ואשרו.',
  },

  /**
   * First-invitation coordination (PRD §6.21) — dividing the list between the
   * two of you before the first round goes out.
   *
   * Worded as a plan, not as a send: `נשלחה` is the tick, while the wa.me
   * button's own confirmation stays `נשלח?`. Nothing here reports what the app
   * did — it records what the two of you agreed and then did by hand.
   */
  firstInvite: {
    /** The toolbar toggle that shows or hides the two controls on every row. */
    toggle: 'שליחה ראשונה',
    toggleHint: 'הצגת סימון ובחירת שולח בכל שורה',
    sent: 'נשלחה',
    sender: 'שולח',
    /** The dropdown's empty option: undecided, not "nobody". */
    notSet: 'לא נקבע',
    saveFailed: 'השמירה נכשלה',
  },

  /** Multi-select delete (PRD §6.6). */
  bulk: {
    selectAllShown: (n: number) => `בחירת הכל המוצג (${n})`,
    clearSelection: 'ניקוי הבחירה',
    selected: (n: number) => `${n} נבחרו`,
    delete: (n: number) => `מחיקת ${n} הזמנות`,
    /** Counts PEOPLE, not rows — the row count understates what dies. */
    confirm: (invites: number, people: number) =>
      `למחוק ${invites} הזמנות? יימחקו גם ${people} אנשים וכל היסטוריית התשובות שלהם. לצמיתות.`,
    deleted: (n: number) => `${n} הזמנות נמחקו`,
    deleteFailed: 'המחיקה נכשלה',
  },

  /**
   * Expenses and income (PRD §6.22).
   *
   * Two figures per per-guest line, worded as PLANNING vs CONFIRMED rather
   * than by which count produced them — "לפי מוזמנים" would read as a filter,
   * and what the reader needs to know is which number they can rely on.
   */
  budget: {
    title: 'הוצאות והכנסות',
    hint: 'שורה לכל הוצאה או הכנסה. מחיר לפי אורח מוכפל במספר האנשים אוטומטית.',

    /** Column headers. */
    name: 'שם',
    kind: 'סוג',
    pricing: 'חיוב',
    amount: 'מחיר',
    paidInAdvance: 'שולם מראש',
    fullPrice: 'מחיר מלא',
    toPay: 'נותר לשלם',

    kinds: {
      expense: 'הוצאה',
      income: 'הכנסה',
    },
    pricings: {
      flat: 'לפי שירות',
      per_person: 'לפי אורח',
    },
    /** On the amount cell of a per-guest row, so the unit is never in doubt. */
    perPersonUnit: 'לאדם',

    /** The small figure under a per-guest line: what the RSVPs so far commit to. */
    confirmedNote: (formatted: string) => `${formatted} מאושר`,
    /** Nobody has answered yet, so the confirmed column is honestly nothing. */
    noneConfirmed: 'אין עדיין אישורים',

    tiles: {
      expenses: 'סה״כ הוצאות',
      income: 'סה״כ הכנסות',
      balance: 'מאזן',
      toPay: 'נותר לשלם',
    },
    /** Under each tile: the same total on the confirmed basis. */
    confirmedTile: (formatted: string) => `${formatted} לפי אישורים`,
    /** Spelled out, because "מאזן" alone doesn't say which way is good. */
    balanceHint: 'הכנסות פחות הוצאות',

    addRow: 'הוספת שורה',
    adding: 'מוסיף…',
    namePlaceholder: 'למשל: קייטרינג',
    /** The add row refuses rather than saving something unusable. */
    nameRequired: 'צריך שם',
    amountRequired: 'צריך מחיר',
    invalidAmount: 'מחיר לא תקין',

    delete: 'מחיקה',
    confirmDelete: (name: string) => `למחוק את "${name}"?`,
    deleted: 'השורה נמחקה',
    saveFailed: 'השמירה נכשלה',
    deleteFailed: 'המחיקה נכשלה',

    empty: 'אין עדיין שורות בתקציב',
    emptyHint: 'הוסיפו הוצאה או הכנסה ראשונה למטה.',

    /** Per-guest lines multiply by the invited count until answers arrive. */
    basis: (invited: number, attending: number) =>
      `מחיר לפי אורח מוכפל ב-${invited} מוזמנים (${attending} אישרו עד כה).`,
  },

  toolbar: {
    searchPlaceholder: 'חיפוש לפי שם או טלפון',
    allStatuses: 'כל הסטטוסים',
    allRelations: 'כל הקשרים',
    allSides: 'כל הצדדים',
    /** Empty means both — there is no bilingual household (lib/invite-filters.ts). */
    allLanguages: 'כל השפות',
    onlyNeedsCall: 'רק מי שצריך טלפון',
    /**
     * Distinct from onlyNeedsCall above, and easy to confuse: that one is
     * "has a number, isn't answering"; this one is "we have no number at all".
     */
    onlyMissingPhone: 'רק בלי טלפון',
    sortBy: 'מיון',
    sort: {
      name: 'שם',
      relation: 'קשר',
      status: 'סטטוס',
      headcount: 'מספר אורחים',
      lastContacted: 'פנייה אחרונה',
    },
    showing: (shown: number, total: number) =>
      shown === total ? `${total} הזמנות` : `${shown} מתוך ${total}`,
  },

  actions: {
    copyLink: 'העתקת קישור',
    linkCopied: 'הקישור הועתק',
    copyFailed: 'ההעתקה נכשלה',
    sendWhatsApp: 'שליחה ב-WhatsApp',
    noPhone: 'אין מספר טלפון',
    didYouSend: 'נשלח?',
    yesSent: 'כן',
    notSent: 'לא',
    recorded: 'נרשם כנשלח',
    notRecorded: 'לא נרשם',
    contactedCount: (n: number) => `נשלח ${n} פעמים`,
    neverContacted: 'טרם נשלח',
    lastContacted: (when: string) => `פנייה אחרונה: ${when}`,
  },

  emptyStates: {
    noInvites: 'עדיין אין מוזמנים',
    noInvitesHint: 'הוסיפו מוזמן ראשון כדי להתחיל',
    noResults: 'לא נמצאו תוצאות',
    noResultsHint: 'נסו לחפש משהו אחר',
  },
} as const

/* ===========================================================================
 * The guest side (PRD §6.7b) — Hebrew and Russian.
 *
 * Only the ADMIN uses `strings` above; it stays Hebrew because one person uses
 * it. Everything a GUEST reads lives below and exists in both languages,
 * chosen per household by `invites.language`.
 *
 * What is NOT translated: the guest's own data. For a Russian household Dmitri
 * types `Слава` as the invitation name and `Слава, Настя` as the people, and
 * those are stored and shown exactly as typed. The greeting is UI text with the
 * stored name dropped into it.
 * ========================================================================= */

import type { Language } from '@/lib/types'

/**
 * Russian has three plural forms where Hebrew has two, and the rule is not
 * "one vs many": 1 гость, 2–4 гостя, 5–20 гостей, then 21 гость again. Getting
 * this wrong is the kind of mistake a native speaker notices immediately and a
 * translation table cannot express, so it is a function.
 */
function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const he = {
  siteName: 'אישורי הגעה',
  cancel: 'ביטול',

  rsvp: {
    greeting: (name: string) => `שלום ${name}`,
    intro: 'נשמח לדעת אם תגיעו',
    yes: 'מגיעים',
    no: 'לא נגיע',

    whoIsComing: 'מי מגיע?',
    whoIsComingHint: 'סמנו את מי שמגיע',
    extras: 'אורחים נוספים',
    extrasHint: 'אפשר להוסיף אורחים שלא מופיעים ברשימה',
    extraAdults: 'מבוגרים נוספים',
    extraKids: 'ילדים נוספים',
    fewer: 'פחות',
    more: 'עוד',

    submit: 'שליחת התשובה',
    submitting: 'שולח…',
    chooseAnswer: 'בחרו אם אתם מגיעים',
    pickSomeone: 'סמנו לפחות אדם אחד, או ענו שאינכם מגיעים',
    failed: 'השליחה נכשלה. נסו שוב.',

    confirmation: {
      titleAttending: 'תודה! נרשמתם',
      titleDeclined: 'תודה שעדכנתם',
      declined: 'רשמנו שלא תגיעו. חבל, נתגעגע!',
      attending: 'מגיע',
      extraGuest: 'אורח נוסף',
      total: (count: number) => `סה״כ ${count === 1 ? 'אורח אחד' : `${count} אורחים`}`,
      breakdown: (adults: number, kids: number) =>
        kids === 0 ? '' : `${adults} מבוגרים · ${kids} ילדים`,
      changeAnswer: 'שינוי התשובה',
    },

    closed: {
      title: 'אישורי ההגעה נסגרו',
      /** The number renders beside this as its own LTR element, not inline. */
      callInstead: 'לשינויים אפשר להתקשר אלינו:',
      callInsteadNoPhone: 'לשינויים אפשר ליצור איתנו קשר.',
      yourAnswer: 'התשובה שלכם',
      noAnswer: 'לא נרשמה תשובה',
    },

    landing: {
      /** Deliberately says nothing about tokens: an unknown link lands here too. */
      invitation: 'מתחתנים!',
      seeYou: 'נשמח לראותכם',
    },

    /** The bottom action bar. Buttons without data to point at don't render. */
    nav: {
      rsvp: 'אישור הגעה',
      yourAnswer: 'התשובה שלכם',
      navigate: 'ניווט לאולם',
      addToCalendar: 'הוספה ליומן',
      closeSheet: 'סגירה',
    },
  },

  /**
   * The WhatsApp link preview (PRD §6.15). These are the bold and grey lines
   * printed above the message text, not page copy — WhatsApp always prints them,
   * so the choice is what they say, never whether they appear.
   */
  og: {
    imageAlt: 'ההזמנה לחתונה',
    /** Shown when wedding_config still has no couple names. */
    untitled: 'אתם מוזמנים',
    /** date · venue, either half omitted when it isn't set yet. */
    details: (when: string, venue: string) => [when, venue].filter(Boolean).join(' · '),
  },
}

/**
 * Reviewed and approved by Dmitri, 2026-08-02.
 *
 * Typed as `typeof he`, so a missing or misspelled key is a compile error
 * rather than a guest seeing `undefined`.
 *
 * Two choices worth not re-litigating:
 *   - `Здравствуйте` for the greeting. One greeting serves everyone from a
 *     grandmother to a close friend; it is safe across that whole range, and
 *     Hebrew's `שלום` is neutral-formal to a similar degree.
 *   - `Мы женимся!` on the landing page. Grammatically `жениться` leans
 *     masculine, but it is idiomatic in Russian wedding invitations. A
 *     deliberate choice, not an oversight.
 */
const ru: typeof he = {
  siteName: 'Подтверждение участия',
  cancel: 'Отмена',

  rsvp: {
    // Register: one greeting serves a grandmother and a close friend alike.
    // "Здравствуйте" is safe across that whole range; "Привет" is warmer but
    // casual. Hebrew's "שלום" is neutral-formal to a similar degree.
    greeting: (name: string) => `Здравствуйте, ${name}`,
    intro: 'Будем рады узнать, придёте ли вы',
    yes: 'Придём',
    no: 'Не придём',

    whoIsComing: 'Кто придёт?',
    whoIsComingHint: 'Отметьте тех, кто придёт',
    extras: 'Дополнительные гости',
    extrasHint: 'Можно добавить гостей, которых нет в списке',
    // The heading above already says "дополнительные"; repeating it on each
    // label reads clumsy in Russian.
    extraAdults: 'Взрослые',
    extraKids: 'Дети',
    fewer: 'Меньше',
    more: 'Больше',

    submit: 'Отправить ответ',
    submitting: 'Отправляем…',
    chooseAnswer: 'Выберите, придёте ли вы',
    pickSomeone: 'Отметьте хотя бы одного гостя или ответьте, что не придёте',
    failed: 'Не удалось отправить. Попробуйте ещё раз.',

    confirmation: {
      titleAttending: 'Спасибо! Мы вас записали',
      titleDeclined: 'Спасибо, что сообщили',
      declined: 'Мы записали, что вы не придёте. Жаль, будем скучать!',
      attending: 'Придёт',
      extraGuest: 'Дополнительный гость',
      // 1 гость · 2 гостя · 5 гостей
      total: (count: number) =>
        `Всего ${count} ${ruPlural(count, 'гость', 'гостя', 'гостей')}`,
      // 1 взрослый · 2 взрослых, and 1 ребёнок · 2 ребёнка · 5 детей
      breakdown: (adults: number, kids: number) =>
        kids === 0
          ? ''
          : `${adults} ${ruPlural(adults, 'взрослый', 'взрослых', 'взрослых')} · ` +
            `${kids} ${ruPlural(kids, 'ребёнок', 'ребёнка', 'детей')}`,
      changeAnswer: 'Изменить ответ',
    },

    closed: {
      title: 'Подтверждение участия закрыто',
      callInstead: 'Для изменений позвоните нам:',
      callInsteadNoPhone: 'Для изменений свяжитесь с нами.',
      yourAnswer: 'Ваш ответ',
      noAnswer: 'Ответ не получен',
    },

    landing: {
      invitation: 'Мы женимся!',
      seeYou: 'Будем рады видеть вас',
    },

    nav: {
      rsvp: 'Подтвердить участие',
      yourAnswer: 'Ваш ответ',
      navigate: 'Как добраться',
      addToCalendar: 'Добавить в календарь',
      closeSheet: 'Закрыть',
    },
  },

  og: {
    imageAlt: 'Приглашение на свадьбу',
    untitled: 'Вы приглашены',
    // Punctuation only — nothing to translate.
    details: (when: string, venue: string) => [when, venue].filter(Boolean).join(' · '),
  },
}

const guestSets: Record<Language, typeof he> = { he, ru }

/** Every guest-facing string, in that household's language. */
export function guestText(lang: Language): typeof he {
  return guestSets[lang]
}

export type GuestText = typeof he

/**
 * Hebrew is right-to-left, Russian is left-to-right. Applied to a wrapper
 * around the guest subtree, never to <html>: the root layout cannot see
 * `searchParams`, so it cannot know the token, so it cannot know the language.
 */
export function dirFor(lang: Language): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr'
}

/** For Intl date formatting. The timezone stays Asia/Jerusalem regardless — it
 *  is the wedding's timezone, not the reader's. */
export function localeFor(lang: Language): string {
  return lang === 'he' ? 'he-IL' : 'ru-RU'
}
