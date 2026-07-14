# שכבת חיבור CRM לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**CRM של fixdigital** — יצירת לידים
אוטומטית מתוך קובצי הלידים. בנוי במקביל לשכבת `דני/whatsapp/`. עד שפרטי החשבון
מגיעים, עובד ב-`--dry-run`.

ה-API של fixdigital **פשוט** (לא OAuth): מזהי הנכס/חברה (`assetId`/`assetTypeId`/
`companyId`) משמשים גם כאימות, והפרמטרים נשלחים כ-**query-string**. תיעוד:
https://info.fixdigital.co.il/docs/receiveapi/ — אבל את הערכים המדויקים (לפי
החשבון שלך) מקבלים מתוך **"הגדרת חיבור API"** של הנכס הדיגיטלי בממשק פיקס עצמו
(נכסים → הנכס → טאב "חיבור אתר" → מוצגת שם כתובת ה-API המלאה עם המזהים).

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env` (דרך `../lib/env.mjs`), חושף `getConfig(agent)` ו-`assertConfigured(config)`. |
| `mapping.mjs` | `parseLeadFile()` + `leadToCrmParams()` — פענוח קובץ ליד ומיפויו לפרמטרי CRM. |
| `client.mjs` | `createLead(params, { agent })` — POST query-string ל-`/lead/addApi` (כולל `--dry-run`). |
| `create-lead.mjs` | CLI: דוחף קובץ ליד מקומי ל-CRM. זו הנקודה שראובן מריץ. הסוכן (דני/יהודה) נקבע אוטומטית לפי תיקיית הליד. |

## ה-endpoints (מהתיעוד)

- יצירת ליד: `POST /api/v1.2/lead/addApi` ← השכבה משתמשת בזה.
- ליד מוואטסאפ: `POST /api/v1.2/lead/addwhatsapp` (אפשר להחליף דרך `CRM_LEAD_PATH`).
- עדכון סטטוס/סכום: `GET /api/crm/webhook/UpdateLeadStatusOrAmount` (טרם מומש — לעתיד).
- שליפת לידים: `GET /api/crm/webhook/GetLeads` (טרם מומש — לעתיד).
- קודי סטטוס: 4=בטיפול · 6=טוב · 7=פגישה · 8=הצעה נשלחה · 9=נסגר · 10=לא נסגר · 11=לא טוב.

## משתני סביבה (ב-`.env` שבשורש — מוחרג מגיט)

```
CRM_API_BASE=https://www.fixdigital.co.il/api/v1.2  # ברירת מחדל
CRM_LEAD_PATH=/lead/addApi          # או /lead/addwhatsapp

# דני (תכשיטים) — ברירת מחדל, בלי סיומת:
CRM_ASSET_ID=<assetId מהנכס בפיקס>
CRM_ASSET_TYPE_ID=<assetTypeId מהנכס בפיקס>
CRM_COMPANY_ID=<companyId מהנכס בפיקס>
CRM_CHANNEL_ID=                     # אופציונלי — סימון ערוץ המקור
CRM_API_KEY=                        # לעדכון/שליפת לידים (לא נדרש ליצירה)
CRM_FORM_URL=dani-whatsapp          # שדה מקור חובה ב-addApi
CRM_URL_REFER=whatsapp              # שדה מקור חובה ב-addApi

# יהודה (לימודים/סדנאות) — אותם שמות + סיומת _YEHUDA:
CRM_ASSET_ID_YEHUDA=<assetId מהנכס של יהודה>
CRM_ASSET_TYPE_ID_YEHUDA=<assetTypeId מהנכס של יהודה>
CRM_COMPANY_ID_YEHUDA=<companyId מהנכס של יהודה>
```

(הערכים בפועל חיים רק ב-`.env` המקומי — הם משמשים כאימות ל-API, ולכן לא
מתועדים כאן ולא נכנסים ל-git.)

את שלושת המזהים (`assetId`/`assetTypeId`/`companyId`) מקבלים **מתוך ממשק פיקס
עצמו**, לא ממייל תמיכה: נכסים → צור/פתח "חיבור API" (נכס דיגיטלי מסוג
`assetTypeId=10`) → שייך אותו לתהליך/סטטוס/נציג הרלוונטיים בטאב "CRM" → בטאב
"חיבור אתר" מוצגת כתובת ה-API המלאה של הנכס. **כל קו עסקי (תכשיטים / לימודים)
מקבל נכס API נפרד**, כדי שלידים ינותבו לתהליך הנכון בפיקס — `create-lead.mjs`
בוחר אוטומטית לפי תיקיית קובץ הליד (`דני/לידים/` → דני, `יהודה/לידים/` → יהודה).

## בדיקה עכשיו (בלי פרטי גישה) — `--dry-run`

```bash
node "דני/crm/create-lead.mjs" "דני/לידים/2026-06-12-גאבו.md" --dry-run
```

`--dry-run` מדפיס את מפת הפרמטרים + ה-URL המלא שהיו נשלחים, בלי לקרוא ל-API.

## הפעלה אמיתית (כשהמזהים יגיעו)

1. מלא `CRM_ASSET_ID` / `CRM_ASSET_TYPE_ID` / `CRM_COMPANY_ID` ב-`.env`.
2. הרץ בלי `--dry-run`:
   `node "דני/crm/create-lead.mjs" "דני/לידים/<ליד>.md"`
3. ודא שהליד נוצר ב-CRM.

## ⚠️ שדות מותאמים

השדות הסטנדרטיים (`name` / `phone` / `email` / `comments`) מתועדים. השדות המותאמים
ב-`mapping.mjs` (`jewelry_type` / `metal` / `budget` / `timeline` / `event`) **חייבים
להיות מוגדרים מראש ב-CRM** כשמות אנגלית ללא רווחים. אם שם שדה לא קיים בחשבון שלך —
מוחקים אותו מ-`leadToCrmParams()`.
