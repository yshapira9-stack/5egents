import fs from "node:fs";
import path from "node:path";
import { loadEnv, PROJECT_ROOT } from "../lib/env.mjs";

// config.mjs — הגדרות חיבור היומן (Google Calendar) לפי תחום.
// שני תחומים אפשריים: "jewelry" (תכשיטים, לדני) ו-"studies" (לימודים+סדנאות, ליהודה).
// שני התחומים חולקים אותו Service Account אבל כל אחד עם יומן Google Calendar נפרד.

export { PROJECT_ROOT };

loadEnv();

const DOMAINS = ["jewelry", "studies"];

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
    slotMinutes: Number(process.env.CALENDAR_SLOT_MINUTES) || 15,
    lookaheadDays: Number(process.env.CALENDAR_LOOKAHEAD_DAYS) || 14,
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
