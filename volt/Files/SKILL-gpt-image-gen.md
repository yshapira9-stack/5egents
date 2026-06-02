---
title: "gpt-image-gen — סקיל יצירת תמונות"
type: file-doc
path: .claude/skills/gpt-image-gen/SKILL.md
owner: Yuval
tags: [file, skill, api]
---

# 📄 `.claude/skills/gpt-image-gen/SKILL.md`

**נתיב:** `.claude/skills/gpt-image-gen/SKILL.md`
**משויך ל:** [[Yuval (Image Designer)]] (משתמש עיקרי)

## מה הוא עושה
מעטפת דקה ל-OpenAI Images API. אחריות אחת: לקחת prompt, לשלוח ל-API, ולשמור את
ה-PNG שחזר. בלי לוגיקת עיצוב או ניסוח prompt — זה התפקיד של יובל.

## נקודות מפתח
- **מודל קבוע: `gpt-image-2`** — אזהרה מפורשת לא לשנות ולא להציע אלטרנטיבות
  (`dall-e-3` וכו'). אם יש שגיאה — הבעיה ב-`OPENAI_API_KEY` או בפרמטרים, לא בשם המודל.
- אימות דרך `OPENAI_API_KEY` מתוך `.env` ([[env.example]]).
- שתי דרכי decode: `curl + jq`, או fallback ל-Python (כש-jq חסר ב-Git Bash/Windows).
- אימות אחרי יצירה: `[ -s "$OUTPUT_PATH" ]`.

## קבצים קשורים
- נקרא על ידי: [[agent-yuval]] / [[Yuval (Image Designer)]].
- מפתח מ: [[env.example]].
- כותב אל: [[yuval-outputs]].

## קשור
[[Home]]
