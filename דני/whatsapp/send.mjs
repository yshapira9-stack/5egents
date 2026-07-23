import fs from "node:fs";
import path from "node:path";
import { config, apiUrl, normalizeNumber, assertConfigured } from "./config.mjs";

// send.mjs — שליחת הודעות וואטסאפ (טקסט / תמונה) דרך 360dialog (WhatsApp
// Business Platform — לא Meta ישירות).
//
// CLI:
//   node send.mjs <to> <text...> [--dry-run]
//   node send.mjs --image <to> <file|url> [caption...] [--dry-run]
//
// --dry-run מדפיס את ה-payload במקום לשלוח (לבדיקה בלי מפתח).

async function api(pathUrl, options) {
  const res = await fetch(apiUrl(pathUrl), options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("non-JSON response: " + text.slice(0, 500));
  }
  if (!res.ok || data.error) {
    throw new Error("WhatsApp API error: " + JSON.stringify(data.error || data).slice(0, 800));
  }
  return data;
}

// העלאת קובץ מדיה מקומי → מחזיר media id (נדרש לשליחת תמונה מקובץ מקומי).
export async function uploadMedia(filePath) {
  assertConfigured();
  if (!fs.existsSync(filePath)) throw new Error("media file not found: " + filePath);
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", mime);
  fd.append("file", new Blob([buf], { type: mime }), path.basename(filePath));
  const data = await api("media", {
    method: "POST",
    headers: { "D360-API-KEY": config.apiKey },
    body: fd,
  });
  return data.id;
}

export async function sendText(to, body, { dryRun = false } = {}) {
  const payload = {
    messaging_product: "whatsapp",
    to: normalizeNumber(to),
    type: "text",
    text: { body, preview_url: false },
  };
  if (dryRun) return printDry("text", to, payload);
  assertConfigured();
  return api("messages", {
    method: "POST",
    headers: { "D360-API-KEY": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendImage(to, fileOrUrl, caption = "", { dryRun = false } = {}) {
  const isUrl = /^https?:\/\//i.test(fileOrUrl);
  if (dryRun) {
    return printDry("image", to, {
      messaging_product: "whatsapp",
      to: normalizeNumber(to),
      type: "image",
      image: isUrl ? { link: fileOrUrl, caption } : { source_file: fileOrUrl, caption },
    });
  }
  assertConfigured();
  let image;
  if (isUrl) {
    image = { link: fileOrUrl, caption };
  } else {
    const id = await uploadMedia(fileOrUrl);
    image = { id, caption };
  }
  const payload = { messaging_product: "whatsapp", to: normalizeNumber(to), type: "image", image };
  return api("messages", {
    method: "POST",
    headers: { "D360-API-KEY": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function printDry(kind, to, payload) {
  console.log(`DRY-RUN — would send ${kind} to ${normalizeNumber(to)}:`);
  console.log(JSON.stringify(payload, null, 2));
  return { dryRun: true };
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("send.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const a = argv.filter((x) => x !== "--dry-run");
  try {
    if (a[0] === "--image") {
      const [, to, file, ...cap] = a;
      if (!to || !file) {
        console.error("usage: node send.mjs --image <to> <file|url> [caption...] [--dry-run]");
        process.exit(1);
      }
      await sendImage(to, file, cap.join(" "), { dryRun });
    } else {
      const [to, ...textParts] = a;
      if (!to || textParts.length === 0) {
        console.error("usage: node send.mjs <to> <text...> [--dry-run]");
        process.exit(1);
      }
      await sendText(to, textParts.join(" "), { dryRun });
    }
    if (!dryRun) console.log("SENT");
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
