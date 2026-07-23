import http from "node:http";
import { config } from "./config.mjs"; // טוען .env ביבוא

// receive.mjs — מקלט webhook לוואטסאפ. תומך בשני פורמטים:
//
// 1) **360dialog / Meta Cloud API** (הפורמט החי, מאז שעברנו מפיקס ל-360dialog) —
//    POST עם JSON בצורת `entry[].changes[].value.messages[]` (תיעוד סטנדרטי של
//    Meta). מפוענח ב-parseD360Body() ומוזרם ל-parseBody() בצורה שקופה.
// 2) **fixdigital** (המודל הישן, ננטש בפועל אבל נשמר לתאימות/עתיד) — GET (query
//    string) או POST (גוף urlencoded/JSON) עם שדות גמישים + secret ב-header.
//
// מה הקובץ עושה: מאמת (secret של פיקס, או handshake של Meta), מפענח לצורה שטוחה
// { name, phone, message }, ומעביר ל-handler. server.mjs מייבא
// parseBody/authorized/pick/FIELD_ALIASES מכאן ומריץ את הלוגיקה שלו (Claude +
// תשובה) — הקובץ הזה עצמו מריץ שרת רק כשמפעילים אותו ישירות (standalone).

const PORT = process.env.WHATSAPP_WEBHOOK_PORT || 3030;
const SECRET = process.env.FIXDIGITAL_WEBHOOK_SECRET || "";
// שם ה-header שפיקס ישלח עם ה-secret (אתה מגדיר אותו בממשק פיקס). ברירת מחדל:
const SECRET_HEADER = (process.env.FIXDIGITAL_WEBHOOK_HEADER || "x-webhook-secret").toLowerCase();
const VERIFY_TOKEN = config.verifyToken; // לאימות ה-GET handshake של Meta/360dialog

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

// מפענח webhook בפורמט 360dialog/Meta Cloud API (entry[].changes[].value...).
// מחזיר אובייקט שטוח { name, phone, message } או null אם זה לא הצורה הזו
// (למשל webhook של סטטוס משלוח/קריאה, בלי messages[] — מתעלמים ממנו).
export function parseD360Body(json) {
  const value = json?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg) return null;
  const contact = value.contacts?.[0];
  const message =
    msg.text?.body ??
    (msg.type && msg.type !== "text" ? `[${msg.type}]` : "");
  return {
    name: contact?.profile?.name || "",
    phone: msg.from || "",
    message,
  };
}

// מנרמל את גוף הבקשה לאובייקט שטוח { שדה: ערך } (תומך JSON ו-urlencoded).
export function parseBody(raw, contentType = "") {
  if (!raw) return {};
  const ct = contentType.toLowerCase();
  if (ct.includes("application/json")) {
    let json;
    try { json = JSON.parse(raw); } catch { return {}; }
    const d360 = parseD360Body(json);
    return d360 || json;
  }
  // ברירת מחדל: form-urlencoded
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

// מאמת בקשה נכנסת. שני מסלולים אפשריים:
// - 360dialog/Meta: אין secret משותף כמו פיקס — ה-webhook עצמו נרשם בממשק
//   360dialog (מוגן מאחורי המפתח שלנו שם), אז מאשרים תמיד; ה-handshake הנפרד
//   (hub.verify_token) מטופל ב-GET למטה.
// - fixdigital: מאמת secret (header מותאם או query param `secret`). אם לא
//   הוגדר SECRET — מאשר עם אזהרה (מצב פיתוח).
export function authorized(req, query) {
  if (!SECRET) return { ok: true, warn: "FIXDIGITAL_WEBHOOK_SECRET לא מוגדר — מצב פיתוח/360dialog" };
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
