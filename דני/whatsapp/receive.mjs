import http from "node:http";
import { config } from "./config.mjs";

// receive.mjs — webhook מינימלי לקבלת הודעות נכנסות מ-WhatsApp Cloud API.
//
// GET  /webhook  — אימות מול Meta (hub.verify_token == WHATSAPP_VERIFY_TOKEN).
// POST /webhook  — קבלת אירועי הודעה; מפענח ומדפיס. כאן דני יעבד וישיב.
//
// הערה: ה-webhook דורש כתובת URL ציבורית (deploy או מנהרת ngrok/cloudflared)
// שתירשם בלוח הבקרה של Meta. מקומית זה רק מאזין.

const PORT = process.env.WHATSAPP_WEBHOOK_PORT || 3030;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === config.verifyToken) {
      res.writeHead(200);
      res.end(challenge);
    } else {
      res.writeHead(403);
      res.end("forbidden");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/webhook") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const value = data?.entry?.[0]?.changes?.[0]?.value;
        const msg = value?.messages?.[0];
        if (msg) {
          const from = msg.from;
          const text = msg.text?.body || `[${msg.type}]`;
          console.log(`📩 ${from}: ${text}`);
          // TODO: כאן דני (דרך ראובן/הלוגיקה) יעבד את ההודעה הנכנסת וישיב עם send.mjs.
        }
      } catch (e) {
        console.error("parse error:", e.message);
      }
      res.writeHead(200);
      res.end("EVENT_RECEIVED");
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`Dani WhatsApp webhook מאזין על :${PORT} (path /webhook)`);
  console.log(`verify token = "${config.verifyToken}" (מ-WHATSAPP_VERIFY_TOKEN)`);
});
