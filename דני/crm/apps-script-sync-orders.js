// apps-script-sync-orders.js — סקריפט Google Apps Script (לא Node!) לסנכרון שורות
// מגיליון "הזמנות לשנת 2026" (בחוברת "תכשיטים-הזמנות/תיקונים 2019-2026") אל
// fixdigital, דרך אותו endpoint שכבר בשימוש ב-דני/crm/client.mjs (lead/addApi).
//
// ⚠️ קובץ זה לא רץ מקומית ב-Node — הוא מיועד להדבקה בעורך ה-Apps Script של
// הגיליון עצמו (Extensions → Apps Script). ראה הוראות התקנה בתחתית הקובץ.
//
// מיפוי עמודות (שורת כותרות = שורה 8, לפי צילום המסך שסופק 28.7.2026):
//   A=מספר הזמנה  B=מספר הזמנה חודשי  C=תאריך הזמנה  D=שם לקוח  E=טלפון
//   F=סכום הזמנה  G=פירוט תשלום  H=שולם  I=פירוט ההזמנה  J=יתרת תשלום
//   K=עודכן בפיקס בתאריך  L=הערות על התהליך (שלב ייצור)  M=קבצים  N=נשלח משוב
//
// ⛔ TODO (חסום, ממתין לתשובת פיקס — ראה דני/מכתב-בקשת-API.md, עדכון 4):
//   מיפוי עמודה L (הערות על התהליך: יציקה/הדפסה/שיבוץ/ציפוי...) לקוד/שם סטטוס
//   אמיתי ב-UpdateLeadStatusOrAmount. עד אז השדה נשלח כטקסט חופשי בתוך
//   ORDER_DETAILS בלבד, ולא כעדכון סטטוס אמיתי.

const SHEET_NAME = 'הזמנות לשנת 2026';
const HEADER_ROW = 8;

const COL = {
  ORDER_ID: 1,          // A
  ORDER_DATE: 3,        // C
  NAME: 4,              // D
  PHONE: 5,             // E
  AMOUNT: 6,             // F
  PAYMENT_DETAILS: 7,   // G — "פירוט תשלום"
  DETAILS: 9,            // I
  UPDATED_AT: 11,        // K — "עודכן בפיקס בתאריך"
  STATUS_NOTES: 12,     // L — "הערות על התהליך"
  DEBUG: 15,             // O — תגובת פיקס (זמני, לצורך בדיקה בלבד)
};

// העמודות שעריכה בהן מפעילה שליחה ל-fixdigital.
const TRACKED_COLUMNS = [COL.ORDER_ID, COL.NAME, COL.PHONE, COL.AMOUNT, COL.PAYMENT_DETAILS, COL.DETAILS, COL.STATUS_NOTES];

// --- הפונקציה שמחוברת ל-Trigger (ראה הוראות התקנה) ---
function handleOrderEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  if (row <= HEADER_ROW) return;

  const editedCol = e.range.getColumn();
  if (TRACKED_COLUMNS.indexOf(editedCol) === -1) return;

  const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const phone = rowValues[COL.PHONE - 1];
  if (!phone) return; // אין עדיין טלפון בשורה — אין למי לשייך את העדכון

  const details = String(rowValues[COL.DETAILS - 1] || '');
  const paymentDetails = String(rowValues[COL.PAYMENT_DETAILS - 1] || '');
  const statusNote = String(rowValues[COL.STATUS_NOTES - 1] || '');
  // עד שיגיע מיפוי סטטוס אמיתי מפיקס (עדכון 4), מצרפים את פירוט התשלום
  // ואת הערת התהליך כטקסט בתוך ORDER_DETAILS.
  const detailParts = [details];
  if (paymentDetails) detailParts.push(`תשלום: ${paymentDetails}`);
  if (statusNote) detailParts.push(`שלב: ${statusNote}`);
  const fullDetails = detailParts.join(' | ');

  const fields = {
    name: rowValues[COL.NAME - 1] || '',
    phone: String(phone),
    ORDER_ID: rowValues[COL.ORDER_ID - 1] || '',
    ORDER_AMOUNT: rowValues[COL.AMOUNT - 1] || '',
    ORDER_DETAILS: fullDetails,
  };

  try {
    const result = pushToFixDigital(fields);
    sheet.getRange(row, COL.UPDATED_AT).setValue(new Date());
    sheet.getRange(row, COL.DEBUG).setValue(result.code + ': ' + result.text);
  } catch (err) {
    sheet.getRange(row, COL.DEBUG).setValue('שגיאה: ' + err);
  }
}

// בונה את ה-URL ושולח POST ל-fixdigital, באותו פורמט כמו דני/crm/client.mjs.
// מחזירה { code, text } כדי שאפשר יהיה לכתוב את התוצאה לתא בגיליון (לבדיקה).
function pushToFixDigital(fields) {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('CRM_API_BASE') || 'https://www.fixdigital.co.il/api/v1.2';
  const path = props.getProperty('CRM_LEAD_PATH') || '/lead/addApi';

  const params = Object.assign(
    {
      assetId: props.getProperty('CRM_ASSET_ID'),
      assetTypeId: props.getProperty('CRM_ASSET_TYPE_ID'),
      companyId: props.getProperty('CRM_COMPANY_ID'),
      FORMURL: props.getProperty('CRM_FORM_URL') || 'orders-sheet-sync',
      URLREFER: props.getProperty('CRM_URL_REFER') || 'sheet',
    },
    fields
  );

  const query = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');

  const url = base.replace(/\/$/, '') + path + '?' + query;
  const res = UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  const result = { code: res.getResponseCode(), text: res.getContentText() };
  Logger.log('fixdigital response (' + result.code + '): ' + result.text);
  return result;
}

/*
=== הוראות התקנה (חד-פעמי, ידני — אין לי גישה לחשבון ה-Google שלך) ===

1. פתח את הגיליון → תפריט Extensions (תוספים) → Apps Script.
2. מחק כל תוכן קיים בעורך, והדבק את כל הקוד מעל (לא כולל הערת ה-block הזו).
3. בעורך: אייקון השעון (Triggers) בסרגל הצד השמאלי → "Add Trigger":
   - Function: handleOrderEdit
   - Event source: From spreadsheet
   - Event type: On edit
   - Save — תתבקש לאשר הרשאות (Authorize) בפעם הראשונה, אשר.
4. Project Settings (גלגל השיניים) → Script Properties → Add script property,
   ומלא את אותם ערכים שכבר קיימים ב-.env של הפרויקט (CRM_ASSET_ID /
   CRM_ASSET_TYPE_ID / CRM_COMPANY_ID של דני — אלא אם פיקס ממליצים על נכס/
   תהליך נפרד עבור הזמנות/ייצור, לוודא איתם).
5. בדיקה: ערוך תא בעמודה F (סכום הזמנה) בשורה קיימת בגיליון "הזמנות לשנת 2026",
   וודא ב-Apps Script → Executions שהריצה הצליחה (או ב-Logger אם מריצים ידנית).

✅ מותקן ונבדק בפועל (28.7.2026) — עריכת הזמנה קיימת בגיליון עדכנה בהצלחה
את כרטיס הלקוח המתאים בפיקס, ללא כפילות.
*/
