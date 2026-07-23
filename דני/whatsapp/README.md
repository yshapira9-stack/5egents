# שכבת חיבור WhatsApp לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**WhatsApp Business Platform
דרך 360dialog** (BSP — לא Meta ישירות, ולא דרך פיקס). ✅ **מקצה לקצה עובד
וחי** (webhook → Claude → תשובה, דרך Railway), על מספר בדיקה זמני של Meta —
⏳ אבל **חסום זמנית** עד שMeta יאשרו את שם התצוגה (ראה "מצב נוכחי" למטה).

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
| `receive.mjs` | פענוח webhook נכנס — תומך גם בפורמט **360dialog/Meta Cloud API** (חי, `parseD360Body`) וגם בפורמט הישן של פיקס (לתאימות). ✅ נבדק. |

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

## מצב נוכחי (14.7.2026) — הכל עובד מקצה לקצה, חוץ מאישור Meta

1. ✅ **אירוח ציבורי** — Railway, `5egents-production.up.railway.app`
   (branch `add-dani-agent`, כל משתני הסביבה מוזנו ב-Railway Variables).
2. ✅ **`receive.mjs` תומך בפורמט 360dialog/Meta Cloud API** (`parseD360Body`) —
   נבדק חי: webhook נכנס מתקבל, מפוענח נכון (name/phone/message), ומועבר
   ל-Claude. `server.mjs` תומך גם ב-handshake `hub.mode=subscribe`/
   `hub.verify_token`/`hub.challenge` הסטנדרטי של Meta.
3. ✅ **ה-webhook רשום** בממשק 360dialog Hub (Direct API Access → Set webhook)
   לכתובת `https://5egents-production.up.railway.app/webhook`.
4. ⏳ **חסום זמנית** — Meta עדיין לא אישרו את שם התצוגה ("my art stydio ltd")
   של מספר הבדיקה. הודעה ראשונה בשיחה בדרך כלל עוברת, אבל הודעות המשך
   נכשלות עם שגיאת API `(#131037) WhatsApp provided number needs display
   name approval before message can be sent`. **אין מה לעשות מלבד לחכות**
   (עד 5 ימי עסקים מיצירת הערוץ, לפי מה שהוצג בהרשמה) — לא באג בקוד.
5. **מספר ייצור אמיתי** — להחליף את מספר הבדיקה הזמני של Meta במספר סים
   אמיתי, כשנרצה לצאת לאוויר בפועל (גם הוא יעבור תהליך אישור דומה).

**מלכודת שכבר נתקלנו בה:** אם עורכים משתני סביבה ב-Railway דרך ה-"Raw
Editor" עם ערכים ארוכים — ייתכן קלקול (הערך נשמר עם תווי מסכה `•` במקום
הערך האמיתי, גורם לשגיאת `Cannot convert argument to a ByteString`
ב-`fetch`). במקרה כזה — לערוך את המשתנה הספציפי ישירות (לא ב-Raw Editor)
ולוודא שהערך שנשמר תואם למקור.

## ⚠️ מגבלת קבוצות

WhatsApp Business Platform **לא תומך ביצירת קבוצות** פרוגרמטית. לכן `sendHandoff()`
שולח את הודעת הסיכום ליניב, לסטודיו וללקוח **בנפרד**, ויניב פותח את הקבוצה ידנית.
אם בעתיד יחובר ספק לא-רשמי שתומך בקבוצות (Baileys / whatsapp-web.js) — אפשר
להחליף את המימוש ב-`group.mjs`.
