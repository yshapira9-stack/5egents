import fs from "node:fs";
import path from "node:path";
import { loadEnv, PROJECT_ROOT } from "../lib/env.mjs";

// config.mjs — הגדרות חיבור היומן (Google Calendar) לפי תחום.
// שני תחומים אפשריים: "jewelry" (תכשיטים, לדני) ו-"studies" (לימודים+סדנאות, ליהודה).
// שני התחומים חולקים אותו Service Account אבל כל אחד עם יומן Google Calendar נפרד.

export { PROJECT_ROOT };

loadEnv();

const DOMAINS = ["jewelry", "studies"];

// קורא משתנה סביבה כמספר שלם חיובי. אם המשתנה לא הוגדר (או ריק) — מחזיר ברירת
// מחדל. אם הוגדר אבל הערך לא תקין (לא מספר שלם חיובי) — זורק שגיאה ברורה, כדי
// שטעות הקלדה ב-.env תיכשל בקול רם ולא תיבלע בשקט לתוך חישובי לוח-הזמנים.
function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} חייב להיות מספר שלם חיובי — ערך לא תקין: "${raw}"`);
  }
  return n;
}

export function getConfig(domain) {
  if (!DOMAINS.includes(domain)) {
    throw new Error(`unknown calendar domain: "${domain}" (expected "jewelry" or "studies")`);
  }
  const calendarId =
    domain === "jewelry" ? process.env.JEWELRY_CALENDAR_ID : process.env.STUDIES_CALENDAR_ID;
  return {
    domain,
    calendarId: calendarId || "",
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "",
    blockTitle: process.env.CALENDAR_BLOCK_TITLE || "פניות לקוחות",
    slotMinutes: positiveIntEnv("CALENDAR_SLOT_MINUTES", 15),
    lookaheadDays: positiveIntEnv("CALENDAR_LOOKAHEAD_DAYS", 14),
  };
}

// זורק שגיאה ברורה אם חסרים פרטי החיבור הנדרשים לגישה אמיתית ל-API.
export function assertConfigured(config) {
  const missing = [];
  if (!config.calendarId) {
    missing.push(config.domain === "jewelry" ? "JEWELRY_CALENDAR_ID" : "STUDIES_CALENDAR_ID");
  }
  if (!config.serviceAccountKeyFile) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  } else if (!fs.existsSync(path.resolve(PROJECT_ROOT, config.serviceAccountKeyFile))) {
    missing.push(`GOOGLE_SERVICE_ACCOUNT_KEY_FILE (file not found: ${config.serviceAccountKeyFile})`);
  }
  if (missing.length) {
    throw new Error(
      "היומן עדיין לא מחובר (" + config.domain + ") — חסר: " + missing.join(", ") +
      ". (אפשר לבדוק בלי פרטי גישה עם הדגל --dry-run)"
    );
  }
}
