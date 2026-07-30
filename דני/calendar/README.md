# שכבת חיבור יומן (Google Calendar) לדני ויהודה

קוד Node (בלי תלויות חיצוניות) שמאפשר לדני וליהודה להציע שעות פנויות ולקבוע פגישה
אמיתית ביומן — לפי תחום (תכשיטים / לימודים+סדנאות), לא לפי שם אדם. בנוי במקביל
לשכבת `דני/crm/`. עד שפרטי החשבון מגיעים, עובד ב-`--dry-run`.

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env` (דרך `../lib/env.mjs`), חושף `getConfig(domain)` ו-`assertConfigured(config)`. |
| `availability.mjs` | לוגיקה טהורה: `computeAvailableSlots()` (שעות מוצעות) ו-`isSlotAvailable()` (בדיקת מרוץ). |
| `google-auth.mjs` | `signJwt()` + `getAccessToken()` — אימות מול Google OAuth2 עם Service Account, בלי SDK. |
| `client.mjs` | `listEvents()` / `createEvent()` — קריאות REST גולמיות ל-Google Calendar API v3. |
| `check-availability.mjs` | CLI: מחזיר 2-3 שעות פנויות. זו הנקודה שראובן מריץ כשדני/יהודה מבקשים הצעת שעות. |
| `book-meeting.mjs` | CLI: קובע את השעה שנבחרה ביומן, ומעדכן את קובץ הליד. |

## מוסכמת "פניות לקוחות"

בכל אחד משני היומנים, הנציג/ה הרלוונטי/ת יוצר/ת **אירוע חוזר** בכותרת קבועה
(ברירת מחדל: **"פניות לקוחות"**, ניתן לשינוי ב-`CALENDAR_BLOCK_TITLE`). זהו החלון
שבו הוא/היא פנוי/ה לשיחות שנקבעות דרך הסוכנים. הסקריפטים מציעים שעות **רק** בתוך
הבלוקים האלה — כל דבר מחוץ להם לא מוצע, גם אם היומן ריק שם.

## הקמה חד-פעמית (Google Cloud)

1. ב-Google Cloud Console: צור פרויקט (או השתמש בקיים) → הפעל את **Google Calendar
   API** → צור **Service Account** → צור לו מפתח JSON והורד אותו.
2. שמור את קובץ ה-JSON שהורדת בנתיב `דני/calendar/service-account.json`
   (כבר מוחרג מגיט ב-`.gitignore`).
3. ב-Google Calendar: שתף את **יומן התכשיטים** ואת **יומן הלימודים+סדנאות** עם
   כתובת המייל של ה-Service Account (`client_email` בתוך קובץ ה-JSON), בהרשאת
   **"ביצוע שינויים באירועים"**.
4. בכל אחד משני היומנים, צור אירוע חוזר בכותרת **"פניות לקוחות"** בטווחי הזמן
   שהנציג/ה פנוי/ה בהם.
5. מלא ב-`.env`: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`, `JEWELRY_CALENDAR_ID`,
   `STUDIES_CALENDAR_ID` (ראה `.env.example`).

## בדיקה עכשיו (בלי פרטי גישה) — `--dry-run`

```bash
node "דני/calendar/check-availability.mjs" jewelry --dry-run
node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/2026-06-12-גאבו.md" "2026-08-03T11:00:00+03:00" --dry-run
```

`--dry-run` מדפיס את מה שהיה נשלח/נוצר בלי לפנות ל-API — חוץ מעדכון קובץ הליד,
שקורה גם ב-dry-run (מסומן בבירור בטקסט "DRY-RUN — לא נוצר אירוע אמיתי ביומן").

## הפעלה אמיתית (כשה-Service Account מוכן)

1. ודא ששלבי ההקמה למעלה בוצעו (שיתוף היומנים + `.env` מלא).
2. הרץ בלי `--dry-run`:
   `node "דני/calendar/check-availability.mjs" jewelry`
   ואז, אחרי שהלקוח בחר שעה:
   `node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/<ליד>.md" "<שעה שנבחרה>"`
3. ודא שהאירוע נוצר ביומן האמיתי, ושקובץ הליד עודכן.
