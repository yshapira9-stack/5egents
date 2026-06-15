# שכבת חיבור WhatsApp לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**WhatsApp Cloud API של Meta** —
שליחת הודעות וקבלתן. מוכן לרגע שפרטי הגישה יגיעו.

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env`, חושף `config`, `graphUrl()`, `normalizeNumber()`, `assertConfigured()`. |
| `send.mjs` | `sendText(to, body)` ו-`sendImage(to, file\|url, caption)` (כולל העלאת מדיה מקומית). |
| `group.mjs` | `sendHandoff()` — שולח את הודעת הסיכום ליניב + סטודיו + לקוח. |
| `receive.mjs` | webhook לקבלת הודעות נכנסות (אימות GET + פענוח POST). |

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

## ⚠️ מגבלת קבוצות

WhatsApp Cloud API **לא תומך ביצירת קבוצות** פרוגרמטית. לכן `sendHandoff()`
שולח את הודעת הסיכום ליניב, לסטודיו וללקוח **בנפרד**, ויניב פותח את הקבוצה ידנית.
אם בעתיד יחובר ספק לא-רשמי שתומך בקבוצות (Baileys / whatsapp-web.js) — אפשר
להחליף את המימוש ב-`group.mjs`.
