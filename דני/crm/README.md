# שכבת חיבור CRM לדני

קוד Node (בלי תלויות חיצוניות) שמחבר את דני ל-**CRM של fixdigital** — יצירת לידים
אוטומטית מתוך קובצי הלידים. בנוי במקביל לשכבת `דני/whatsapp/`. עד שפרטי החשבון
מגיעים, עובד ב-`--dry-run`.

ה-API של fixdigital **פשוט** (לא OAuth): מזהי החשבון/פרויקט משמשים גם כאימות,
והפרמטרים נשלחים כ-**query-string**. תיעוד: https://info.fixdigital.co.il/docs/receiveapi/

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env` (דרך `../lib/env.mjs`), חושף `config` ו-`assertConfigured()`. |
| `mapping.mjs` | `parseLeadFile()` + `leadToCrmParams()` — פענוח קובץ ליד ומיפויו לפרמטרי CRM. |
| `client.mjs` | `createLead()` — POST query-string ל-`/lead/addApi` (כולל `--dry-run`). |
| `create-lead.mjs` | CLI: דוחף קובץ ליד מקומי ל-CRM. זו הנקודה שראובן מריץ. |

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
CRM_CLIENT_ID=                      # ⬜ clientID — חסר (מ-fixdigital)
CRM_TENANT_ID=                      # ⬜ tenantID — חסר
CRM_PROJECT_ID=                     # ⬜ projectID — חסר
CRM_PROJECT_TYPE_ID=                # ⬜ projectTypeID — חסר
CRM_CHANNEL_ID=                     # אופציונלי — סימון ערוץ המקור
CRM_API_KEY=                        # לעדכון/שליפת לידים (לא נדרש ליצירה)
CRM_FORM_URL=dani-whatsapp          # שדה מקור חובה ב-addApi
CRM_URL_REFER=whatsapp              # שדה מקור חובה ב-addApi
```

ארבעת המזהים + `api_key` מגיעים מ-**fixdigital** (ראה המכתב המוכן ב-`../מכתב-בקשת-API.md`;
תמיכה: support@fixdigitalcrm.com).

## בדיקה עכשיו (בלי פרטי גישה) — `--dry-run`

```bash
node "דני/crm/create-lead.mjs" "דני/לידים/2026-06-12-גאבו.md" --dry-run
```

`--dry-run` מדפיס את מפת הפרמטרים + ה-URL המלא שהיו נשלחים, בלי לקרוא ל-API.

## הפעלה אמיתית (כשהמזהים יגיעו)

1. מלא `CRM_CLIENT_ID` / `CRM_TENANT_ID` / `CRM_PROJECT_ID` / `CRM_PROJECT_TYPE_ID` ב-`.env`.
2. הרץ בלי `--dry-run`:
   `node "דני/crm/create-lead.mjs" "דני/לידים/<ליד>.md"`
3. ודא שהליד נוצר ב-CRM.

## ⚠️ שדות מותאמים

השדות הסטנדרטיים (`name` / `phone` / `email` / `comments`) מתועדים. השדות המותאמים
ב-`mapping.mjs` (`jewelry_type` / `metal` / `budget` / `timeline` / `event`) **חייבים
להיות מוגדרים מראש ב-CRM** כשמות אנגלית ללא רווחים. אם שם שדה לא קיים בחשבון שלך —
מוחקים אותו מ-`leadToCrmParams()`.
