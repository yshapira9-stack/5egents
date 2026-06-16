import { loadEnv, PROJECT_ROOT, normalizeNumber } from "../lib/env.mjs";

// config.mjs — קריאת הגדרות וואטסאפ מ-.env (WhatsApp Cloud API של Meta).
// כל שאר המודולים בתיקייה הזו מייבאים מכאן.
// עוזרי הסביבה המשותפים (loadEnv / PROJECT_ROOT / normalizeNumber) חיים ב-../lib/env.mjs.

export { PROJECT_ROOT, normalizeNumber };

loadEnv();

export const config = {
  apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
  token: process.env.WHATSAPP_TOKEN || "",                 // Access Token (סודי)
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "", // מזהה המספר ב-Meta
  businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "dani-verify",
  yaniv: process.env.YANIV_WHATSAPP || "",
  studio: process.env.STUDIO_WHATSAPP || "",
};

export function graphUrl(path) {
  return `https://graph.facebook.com/${config.apiVersion}/${path}`;
}

// זורק שגיאה ברורה אם חסרים פרטי הגישה (token / phone number id).
export function assertConfigured() {
  const missing = [];
  if (!config.token) missing.push("WHATSAPP_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (missing.length) {
    throw new Error(
      "WhatsApp עדיין לא מחובר — חסר ב-.env: " + missing.join(", ") +
      ". (אפשר לבדוק בלי טוקן עם הדגל --dry-run)"
    );
  }
}
