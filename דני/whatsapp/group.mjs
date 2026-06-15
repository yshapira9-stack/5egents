import { config, normalizeNumber } from "./config.mjs";
import { sendText, sendImage } from "./send.mjs";

// group.mjs — handoff בסיום ייעוץ (כשהלקוח רוצה להתקדם).
//
// ⚠️ מגבלה חשובה: WhatsApp Cloud API של Meta **לא תומך ביצירת קבוצות**
// פרוגרמטית. לכן הזרימה בינתיים:
//   דני שולח את הודעת הסיכום ל-יניב, ל-סטודיו ול-לקוח בנפרד, ויניב פותח את
//   הקבוצה ידנית עם שלושתם וממשיך משם.
// אם בעתיד יחובר ספק לא-רשמי שתומך בקבוצות (Baileys / whatsapp-web.js) —
// אפשר להחליף כאן את המימוש ביצירת קבוצה אמיתית.

export async function sendHandoff({ clientNumber, message, imagePath } = {}, opts = {}) {
  if (!message) throw new Error("sendHandoff: missing message");
  const recipients = [
    ["יניב", config.yaniv],
    ["סטודיו", config.studio],
  ];
  if (clientNumber) recipients.push(["לקוח", clientNumber]);

  const results = [];
  for (const [name, num] of recipients) {
    if (!num) {
      results.push({ name, skipped: "אין מספר" });
      continue;
    }
    await sendText(num, message, opts);
    if (imagePath) await sendImage(num, imagePath, "", opts);
    results.push({ name, to: normalizeNumber(num), sent: true });
  }
  return results;
}

// --- CLI: node group.mjs "<message>" [imagePath] [--dry-run] [--client <num>] ---
if (process.argv[1] && process.argv[1].endsWith("group.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const clientIdx = argv.indexOf("--client");
  const clientNumber = clientIdx !== -1 ? argv[clientIdx + 1] : "";
  const rest = argv.filter((x, i) => x !== "--dry-run" && x !== "--client" && i !== clientIdx + 1);
  const [message, imagePath] = rest;
  if (!message) {
    console.error('usage: node group.mjs "<message>" [imagePath] [--client <num>] [--dry-run]');
    process.exit(1);
  }
  try {
    const r = await sendHandoff({ clientNumber, message, imagePath }, { dryRun });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
