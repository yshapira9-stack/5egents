---
title: ".gitignore — חוקי התעלמות"
type: file-doc
path: .gitignore
owner: infra
tags: [file, config, git]
---

# 📄 `.gitignore`

**נתיב:** `.gitignore` (שורש)
**משויך ל:** תשתית

## מה הוא עושה
מגדיר אילו קבצים git מתעלם מהם. מונע העלאת סודות וזבל סביבה.

## מה מוסתר
- **סודות:** `.env`, `.env.local`, `.env.*.local` (ראו [[env.example]]).
- **OS / עורך:** `Thumbs.db`, `.DS_Store`, `.vscode/`, `.idea/`.
- **לוגים:** `*.log`.

## קשור
[[env.example]] · [[Home]]
