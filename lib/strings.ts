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
    venueHint: 'שם האולם והכתובת — לפי זה עובד כפתור הניווט.',
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
  },

  status: {
    added: 'נוסף',
    pending: 'הוזמן',
    opened: 'נפתח',
    submitted: 'אישר',
    edited: 'עודכן',
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
    phoneHint: 'פורמט בינלאומי, למשל +972501234567',
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

  toolbar: {
    searchPlaceholder: 'חיפוש לפי שם או טלפון',
    allStatuses: 'כל הסטטוסים',
    onlyNeedsCall: 'רק מי שצריך טלפון',
    sortBy: 'מיון',
    sort: {
      name: 'שם',
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

  /** The guest-facing side (PRD §6.1–§6.4). The only screens a guest ever sees. */
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
   *
   * Deliberately impersonal: the message template under the card already greets
   * the guest by name, and the same tags are served to the public landing page.
   */
  og: {
    imageAlt: 'ההזמנה לחתונה',
    /** Shown when wedding_config still has no couple names. */
    untitled: 'אתם מוזמנים',
    /** date · venue, either half omitted when it isn't set yet. */
    details: (when: string, venue: string) => [when, venue].filter(Boolean).join(' · '),
  },

  emptyStates: {
    noInvites: 'עדיין אין מוזמנים',
    noInvitesHint: 'הוסיפו מוזמן ראשון כדי להתחיל',
    noResults: 'לא נמצאו תוצאות',
    noResultsHint: 'נסו לחפש משהו אחר',
  },
} as const
