---
title: "agents/chen.md — הגדרת הסוכנת חן"
type: file-doc
path: .claude/agents/chen.md
owner: Chen
tags: [file, agent-def]
---

# 📄 `.claude/agents/chen.md`

**נתיב:** `.claude/agents/chen.md`
**משויך ל:** [[Chen (Web Researcher)]]

## מה הוא עושה
קובץ ההגדרה של הסוכנת חן. ה-frontmatter מגדיר
`tools: WebSearch, WebFetch, Read, Write, Edit, Glob, Grep`. הגוף מתאר את ה-flow:
בדיקת זיכרון ב-[[searches]], חיפוש וסינון מקורות, שמירת מקור נבחר ב-[[Content]]
עם לינק בראש, ותיעוד החיפוש בלוג.

## נקודות מפתח
- היתרון שלה על LLM רגיל: מידע עכשווי, מקורות אמיתיים עם לינקים, בלי הזיות.
- קריטריונים למקור איכותי (מקורות ראשוניים, עדכניות, פסילת אגרגטורים).
- לא קוראת ישירות ליעל — מדווחת לראובן.

## קבצים קשורים
- נטען על ידי: [[CLAUDE]].
- תלוי ב / מעדכן: [[searches]] (זיכרון), [[Content]] (פלט).

## קשור
[[Chen (Web Researcher)]] · [[Home]]
