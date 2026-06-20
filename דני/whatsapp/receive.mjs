import http from "node:http";
import { config } from "./config.mjs"; // טוען .env ביבוא

// receive.mjs — מקלט webhook לפי המודל של fixdigital.
//
// מודל החיבור (אושר ע"י פיקס): לקוח → וואטסאפ → fixdigital → webhook לכאן.
// פיקס שולח את הליד/ההודעה לכתובת ה-URL שנגדיר אצלם (אוטומציה), ב-GET (query
// string) או POST (גוף urlencoded/JSON), עם header/ים מותאמים לאימות שאנחנו
// בוחרים. מסמך: .../docs/אוטומציה-לשליחת-פניות-ב-api-מ-fixdigital-למערכת-חי/
//
// מה הקובץ עושה: מאמת secret, מפענח את שדות הליד (גמיש), מדפיס, ומעביר ל-handler.
// (שליחת התשובה חזרה ללקוח נעשית דרך ה-API של פיקס — endpoint שעדיין יתקבל מהם.)

const PORT = process.env.WHATSAPP_WEBHOOK_PORT || 3030;
const SECRET = process.env.FIXDIGITAL_WEBHOOK_SECRET || "";
// שם ה-header שפיקס ישלח עם ה-secret (אתה מגדיר אותו בממשק פיקס). ברירת מחדל:
const SECRET_HEADER = (process.env.FIXDIGITAL_WEBHOOK_HEADER || "x-webhook-secret").toLowerCase();

// מילון נרדפות → השדה התקני שלנו. פיקס שולח את השמות שתבחר בממשק; אלה הנפוצים.
export const FIELD_ALIASES = {
  name: ["name", "fullname", "full_name", "leadname", "שם", "שם_מלא"],
  phone: ["phone", "mobile", "tel", "telephone", "טלפון", "נייד"],
  email: ["email", "mail", "אימייל", "מייל"],
  message: ["message", "text", "body", "comments", "comment", "תוכן", "הודעה"],
};

export function pick(obj, keys) {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase())) return obj[k];
  }
  return "";
}

// מנרמל את גוף הבקשה לאובייקט שטוח { שדה: ערך } (תומך JSON ו-urlencoded).
export function parseBody(raw, contentType = "") {
  if (!raw) return {};
  const ct = contentType.toLowerCase();
  if (ct.includes("application/json")) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  // ברירת מחדל: form-urlencoded
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

// מאמת את ה-secret (header מותאם או query param `secret`). אם לא הוגדר SECRET —
// מאשר עם אזהרה (מצב פיתוח).
export function authorized(req, query) {
  if (!SECRET) return { ok: true, warn: "FIXDIGITAL_WEBHOOK_SECRET לא מוגדר — מצב פיתוח" };
  const headerVal = req.headers[SECRET_HEADER] || req.headers["authorization"] || "";
  if (headerVal === SECRET || headerVal === `Bearer ${SECRET}` || query.get("secret") === SECRET) {
    return { ok: true };
  }
  return { ok: false };
}

// ה-handler — כאן דני (דרך ראובן/הלוגיקה) יעבד את הליד הנכנס: לפתוח/לעדכן ליד,
// לנהל את השיחה, ולהשיב דרך ה-API של פיקס. כרגע: מדפיס סיכום.
function handleLead(lead, all) {
  const summary = [
    `📩 ליד נכנס מ-fixdigital`,
    `   שם: ${lead.name || "—"}`,
    `   טלפון: ${lead.phone || "—"}`,
    `   אימייל: ${lead.email || "—"}`,
    `   הודעה: ${lead.message || "—"}`,
  ].join("\n");
  console.log(summary);
  const extras = Object.keys(all).filter((k) => !["name", "phone", "email", "message"].includes(k));
  if (extras.length) console.log("   שדות נוספים:", JSON.stringify(all));
  // TODO: createLead(...) / ניהול שיחה / שליחת תשובה דרך פיקס.
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/webhook") {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  // GET — בדיקת זמינות / קליטת ליד דרך query string (פיקס תומך GET).
  if (req.method === "GET") {
    const auth = authorized(req, url.searchParams);
    // challenge אופציונלי (אם פיקס בודק את הכתובת) — מחזירים אותו כפי שהוא.
    const challenge = url.searchParams.get("challenge") || url.searchParams.get("hub.challenge");
    const params = Object.fromEntries(url.searchParams.entries());
    const hasLead = pick(params, FIELD_ALIASES.name) || pick(params, FIELD_ALIASES.phone);
    if (hasLead && auth.ok) {
      processIncoming(params);
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(challenge || "OK");
    return;
  }

  // POST — קליטת ליד דרך גוף הבקשה.
  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const auth = authorized(req, url.searchParams);
      if (!auth.ok) {
        console.error("⛔ webhook נדחה — אימות secret נכשל");
        res.writeHead(401);
        res.end("unauthorized");
        return;
      }
      if (auth.warn) console.warn("⚠️ " + auth.warn);
      const all = parseBody(body, req.headers["content-type"] || "");
      processIncoming(all);
      res.writeHead(200);
      res.end("EVENT_RECEIVED");
    });
    return;
  }

  res.writeHead(405);
  res.end("method not allowed");
});

function processIncoming(all) {
  try {
    const lead = {
      name: pick(all, FIELD_ALIASES.name),
      phone: pick(all, FIELD_ALIASES.phone),
      email: pick(all, FIELD_ALIASES.email),
      message: pick(all, FIELD_ALIASES.message),
    };
    handleLead(lead, all);
  } catch (e) {
    console.error("שגיאת עיבוד ליד נכנס:", e.message);
  }
}

// מפעיל את השרת רק כשמריצים את הקובץ ישירות — לא כשמייבאים ממנו helpers
// (server.mjs מייבא parseBody/authorized/pick/FIELD_ALIASES מכאן).
if (process.argv[1] && process.argv[1].endsWith("receive.mjs")) {
  server.listen(PORT, () => {
    console.log(`Dani webhook (fixdigital) מאזין על :${PORT}  path /webhook`);
    console.log(`אימות: header "${SECRET_HEADER}" ${SECRET ? "(secret מוגדר)" : "(ללא secret — מצב פיתוח)"}`);
  });
}
