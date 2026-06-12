import fs from "node:fs";
import path from "node:path";

// enhance.mjs — רינדור סופי כ*עריכה* של תמונת קונספט נבחרת (לא יצירה מאפס).
//
// למה: כל קריאה ל-/v1/images/generations מציירת תמונה חדשה מהטקסט — אין רצף, אז
// הטבעת יוצאת קצת אחרת בכל פעם. כדי שהלקוח יקבל *בדיוק* את ההדמיה שבחר, רק חדה
// ומלוטשת יותר — שולחים את התמונה הנבחרת ל-endpoint /v1/images/edits (model
// gpt-image-2), שמשמר את העיצוב ומשפר אותו.
//
// משתמש ב-fetch + FormData + Blob המובנים של Node (v18+) — בלי curl, ולכן בלי
// בעיות Schannel/נתיב-Windows/עברית שיש בקריאות curl במערכת הזו.
//
// שימוש:
//   node yuval/enhance.mjs <sourceImage> <outPath> [prompt] [size]
//   prompt ברירת מחדל = הוראת שימור-עיצוב + חידוד (ראה למטה).

const [, , src, out, promptArg, sizeArg] = process.argv;
if (!src || !out) {
  console.error("usage: node enhance.mjs <sourceImage> <outPath> [prompt] [size]");
  process.exit(1);
}
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("ERROR: OPENAI_API_KEY is not set.");
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error("ERROR: source image not found: " + src);
  process.exit(1);
}

// ברירת מחדל: שמר את העיצוב המדויק, רק שפר איכות. אל תשנה הרכב/אבנים/מתכת.
const DEFAULT_PROMPT =
  "Keep this exact ring design, composition, stones, metal and layout unchanged. " +
  "Only enhance it to a final high-end studio product photograph: increase sharpness " +
  "and fine detail, refine the lighting and reflections on the metal, make the gemstones " +
  "and diamonds crisp and brilliant, clean professional background, photorealistic, " +
  "luxury jewelry brand quality. Do not redesign — preserve the original piece precisely.";

const prompt = promptArg || DEFAULT_PROMPT;
const size = sizeArg || "1024x1024";

const buf = fs.readFileSync(src);
const ext = path.extname(src).toLowerCase();
const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

const fd = new FormData();
fd.append("model", "gpt-image-2");
fd.append("image", new Blob([buf], { type: mime }), "source" + (mime === "image/jpeg" ? ".jpg" : ".png"));
fd.append("prompt", prompt);
fd.append("size", size);

const res = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: fd,
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("ERROR: non-JSON response:\n" + text.slice(0, 800));
  process.exit(1);
}
const b64 = data?.data?.[0]?.b64_json;
if (!b64) {
  console.error("ERROR: no image in response:\n" + JSON.stringify(data).slice(0, 800));
  process.exit(1);
}
fs.writeFileSync(out, Buffer.from(b64, "base64"));
console.log("ENHANCED " + out + " (" + fs.statSync(out).size + " bytes)");
