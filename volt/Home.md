---
title: Home — מפת התוכן של הפרויקט
type: moc
tags: [moc, index]
---

# 🏠 Home — מפת התוכן (Map of Content)

Vault תיעוד לפרויקט **"הצוות של ראובן"** — מערכת של מנכ"ל (ראובן) ושלושה
סוכני-משנה (יעל, יובל, חן) שמפיקים תוכן מקצה לקצה.

ה-Vault הזה מתעד **כל קובץ אמיתי בפרויקט**: מה הוא עושה, למי הוא משויך, ולאילו
קבצים הוא קשור. כל נוט מקושר ב-`[[wikilinks]]` — פתחו את תצוגת ה-Graph כדי לראות
את כל הרשת.

## 👥 הצוות

| סוכן | תפקיד | הגדרה | סביבת עבודה |
|------|-------|-------|-------------|
| [[Reuven (CEO)]] | מנכ"ל / מנתב | [[CLAUDE]] | שורש הפרויקט |
| [[Yael (Content Writer)]] | כותבת תוכן | [[agent-yael]] | [[yael (workspace)]] |
| [[Yuval (Image Designer)]] | מעצב תמונות | [[agent-yuval]] | [[yuval (workspace)]] |
| [[Chen (Web Researcher)]] | חוקרת רשת | [[agent-chen]] | [[chen (workspace)]] |

## 📂 קבצי הפרויקט לפי קטגוריה

### תשתית / שורש
- [[CLAUDE]] — ה"מוח" של ראובן, הוראות הניתוב
- [[env.example]] — תבנית משתני סביבה
- [[gitignore]] — חוקי התעלמות של git

### הגדרות סוכנים (`.claude/agents/`)
- [[agent-yael]] · [[agent-yuval]] · [[agent-chen]]

### סקילים (`.claude/skills/`)
- [[SKILL-gpt-image-gen]] — מעטפת ל-OpenAI Images API (של יובל)
- [[superpowers-skills]] — 14 סקילי פיתוח מובנים (צד שלישי)

### תוכן ונתונים
- [[style-guide]] — מדריך הסגנון של יעל
- [[searches]] — לוג החיפושים של חן
- [[content-crm-source]] — מאמר גלם (קלט)
- [[output-crm-html]] — תוצר HTML מוגמר
- [[yuval-outputs]] — תמונות שנוצרו + ה-prompts

### תיקיות (hub notes)
- [[Content]] · [[Output]] · [[yael (workspace)]] · [[yuval (workspace)]] · [[chen (workspace)]]

## 🔄 תהליכי העבודה

```
בקשה רק "מצא מאמר":   משתמש → [[Reuven (CEO)]] → [[Chen (Web Researcher)]] → Content/ → דיווח
מאמר עם תמונות:       [[Reuven (CEO)]] → [[Yael (Content Writer)]] (placeholders) → [[Yuval (Image Designer)]] → שילוב → Output/
תוכן חדש מהרשת:       [[Chen (Web Researcher)]] → [[Yael (Content Writer)]] → [[Yuval (Image Designer)]] → Output/
```

זרימת התוכן בין התיקיות: [[Content]] (קלט) → עיבוד → [[Output]] (פלט).
