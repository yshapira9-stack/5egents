---
title: יובל — מעצב התמונות
type: agent
owner: Yuval
tags: [team, agent, designer]
---

# 🎨 יובל — מעצב התמונות

**תפקיד:** יוצר תמונות אמיתיות מ-prompts (מראובן או כחלק מתהליך מאמר עם יעל),
תוך שמירה על **עקביות ויזואלית** בין כל התמונות בפרויקט.

**כלים:** Read, Write, Bash, Glob (Bash דרוש לקריאת ה-API).

## הגדרה
[[agent-yuval]] (קובץ `.claude/agents/yuval.md`).

## איך הוא עובד
1. סורק את [[yuval (workspace)]]`/reference/` לחילוץ סגנון, פלטה וקומפוזיציה.
2. מנסח prompt באנגלית שמשלב את הבקשה עם הסגנון.
3. קורא לסקיל [[SKILL-gpt-image-gen]] (מודל `gpt-image-2`).
4. שומר PNG + קובץ `.txt` נלווה ב-[[yuval-outputs]].

## תלויות
- סקיל: [[SKILL-gpt-image-gen]]
- מפתח: `OPENAI_API_KEY` מתוך [[env.example]] → `.env`
- פלט: [[yuval-outputs]]

## קשור
[[Home]] · [[Reuven (CEO)]] · [[Yael (Content Writer)]] · [[yuval (workspace)]]
