---
title: ".env.example — תבנית משתני סביבה"
type: file-doc
path: .env.example
owner: shared
tags: [file, config, secrets]
---

# 📄 `.env.example`

**נתיב:** `.env.example` (שורש)
**משויך ל:** תשתית משותפת (כל הצוות)

## מה הוא עושה
תבנית למשתני הסביבה של הפרויקט. מעתיקים אותו ל-`.env` (שלא נכנס ל-git — ראו
[[gitignore]]) וממלאים ערכים אמיתיים.

## המשתנים
| משתנה | שייך ל | שימוש |
|-------|--------|-------|
| `ANTHROPIC_API_KEY` | כללי | Claude API |
| `IMAGE_API_KEY` | [[Yuval (Image Designer)]] | מפתח ספק תמונות |
| `OPENAI_API_KEY` | [[Yuval (Image Designer)]] | סקיל [[SKILL-gpt-image-gen]] (gpt-image-2) |
| `SEARCH_API_KEY` | [[Chen (Web Researcher)]] | חיפוש ברשת |
| `APP_ENV`, `LOG_LEVEL` | כללי | סביבה ולוגים |

## קבצים קשורים
- [[gitignore]] — מוודא ש-`.env` האמיתי לא עולה ל-repo.
- [[SKILL-gpt-image-gen]] — צרכן עיקרי של `OPENAI_API_KEY`.

## קשור
[[Home]]
