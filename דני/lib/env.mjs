import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// env.mjs — עוזרי סביבה משותפים לכל שכבות החיבור של דני (whatsapp / crm).
// טוען את .env מהשורש לתוך process.env, וחושף PROJECT_ROOT + normalizeNumber.

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

// מספר ל-API: ספרות בלבד (בלי + / רווחים / מקפים).
// מספר ישראלי מקומי (0XX...) מומר לפורמט בינלאומי (972XX...).
export function normalizeNumber(n) {
  let d = String(n || "").replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}
