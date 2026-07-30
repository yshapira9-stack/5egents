import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../lib/env.mjs";

// google-auth.mjs — קבלת access token זמני מ-Google OAuth2 עבור Service Account,
// בלי שום ספריית SDK חיצונית (חתימת JWT ידנית עם node:crypto, עקבי לשאר השכבות
// בפרויקט הזה שמדברות ישירות מול REST עם fetch גולמי).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// בונה וחותם JWT (RS256) לפי מפרט Google Service Account. פונקציה טהורה — ניתנת
// לבדיקה עם זוג מפתחות RSA שנוצר בזמן הבדיקה, בלי credentials אמיתיים.
export function signJwt({ clientEmail, privateKey, scope = SCOPE, now = Math.floor(Date.now() / 1000) }) {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: clientEmail, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

function loadServiceAccount(keyFile) {
  const full = path.resolve(PROJECT_ROOT, keyFile);
  let raw;
  try {
    raw = fs.readFileSync(full, "utf8");
  } catch (err) {
    throw new Error(`could not read service account key file: ${keyFile} (${err.message})`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`service account key file is not valid JSON: ${keyFile} (${err.message})`);
  }
  if (!data.client_email || !data.private_key) {
    throw new Error(`service account file missing client_email/private_key: ${keyFile}`);
  }
  return { clientEmail: data.client_email, privateKey: data.private_key };
}

// מחליף JWT חתום ב-access token אמיתי מול Google. אין dry-run משלו — הסקריפטים
// שקוראים לו (check-availability / book-meeting) בודקים --dry-run *לפני* שמגיעים לכאן.
export async function getAccessToken(keyFile) {
  const { clientEmail, privateKey } = loadServiceAccount(keyFile);
  const assertion = signJwt({ clientEmail, privateKey });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Google OAuth error: " + JSON.stringify(data).slice(0, 500));
  }
  return data.access_token;
}
