import { loadEnv, PROJECT_ROOT, normalizeNumber } from "../lib/env.mjs";

// config.mjs — קריאת הגדרות וואטסאפ מ-.env (WhatsApp Business Platform דרך
// 360dialog — לא Meta ישירות). 360dialog הוא ה-BSP: אותו פורמט payload כמו
// Meta Cloud API, אבל endpoint משלהם (waba-v2.360dialog.io) ואימות דרך header
// "D360-API-KEY" (לא Authorization: Bearer). כל שאר המודולים בתיקייה הזו
// מייבאים מכאן. עוזרי הסביבה המשותפים חיים ב-../lib/env.mjs.

export { PROJECT_ROOT, normalizeNumber };

loadEnv();

export const config = {
  baseUrl: process.env.D360_BASE_URL || "https://waba-v2.360dialog.io",
  apiKey: process.env.D360_API_KEY || "", // D360-API-KEY (סודי)
  businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || process.env.WHATSAPP_TEST_NUMBER || "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "dani-verify",
  yaniv: process.env.YANIV_WHATSAPP || "",
  studio: process.env.STUDIO_WHATSAPP || "",
};

export function apiUrl(path) {
  return `${config.baseUrl.replace(/\/$/, "")}/${path}`;
}

// זורק שגיאה ברורה אם חסר מפתח ה-API.
export function assertConfigured() {
  const missing = [];
  if (!config.apiKey) missing.push("D360_API_KEY");
  if (missing.length) {
    throw new Error(
      "WhatsApp עדיין לא מחובר — חסר ב-.env: " + missing.join(", ") +
      ". (אפשר לבדוק בלי מפתח עם הדגל --dry-run)"
    );
  }
}
