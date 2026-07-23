import http from "node:http";
import fs from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv, PROJECT_ROOT, normalizeNumber } from "./lib/env.mjs";
import { sendText, sendImage } from "./whatsapp/send.mjs";
import { parseBody, FIELD_ALIASES, pick, authorized } from "./whatsapp/receive.mjs";

// server.mjs — "המוח" של דני: מאחד את כל הצינורות לבוט שעונה לבד.
//
//   webhook מפיקס → טוען היסטוריית שיחה → מריץ את דני (Claude API + playbook)
//   → מייצר תמונת קונספט מיובל אם צריך (פרוטוקול [[IMAGE: ...]]) → עונה ללקוח
//   בוואטסאפ → (handoff) דוחף ליד ל-CRM.
//
// מצב בדיקה מדורג: בלי ANTHROPIC_API_KEY המוח מחזיר תשובת stub; ב-DANI_DRY_RUN=1
// (או בלי D360_API_KEY) השליחות והתמונות מודפסות במקום להישלח/להיווצר.
//
// הרצה:  node "דני/server.mjs"   (ראה דני/whatsapp/README.md למשתני הסביבה)

loadEnv();

const PORT = process.env.WHATSAPP_WEBHOOK_PORT || 3030;
const MODEL = process.env.DANI_MODEL || "claude-opus-4-8";
const DRY = process.env.DANI_DRY_RUN === "1" || !process.env.D360_API_KEY;
const CONV_DIR = resolve(PROJECT_ROOT, "דני", "conversations");
const OUT_DIR = resolve(PROJECT_ROOT, "yuval", "outputs");

// --- system prompt: ה-playbook של דני מתוך ההגדרה, בלי ה-frontmatter ---
function buildSystem() {
  const md = fs.readFileSync(resolve(PROJECT_ROOT, ".claude/agents/dani.md"), "utf8")
    .replace(/^---[\s\S]*?\n---\s*/, ""); // הסרת frontmatter
  return (
    md +
    "\n\n## הוראות הפעלה אוטומטית (שרת)\n" +
    "- אתה דני בשיחת וואטסאפ אמיתית עם לקוח. כתוב בעברית, חם ואישי, הודעות קצרות.\n" +
    "- כשתרצה להראות ללקוח תמונת קונספט, פלוט בשורה נפרדת הנחיה בפורמט:\n" +
    "  [[IMAGE: <תיאור באנגלית, עשיר, בסגנון צילום מוצר תכשיט>]]\n" +
    "  השרת ייצר, ימתג וישלח את התמונה אוטומטית. אל תזכיר את ההנחיה ללקוח.\n" +
    "- אל תמציא מחיר סופי — המחיר נסגר מול יניב."
  );
}
const SYSTEM = buildSystem();

// --- זיכרון שיחה לכל לקוח ---
function convPath(phone) {
  return resolve(CONV_DIR, normalizeNumber(phone) + ".json");
}
function loadConv(phone) {
  try { return JSON.parse(fs.readFileSync(convPath(phone), "utf8")); }
  catch { return []; }
}
function saveConv(phone, messages) {
  fs.mkdirSync(CONV_DIR, { recursive: true });
  fs.writeFileSync(convPath(phone), JSON.stringify(messages, null, 2));
}

// --- מוח דני: Claude API (raw fetch); stub כשאין מפתח ---
function stubReply(history) {
  const last = history[history.length - 1]?.content || "";
  if (/תמונה|הדמיה|image|לראות|תפתיע/i.test(last)) {
    return "הנה כיוון ראשוני שחשבתי עליו בשבילך 🙂\n[[IMAGE: elegant 18k yellow gold ring with a deep-red ruby, luxury studio product photo, soft lighting, white background, photorealistic]]\nמה דעתך? ✨";
  }
  return "היי! 🙏 (מצב בדיקה — עדיין אין ANTHROPIC_API_KEY, אז זו תשובת דמה). קיבלתי: \"" +
    String(last).slice(0, 80) + "\". כשנחבר את המוח של דני, כאן תופיע תשובה אמיתית.";
}
async function callDani(history) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return stubReply(history);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      messages: history,
    }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("non-JSON from Anthropic: " + text.slice(0, 400)); }
  if (!res.ok || data.error) {
    throw new Error("Anthropic error: " + JSON.stringify(data.error || data).slice(0, 400));
  }
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim()
    || "(דני לא החזיר טקסט)";
}

// --- פרוטוקול תמונה: מחלץ [[IMAGE: ...]], מייצר+ממתג+שולח, ומחזיר את הטקסט הנקי ---
const IMAGE_RE = /\[\[IMAGE:\s*([^\]]+)\]\]/gi;
async function handleImages(phone, reply) {
  const prompts = [...reply.matchAll(IMAGE_RE)].map((m) => m[1].trim());
  const cleanText = reply.replace(IMAGE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  for (let i = 0; i < prompts.length; i++) {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `${stamp}-dani-${normalizeNumber(phone)}-${Date.now()}-${i}`;
    const raw = resolve(OUT_DIR, base + ".png");
    const branded = resolve(OUT_DIR, base + "-branded.png");
    if (DRY) {
      console.log(`🖼️ [dry-run] would generate + brand + send image: "${prompts[i]}"`);
      continue;
    }
    try {
      execFileSync(process.execPath, ["yuval/gen.mjs", raw, prompts[i], "medium"],
        { cwd: PROJECT_ROOT, stdio: "inherit", env: process.env });
      execFileSync(process.execPath, ["rani/scripts/process.mjs", raw, branded, "1024", "1024"],
        { cwd: PROJECT_ROOT, stdio: "inherit", env: process.env });
      await sendImage(phone, branded, "", { dryRun: DRY });
    } catch (e) {
      console.error("image pipeline failed:", e.message);
    }
  }
  return cleanText;
}

// --- עיבוד הודעה נכנסת מקצה לקצה ---
async function processMessage(all) {
  const phone = pick(all, FIELD_ALIASES.phone);
  const message = pick(all, FIELD_ALIASES.message) || pick(all, FIELD_ALIASES.name);
  if (!phone) { console.warn("דילוג: אין מספר טלפון בליד"); return; }

  const history = loadConv(phone);
  history.push({ role: "user", content: String(message || "") });

  let reply;
  try { reply = await callDani(history); }
  catch (e) { console.error("brain error:", e.message); reply = "סליחה, יש לי תקלה רגעית 🙏 אחזור אליך עוד רגע."; }

  history.push({ role: "assistant", content: reply });
  saveConv(phone, history);

  const textForClient = await handleImages(phone, reply);
  if (textForClient) await sendText(phone, textForClient, { dryRun: DRY });
  console.log(`💬 ${normalizeNumber(phone)} → דני: ${textForClient.slice(0, 120)}`);
}

// --- שרת ה-webhook ---
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/webhook") { res.writeHead(404); res.end("not found"); return; }

  if (req.method === "GET") {
    const auth = authorized(req, url.searchParams);
    const params = Object.fromEntries(url.searchParams.entries());
    if (auth.ok && (pick(params, FIELD_ALIASES.phone))) processMessage(params).catch((e) => console.error(e));
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(url.searchParams.get("challenge") || "OK");
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const auth = authorized(req, url.searchParams);
      if (!auth.ok) { res.writeHead(401); res.end("unauthorized"); return; }
      if (auth.warn) console.warn("⚠️ " + auth.warn);
      // לענות 200 מהר; לעבד את ההודעה אחרי (ייצור תמונה עלול לקחת זמן).
      res.writeHead(200); res.end("EVENT_RECEIVED");
      const all = parseBody(body, req.headers["content-type"] || "");
      processMessage(all).catch((e) => console.error("processMessage:", e.message));
    });
    return;
  }

  res.writeHead(405); res.end("method not allowed");
});

server.listen(PORT, () => {
  console.log(`דני server מאזין על :${PORT}  path /webhook`);
  console.log(`מוח: ${process.env.ANTHROPIC_API_KEY ? MODEL : "stub (אין ANTHROPIC_API_KEY)"} · שליחה: ${DRY ? "dry-run" : "חי"}`);
});
