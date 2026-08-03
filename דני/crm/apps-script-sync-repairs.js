// apps-script-sync-repairs.js — תוספת ל-Apps Script הקיים על הגיליון (אותו
// פרויקט כמו apps-script-sync-orders.js!) לסנכרון גיליון "תיקונים לשנת 2026"
// אל fixdigital, דרך אותו lead/addApi ואותה pushToFixDigital() שכבר קיימת שם.
//
// ⚠️ לא להדביק בפרויקט Apps Script נפרד — להוסיף בסוף אותו קובץ קוד שבו
// כבר נמצאים handleOrderEdit / pushToFixDigital / Script Properties.
//
// מיפוי עמודות (שורת כותרות = שורה 4, לפי צילום המסך שסופק 28.7.2026):
//   A=תאריך בקשת תיקון  B=שם מלא לקוח  C=טלפון  D=מספר מעטפה  E=פריט
//   F=לתשלום  G=יציקה  H=שיבוץ  I=חריטה  J=ציפוי  K=הודעה ללקוח שמוכן
//   L=שולם  M=נאסף?  N=סטטוס תיקון  O=הערות
//
// אין ל-fixdigital קודי סטטוס לשלבי ייצור (אושר ע"י יבגני, 28.7.2026 —
// UpdateLeadStatusOrAmount תומך רק בסטטוס תהליך מכירה: טיפול/פגישה/עסקה
// נסגרה/לא רלוונטי, ודורש leadID לא טלפון) — לכן שלבי הייצור וההערות
// מוצמדים כטקסט חופשי בתוך ORDER_DETAILS, בדיוק כמו בהזמנות. כל עדכון פותח
// רשומת ליד/הזמנה נוספת תחת אותו לקוח (נבדק ואושר כהתנהגות רצויה — יומן
// היסטוריה, לא דריסה).

const REPAIR_SHEET_NAME = 'תיקונים לשנת 2026';
const REPAIR_HEADER_ROW = 4;

const RCOL = {
  NAME: 2,          // B
  PHONE: 3,         // C
  ENVELOPE_ID: 4,   // D — מספר מעטפה
  ITEM: 5,          // E — פריט
  AMOUNT: 6,        // F — לתשלום
  CASTING: 7,       // G — יציקה
  SETTING: 8,       // H — שיבוץ
  ENGRAVING: 9,     // I — חריטה
  PLATING: 10,      // J — ציפוי
  PAID: 12,         // L — "שולם" (V/ריק)
  STATUS: 14,       // N — סטטוס תיקון
  NOTES: 15,        // O — הערות
  DEBUG: 16,        // P — תגובת פיקס (זמני, לצורך בדיקה בלבד)
};

const REPAIR_TRACKED_COLUMNS = [
  RCOL.NAME, RCOL.PHONE, RCOL.ENVELOPE_ID, RCOL.ITEM, RCOL.AMOUNT,
  RCOL.CASTING, RCOL.SETTING, RCOL.ENGRAVING, RCOL.PLATING, RCOL.PAID, RCOL.STATUS, RCOL.NOTES,
];

// --- מחוברת ל-Trigger נפרד (ראה הוראות התקנה) ---
function handleRepairEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  // .replace(...) מנקה תווי כיווניות נסתרים (RTL/LTR marks) שגוגל שיטס לפעמים
  // מוסיף ליד מספרים בתוך שם גיליון בעברית, כדי שההשוואה לא תיכשל בגללם.
  if (sheet.getName().replace(/[‎‏‪-‮]/g, '').trim() !== REPAIR_SHEET_NAME.replace(/[‎‏‪-‮]/g, '').trim()) return;

  const row = e.range.getRow();
  if (row <= REPAIR_HEADER_ROW) return;

  const editedCol = e.range.getColumn();
  if (REPAIR_TRACKED_COLUMNS.indexOf(editedCol) === -1) return;

  const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const phone = rowValues[RCOL.PHONE - 1];
  if (!phone) return; // אין עדיין טלפון בשורה — אין למי לשייך את העדכון

  const stages = [
    ['יציקה', rowValues[RCOL.CASTING - 1]],
    ['שיבוץ', rowValues[RCOL.SETTING - 1]],
    ['חריטה', rowValues[RCOL.ENGRAVING - 1]],
    ['ציפוי', rowValues[RCOL.PLATING - 1]],
  ].filter(([, v]) => v).map(([label, v]) => `${label}: ${v}`).join(', ');

  const item = String(rowValues[RCOL.ITEM - 1] || '');
  const status = String(rowValues[RCOL.STATUS - 1] || '');
  const notes = String(rowValues[RCOL.NOTES - 1] || '');

  const fullDetails = [item, stages, status ? `סטטוס: ${status}` : '', notes]
    .filter(Boolean)
    .join(' | ');

  const fields = {
    name: rowValues[RCOL.NAME - 1] || '',
    phone: String(phone),
    ORDER_ID: rowValues[RCOL.ENVELOPE_ID - 1] || '',
    ORDER_AMOUNT: rowValues[RCOL.AMOUNT - 1] || '',
    ORDER_DETAILS: fullDetails,
  };

  const totalAmount = Number(rowValues[RCOL.AMOUNT - 1]) || 0;
  const isPaidChecked = String(rowValues[RCOL.PAID - 1] || '').trim() !== '';
  // אין בגיליון התיקונים עמודת "יתרת תשלום" נפרדת — לכן אין מושג "מקדמה" כאן,
  // רק שולם/לא שולם לפי הסימון בעמודה L.
  const amountPaid = isPaidChecked ? totalAmount : 0;
  const paymentStatus = isPaidChecked ? 'שולם' : 'לא שולם';

  try {
    // pushToFixDigital / updatePaymentStatus מוגדרות כבר ב-apps-script-sync-orders.js, באותו פרויקט
    const result = pushToFixDigital(fields);
    const payResult = updatePaymentStatus(phone, paymentStatus, amountPaid);
    sheet.getRange(row, RCOL.DEBUG).setValue(
      result.code + ': ' + result.text + ' || payment ' + payResult.code + ': ' + payResult.text
    );
  } catch (err) {
    sheet.getRange(row, RCOL.DEBUG).setValue('שגיאה: ' + err);
  }
}

/*
=== הוראות התקנה ===

1. חזור לעורך ה-Apps Script שכבר פתחת (אותו פרויקט!) — אל תיצור פרויקט חדש.
2. גלול לסוף הקוד הקיים, והדבק שם את כל הקוד מעל (מ-REPAIR_SHEET_NAME ועד
   סוף handleRepairEdit) — לא את הבלוק הזה של ההוראות.
3. שמור (Ctrl+S).
4. אייקון השעון (Triggers) → "הוספת טריגר" → בפעם הזו:
   - Function: handleRepairEdit
   - Event source: From spreadsheet
   - Event type: On edit
   - Save.
5. בדיקה: ערוך תא (למשל בעמודה F "לתשלום") בשורה קיימת בגיליון
   "תיקונים לשנת 2026", ותבדוק ב-Executions שהריצה הצליחה, ואז בממשק פיקס
   שהתיקון הופיע תחת הלקוח הנכון.

✅ מותקן ונבדק בפועל (30.7.2026) — עריכת תיקון קיים בגיליון עדכנה בהצלחה
את כרטיס הלקוח המתאים בפיקס (תגובה 200). דרש תיקון: שם הגיליון בפועל הכיל
תו כיווניות RTL/LTR נסתר, ולכן ההשוואה מנקה תווים כאלה לפני ההשוואה.
*/
