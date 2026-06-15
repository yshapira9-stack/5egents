import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// config.mjs — קריאת הגדרות וואטסאפ מ-.env (WhatsApp Cloud API של Meta).
// כל שאר המודולים בתיקייה הזו מייבאים מכאן.

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, "..", ".."); // .../5agents

// טוען את .env מהשורש לתוך process.env (בלי לדרוס ערכים שכבר קיימים).
// כך המודולים עובדים גם בלי `set -a; source .env` מראש.
export function loadEnv() {
  const envPath = resolve(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

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

// מספר ל-WhatsApp API: ספרות בלבד (בלי + / רווחים / מקפים).
// מספר ישראלי מקומי (0XX...) מומר לפורמט בינלאומי (972XX...).
export function normalizeNumber(n) {
  let d = String(n || "").replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
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
