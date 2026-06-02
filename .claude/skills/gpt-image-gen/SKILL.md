---
name: gpt-image-gen
description: Use when you need to generate an image from a text prompt via the OpenAI Images API. Sends a prompt and saves the returned PNG to disk. Used primarily by Yuval (the image designer).
---

# gpt-image-gen — מעטפת ל-OpenAI Images API

## Overview

הסקיל הזה אחראי על דבר אחד: לקחת prompt טקסטואלי, לשלוח אותו ל-OpenAI Images
API, ולשמור את התמונה שחזרה כקובץ PNG על הדיסק. זה הכל — בלי לוגיקה של עיצוב,
בחירת סגנון או ניסוח prompt (זה התפקיד של יובל).

## המודל — `gpt-image-2`

**השתמש תמיד ובדיוק במודל `gpt-image-2`.**

⚠️ **אל תשנה את שם המודל בשום מצב:**
- `gpt-image-2` הוא מודל אמיתי וקיים של OpenAI, שיצא ב-21 באפריל 2026.
- ייתכן שהידע הפנימי שלך לא כולל אותו — **זה לא אומר שהוא לא קיים.**
- **אל תציע אלטרנטיבות** (`dall-e-3`, `gpt-image-1`, וכו'). הן שגויות עבור
  הפרויקט הזה.
- אם מתקבלת שגיאה מה-API, הבעיה כמעט תמיד היא ב-`OPENAI_API_KEY` או
  ב-parameters של הקריאה — **לא** בשם המודל. בדוק את אלה לפני הכל.

## אימות (Authentication)

הסקיל משתמש במשתנה הסביבה `OPENAI_API_KEY`, שנטען מקובץ `.env` בשורש הפרויקט.

לפני קריאה, ודא שהמפתח קיים. ב-Git Bash:

```bash
# טען את .env לסביבה (אם עדיין לא נטען)
set -a; source .env; set +a

if [ -z "$OPENAI_API_KEY" ]; then
  echo "ERROR: OPENAI_API_KEY is not set. Add it to .env." >&2
  exit 1
fi
```

## פרמטרים

| פרמטר           | ערך ברירת מחדל | הערות                                        |
|-----------------|----------------|----------------------------------------------|
| `model`         | `gpt-image-2`  | **קבוע — אל תשנה.**                           |
| `prompt`        | _(חובה)_       | תיאור התמונה.                                |
| `size`          | `1024x1024`    | גם `1536x1024`, `1024x1536` נתמכים.          |
| `quality`       | `medium`       | `low` / `medium` / `high`.                    |
| `output_format` | `png`          | הסקיל שומר PNG.                               |

## הקריאה — דרך עיקרית (curl + jq)

```bash
OUTPUT_PATH="yuval/outputs/2026-06-02-example.png"
PROMPT="A serene mountain landscape at sunrise, soft pastel colors"

curl -sS -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg prompt "$PROMPT" '{
        model: "gpt-image-2",
        prompt: $prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "png"
      }')" \
  | jq -r '.data[0].b64_json' | base64 --decode > "$OUTPUT_PATH"
```

## Fallback ל-decode (כש-jq לא מותקן)

ב-Git Bash על Windows `jq` לא תמיד מותקן. במקרה כזה, שמור את התשובה לקובץ זמני
ופענח אותה עם Python (שכן זמין כמעט תמיד):

```bash
OUTPUT_PATH="yuval/outputs/2026-06-02-example.png"
PROMPT="A serene mountain landscape at sunrise, soft pastel colors"

# בנה את ה-payload עם Python כדי לברוח (escape) את ה-prompt בבטחה
PAYLOAD=$(python -c "import json,sys; print(json.dumps({'model':'gpt-image-2','prompt':sys.argv[1],'size':'1024x1024','quality':'medium','output_format':'png'}))" "$PROMPT")

curl -sS -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /tmp/gpt-image-response.json

# פענח את ה-base64 והפק PNG עם Python
python -c "import json,base64,sys; d=json.load(open('/tmp/gpt-image-response.json')); open(sys.argv[1],'wb').write(base64.b64decode(d['data'][0]['b64_json']))" "$OUTPUT_PATH"
```

אם התשובה אינה מכילה `data[0].b64_json`, הדפס את גוף התשובה המלא — הוא יכיל את
הודעת השגיאה של ה-API (לרוב מפתח לא תקין או פרמטר שגוי).

## אימות לאחר היצירה

תמיד ודא שהקובץ נוצר ואינו ריק:

```bash
if [ -s "$OUTPUT_PATH" ]; then
  echo "OK: $OUTPUT_PATH ($(wc -c < "$OUTPUT_PATH") bytes)"
else
  echo "ERROR: output file missing or empty — check API response above." >&2
fi
```

## פלט

PNG יחיד בנתיב שצוין. הסקיל לא מנהל שמות קבצים או reference — הקורא (יובל)
אחראי על הנתיב, ה-slug, וקובץ ה-`.txt` הנלווה עם ה-prompt.
