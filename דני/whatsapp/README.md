# שכבת חיבור WhatsApp לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**WhatsApp Business Platform
דרך 360dialog** (BSP — לא Meta ישירות, ולא דרך פיקס). ✅ **שליחה חיה ומאומתת
(14.7.2026)**, על מספר בדיקה זמני של Meta.

**רקע:** בהתחלה תוכנן מודל שבו פיקס (fixdigital) מנהל את מספר הוואטסאפ
ומעביר אלינו webhook (ראה `receive.mjs`). פיקס סירבו לתת גישת בוט למספר
שלהם, ולכן עברנו ל-**360dialog** — ספק (BSP) שנותן גישה ישירה ל-WhatsApp
Business Platform, עם payload זהה ל-Meta Cloud API אבל endpoint משלו
(`waba-v2.360dialog.io`) ואימות דרך header `D360-API-KEY` (לא
`Authorization: Bearer`).

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env`, חושף `config`, `apiUrl()`, `normalizeNumber()`, `assertConfigured()`. |
| `send.mjs` | `sendText(to, body)` ו-`sendImage(to, file\|url, caption)` (כולל העלאת מדיה מקומית). ✅ עובד. |
| `group.mjs` | `sendHandoff()` — שולח את הודעת הסיכום ליניב + סטודיו + לקוח. |
| `receive.mjs` | ⚠️ **מיושן** — נכתב למקלט webhook בפורמט **פיקס** (מודל שננטש). צריך להיכתב מחדש לפורמט ה-webhook של 360dialog/Meta Cloud API כשנקים אירוח ציבורי (ראה "מה נשאר" למטה). |

## משתני סביבה (ב-`.env` שבשורש — מוחרג מגיט)

```
WHATSAPP_BUSINESS_NUMBER=+972526935619   # ✅ כבר הוגדר (מספר עסקי סופי, לא זה שבשימוש כרגע)
YANIV_WHATSAPP=+972509900216             # ✅ כבר הוגדר
STUDIO_WHATSAPP=+972515010839            # ✅ כבר הוגדר
D360_API_KEY=                            # ✅ מולא — מ-360dialog Hub (Direct API Access)
D360_BASE_URL=https://waba-v2.360dialog.io  # ברירת מחדל
WHATSAPP_TEST_NUMBER=+15553852038        # מספר בדיקה זמני של Meta (עד שיהיה סים אמיתי)
WHATSAPP_VERIFY_TOKEN=dani-verify        # מחרוזת חופשית לאימות ה-webhook
```

את `D360_API_KEY` מקבלים מ-**360dialog Hub → הערוץ → Direct API Access →
Generate API key**.

## בדיקה עכשיו — `--dry-run` או שליחה חיה

```bash
node "דני/whatsapp/send.mjs" 0509900216 "שלום, כאן דני 🙂" --dry-run
node "דני/whatsapp/send.mjs" 0509900216 "שלום, כאן דני 🙂"              # ✅ שליחה אמיתית — נבדק ועובד
node "דני/whatsapp/send.mjs" --image 0509900216 "yuval/outputs/....png" "הדמיה"
node "דני/whatsapp/group.mjs" "🔔 ליד מוכן" --client 0501234567 --dry-run
```

`--dry-run` מדפיס את ה-payload שהיה נשלח, בלי לקרוא ל-API. מספר ישראלי מקומי
(0XX) מומר אוטומטית לבינלאומי (972XX). **הערה:** שליחה חיה למספר שלא פתח
שיחה איתנו קודם (בתוך חלון 24 שעות) דורשת תבנית מאושרת של Meta.

## מה נשאר לחיבור מלא (קבלת הודעות נכנסות)

1. **אירוח ציבורי** ל-`דני/server.mjs` (Railway מומלץ — ראה שיחה עם ראובן).
2. **כתיבה מחדש של `receive.mjs`** לפורמט ה-webhook של 360dialog/Meta Cloud
   API (JSON עם `entry[].changes[].value.messages[]` וכו') — הפורמט הנוכחי
   בקובץ הוא של פיקס ולא יעבוד עם 360dialog.
3. **רישום ה-webhook** בממשק 360dialog Hub (הערוץ → Direct API Access → Set
   webhook) לכתובת השרת הציבורי.
4. **מספר ייצור אמיתי** — להחליף את מספר הבדיקה הזמני של Meta במספר סים
   אמיתי (עד 5 ימי עסקים לאישור Meta לשם/תצוגה).

## ⚠️ מגבלת קבוצות

WhatsApp Business Platform **לא תומך ביצירת קבוצות** פרוגרמטית. לכן `sendHandoff()`
שולח את הודעת הסיכום ליניב, לסטודיו וללקוח **בנפרד**, ויניב פותח את הקבוצה ידנית.
אם בעתיד יחובר ספק לא-רשמי שתומך בקבוצות (Baileys / whatsapp-web.js) — אפשר
להחליף את המימוש ב-`group.mjs`.
