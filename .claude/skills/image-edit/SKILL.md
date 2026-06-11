---
name: image-edit
description: Use when you need to edit or enhance an existing image via the OpenAI Images API. Sends a source image + prompt to the edit endpoint and saves the returned PNG to disk. Used primarily by Rani (the marketing image designer).
---

# image-edit — עריכת תמונה קיימת דרך OpenAI Images API

## Overview

הסקיל הזה עוטף את endpoint `/v1/images/edits` של OpenAI. בניגוד ל-`gpt-image-gen`
שיוצר תמונה מ-prompt בלבד, סקיל זה מקבל **תמונת מקור קיימת** ו-**prompt** ומחזיר
תמונה ערוכה/משופרת על בסיסה.

## ⚠️ תשתית — אין Python במערכת הזו

במערכת **אין Python אמיתי** (רק stub של Windows Store), ואין `jq`. הכלים הזמינים:
`curl`, `Node.js`, `base64`. לכן הסקיל מבוסס **curl + node** — לא Python ולא ספריית openai.

## המודל — `gpt-image-2`

**השתמש תמיד ובדיוק במודל `gpt-image-2`.**

⚠️ **אל תשנה את שם המודל בשום מצב** — ראה הסבר מלא ב-`gpt-image-gen/SKILL.md`.
אם מתקבלת שגיאה — הבעיה היא ב-`OPENAI_API_KEY` או בפרמטרים, לא בשם המודל.

## אימות (Authentication)

```bash
set -a; source .env; set +a

if [ -z "$OPENAI_API_KEY" ]; then
  echo "ERROR: OPENAI_API_KEY is not set. Add it to .env." >&2
  exit 1
fi
```

## פרמטרים

| פרמטר | ערך ברירת מחדל | הערות |
|--------|----------------|-------|
| `model` | `gpt-image-2` | **קבוע — אל תשנה.** |
| `image` | _(חובה)_ | נתיב לקובץ PNG/JPG מקור |
| `prompt` | _(חובה)_ | הוראות העריכה באנגלית |
| `size` | `1024x1024` | גם `1536x1024`, `1024x1536` נתמכים |
| `output_path` | _(חובה)_ | נתיב לשמירת PNG הפלט |

## הקריאה — curl (multipart) + node (פענוח base64)

endpoint זה דורש שליחת קובץ (multipart/form-data). עם `curl` משתמשים ב-`-F`,
ו-`@<path>` כדי לצרף את קובץ התמונה. את התשובה (JSON עם `data[0].b64_json`)
מפענחים עם node — אין צורך ב-jq.

### ⚠️ שלושה תיקונים חובה ל-curl על Windows (נבדקו בריצה אמיתית)

ה-curl במערכת הוא **נייטיב של Windows (Schannel)**, לא של git-bash. לכן:

1. **נתיב Windows, לא נתיב git-bash.** curl לא מבין `/tmp/...` או נתיבי POSIX —
   חובה להמיר עם `cygpath -w` לנתיב `C:\...` לפני `-F "image=@..."`.
2. **דגל `--ssl-no-revoke`.** בלעדיו תתקבל `curl: (35) schannel ...
   CRYPT_E_NO_REVOCATION_CHECK` — Schannel נכשל בבדיקת revocation של התעודה.
3. **נתיב ASCII בלי רווחים/עברית.** נתיב מקור עם רווח או תווים עבריים (כמו
   `טבעת לדוגמא.jpeg`) גורם ל-`curl: (26) Failed to open/read local data` —
   העתק קודם את המקור לקובץ ASCII זמני (למשל `rani/_upload.jpg`).

```bash
SRC="<source_path>"          # יכול להכיל עברית/רווחים
OUT="<output_path>"
PROMPT="<prompt in English>"
SIZE="1024x1024"

# (3) העתק לנתיב ASCII בלי רווחים, ואז (1) המר לנתיב Windows
cp "$SRC" "rani/_upload.jpg"
WINSRC="$(cygpath -w "$(pwd)/rani/_upload.jpg")"

RESP="$(mktemp)"
HTTP=$(curl -sS --ssl-no-revoke -w "%{http_code}" \
  -X POST "https://api.openai.com/v1/images/edits" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=gpt-image-2" \
  -F "image=@${WINSRC};type=image/jpeg" \
  -F "prompt=${PROMPT}" \
  -F "size=${SIZE}" -o "$RESP")
echo "HTTP: $HTTP"

node -e '
const fs = require("fs");
const t = fs.readFileSync(process.argv[1], "utf8");
let d; try { d = JSON.parse(t); } catch (e) {
  console.error("non-JSON response:", t.slice(0, 600)); process.exit(1);
}
if (!d.data || !d.data[0] || !d.data[0].b64_json) {
  console.error("API ERROR:", JSON.stringify(d).slice(0, 1200)); process.exit(1);
}
fs.writeFileSync(process.argv[2], Buffer.from(d.data[0].b64_json, "base64"));
console.log("OK:", process.argv[2], fs.statSync(process.argv[2]).size, "bytes");
' "$RESP" "$OUT"

rm -f "$RESP" "rani/_upload.jpg"
```

**הערה על escaping:** ה-prompt מועבר דרך `-F "prompt=$PROMPT"` — curl מטפל
ב-escaping של ערך ה-form בעצמו.

## אימות לאחר היצירה

```bash
if [ -s "$OUT" ]; then
  echo "OK: $(wc -c < "$OUT") bytes"
else
  echo "ERROR: קובץ פלט חסר או ריק — בדוק את תגובת ה-API שהודפסה למעלה" >&2
fi
```

## טיפול בשגיאות נפוצות

| הודעת שגיאה | סיבה | פתרון |
|-------------|------|-------|
| `curl: (26) Failed to open/read local data` | נתיב git-bash/עברית/רווח | המר ל-Windows path עם `cygpath -w`, העתק לקובץ ASCII |
| `curl: (35) schannel ... CRYPT_E_NO_REVOCATION_CHECK` | בדיקת revocation נכשלה | הוסף `--ssl-no-revoke` |
| `invalid_api_key` | מפתח שגוי | בדוק `.env` |
| `image ... invalid` | הקובץ לא PNG/JPG תקין | ודא שהמקור לא פגום |
| `model_not_found` | אין גישה למודל | בדוק הרשאות ה-API Key (לא לשנות את שם המודל) |

## הבדל מ-gpt-image-gen

| סקיל | Endpoint | קלט | שימוש |
|------|----------|-----|-------|
| `gpt-image-gen` | `/v1/images/generations` | prompt בלבד | יובל — יצירה מאפס |
| `image-edit` | `/v1/images/edits` | תמונה + prompt | רני — עריכת תמונה קיימת |
