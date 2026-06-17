# שכבת חיבור WhatsApp לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**WhatsApp Cloud API של Meta** —
שליחת הודעות וקבלתן. מוכן לרגע שפרטי הגישה יגיעו.

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env`, חושף `config`, `graphUrl()`, `normalizeNumber()`, `assertConfigured()`. |
| `send.mjs` | `sendText(to, body)` ו-`sendImage(to, file\|url, caption)` (כולל העלאת מדיה מקומית). |
| `group.mjs` | `sendHandoff()` — שולח את הודעת הסיכום ליניב + סטודיו + לקוח. |
| `receive.mjs` | **מקלט webhook בפורמט fixdigital** — מקבל ליד/הודעה נכנסת (GET query או POST urlencoded/JSON), מאמת secret דרך header מותאם, ומפענח שדות גמיש. |

## משתני סביבה (ב-`.env` שבשורש — מוחרג מגיט)

```
WHATSAPP_BUSINESS_NUMBER=+972526935619   # ✅ כבר הוגדר
YANIV_WHATSAPP=+972509900216             # ✅ כבר הוגדר
STUDIO_WHATSAPP=+972515010839            # ✅ כבר הוגדר
WHATSAPP_TOKEN=                          # ⬜ Access Token (סודי) — חסר
WHATSAPP_PHONE_NUMBER_ID=                # ⬜ Phone Number ID מ-Meta — חסר
WHATSAPP_VERIFY_TOKEN=dani-verify        # מחרוזת חופשית לאימות ה-webhook
WHATSAPP_API_VERSION=v21.0               # אופציונלי
```

את `WHATSAPP_TOKEN` ו-`WHATSAPP_PHONE_NUMBER_ID` מקבלים מלוח הבקרה
**Meta for Developers → WhatsApp** אחרי אימות המספר.

## בדיקה עכשיו (בלי טוקן) — `--dry-run`

```bash
node "דני/whatsapp/send.mjs" 0509900216 "שלום, כאן דני 🙂" --dry-run
node "דני/whatsapp/send.mjs" --image 0509900216 "yuval/outputs/....png" "הדמיה" --dry-run
node "דני/whatsapp/group.mjs" "🔔 ליד מוכן" --client 0501234567 --dry-run
```

`--dry-run` מדפיס את ה-payload שהיה נשלח, בלי לקרוא ל-API. מספר ישראלי מקומי
(0XX) מומר אוטומטית לבינלאומי (972XX).

## הפעלה אמיתית (כשהטוקן יגיע)

1. מלא `WHATSAPP_TOKEN` ו-`WHATSAPP_PHONE_NUMBER_ID` ב-`.env`.
2. שלח: `node "דני/whatsapp/send.mjs" 0509900216 "היי"` (בלי `--dry-run`).
3. webhook נכנס: `node "דני/whatsapp/receive.mjs"` — צריך URL ציבורי
   (deploy או מנהרת ngrok/cloudflared) שתירשם בלוח הבקרה של Meta תחת ה-path
   `/webhook`, עם אותו `WHATSAPP_VERIFY_TOKEN`.

## מקלט ה-webhook של fixdigital (`receive.mjs`)

מודל החיבור שאושר ע"י פיקס: לקוח → וואטסאפ → fixdigital → **webhook לכאן**.
פיקס שולח את הליד לכתובת ה-URL שתגדיר אצלם (אוטומציה), ב-GET או POST, עם
header/ים מותאמים לאימות.

משתני סביבה:
```
FIXDIGITAL_WEBHOOK_SECRET=         # סוד משותף; פיקס שולח אותו בכותרת
FIXDIGITAL_WEBHOOK_HEADER=x-webhook-secret   # שם הכותרת (ברירת מחדל)
WHATSAPP_WEBHOOK_PORT=3030         # פורט מקומי (אופציונלי)
```

הרצה ובדיקה מקומית:
```bash
FIXDIGITAL_WEBHOOK_SECRET=testsecret node "דני/whatsapp/receive.mjs"
# GET:  curl "http://localhost:3030/webhook?name=ניב&phone=0509900216&secret=testsecret"
# POST: curl -X POST http://localhost:3030/webhook -H "x-webhook-secret: testsecret" \
#         -H "Content-Type: application/x-www-form-urlencoded" --data "name=ניב&phone=05..."
```
בלי secret נכון → `401`. נבדק: GET/POST נקלטים, השדות מפוענחים, אימות עובד.

**להפעלה אמיתית:** צריך כתובת URL ציבורית (VPS / מנהל מנהרה) לרשום בממשק פיקס,
ולהגדיר שם את ה-header עם אותו `FIXDIGITAL_WEBHOOK_SECRET`. שליחת התשובה חזרה
ללקוח תיעשה דרך ה-API של פיקס (endpoint שעדיין נקבל מהם).

## ⚠️ מגבלת קבוצות

WhatsApp Cloud API **לא תומך ביצירת קבוצות** פרוגרמטית. לכן `sendHandoff()`
שולח את הודעת הסיכום ליניב, לסטודיו וללקוח **בנפרד**, ויניב פותח את הקבוצה ידנית.
אם בעתיד יחובר ספק לא-רשמי שתומך בקבוצות (Baileys / whatsapp-web.js) — אפשר
להחליף את המימוש ב-`group.mjs`.
