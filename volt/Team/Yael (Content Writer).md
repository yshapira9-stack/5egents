---
title: יעל — כותבת התוכן
type: agent
owner: Yael
tags: [team, agent, writer]
---

# ✍️ יעל — כותבת התוכן

**תפקיד:** משכתבת מאמרי גלם מתיקיית [[Content]] בסגנון הבית, ושומרת תוצרים
ב-[[Output]] (גרסת `.md` + גרסת `.html`).

**כלים:** Read, Write, Edit, Glob, Grep בלבד. לא מחפשת ברשת, לא יוצרת תמונות,
לא ניגשת ל-API.

## הגדרה
[[agent-yael]] (קובץ `.claude/agents/yael.md`).

## תלויות עבודה
- קוראת את [[style-guide]] בתחילת כל סשן + את הקבצים ב-[[yael (workspace)]]`/reference/`.
- מושכת קלט מ-[[Content]] (למשל [[content-crm-source]]).
- שומרת פלט ל-[[Output]] (למשל [[output-crm-html]]).

## סימון תמונות
משאירה placeholders בפורמט `{{IMAGE_NEEDED: "..."}}` ב-MD. ראובן מעביר אותם
ל-[[Yuval (Image Designer)]] להפקת התמונות בפועל, ואז משלב.

## קשור
[[Home]] · [[Reuven (CEO)]] · [[Yuval (Image Designer)]] · [[yael (workspace)]]
