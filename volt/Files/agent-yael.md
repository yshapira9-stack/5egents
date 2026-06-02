---
title: "agents/yael.md — הגדרת הסוכנת יעל"
type: file-doc
path: .claude/agents/yael.md
owner: Yael
tags: [file, agent-def]
---

# 📄 `.claude/agents/yael.md`

**נתיב:** `.claude/agents/yael.md`
**משויך ל:** [[Yael (Content Writer)]]

## מה הוא עושה
קובץ ההגדרה (system prompt) של הסוכנת יעל. ה-frontmatter מגדיר `name`,
`description` ו-`tools: Read, Write, Edit, Glob, Grep`. הגוף מתאר את ה-flow:
משיכת מאמר מ-[[Content]], קריאת [[style-guide]], שכתוב בסגנון הבית, סימון
placeholders לתמונות, ושמירת פלט ל-[[Output]] (MD + HTML).

## נקודות מפתח
- פורמט placeholder לתמונה: `{{IMAGE_NEEDED: "..."}}` (עבור [[Yuval (Image Designer)]]).
- מפרט פורמט HTML עצמאי עם תמיכת RTL בעברית.
- כללים: הסרת קישורים/CTA של המחבר המקורי, שמירת מותגים שבתוך הסיפור.

## קבצים קשורים
- נטען על ידי: [[CLAUDE]] (ניתוב).
- תלוי ב: [[style-guide]], [[Content]], [[Output]].

## קשור
[[Yael (Content Writer)]] · [[Home]]
