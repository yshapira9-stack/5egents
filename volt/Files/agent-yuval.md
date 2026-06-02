---
title: "agents/yuval.md — הגדרת הסוכן יובל"
type: file-doc
path: .claude/agents/yuval.md
owner: Yuval
tags: [file, agent-def]
---

# 📄 `.claude/agents/yuval.md`

**נתיב:** `.claude/agents/yuval.md`
**משויך ל:** [[Yuval (Image Designer)]]

## מה הוא עושה
קובץ ההגדרה של הסוכן יובל. ה-frontmatter מגדיר `tools: Read, Write, Bash, Glob`.
הגוף מתאר workflow ליצירת תמונה: סריקת reference, ניסוח prompt, קריאה לסקיל
[[SKILL-gpt-image-gen]], ושמירת PNG + `.txt` ב-[[yuval-outputs]].

## נקודות מפתח
- מודל קבוע: `gpt-image-2` (אסור לשנות — ראו אזהרה ב-[[SKILL-gpt-image-gen]]).
- טוען `.env` לקבלת `OPENAI_API_KEY` ([[env.example]]).
- מטרת על: עקביות ויזואלית בין כל התמונות.

## קבצים קשורים
- נטען על ידי: [[CLAUDE]].
- תלוי ב: [[SKILL-gpt-image-gen]], [[env.example]], [[yuval (workspace)]].
- פלט: [[yuval-outputs]].

## קשור
[[Yuval (Image Designer)]] · [[Home]]
