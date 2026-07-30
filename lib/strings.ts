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
    noPeople: 'אין אורחים',
    adults: 'מבוגרים',
    kids: 'ילדים',
    placeholder: 'אורח לא מזוהה',
    needsPhoneCall: 'צריך טלפון',
    declined: 'לא מגיע',
    noAnswer: 'אין תשובה',
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

  emptyStates: {
    noInvites: 'עדיין אין מוזמנים',
    noInvitesHint: 'הוסיפו מוזמן ראשון כדי להתחיל',
    noResults: 'לא נמצאו תוצאות',
    noResultsHint: 'נסו לחפש משהו אחר',
  },
} as const
