// process.mjs — עיבוד תמונת תכשיט לגרסה שיווקית בפלטפורמה נתונה.
// משלב: שינוי גודל + חיתוך ממרכז (cover), הוספת לוגו (פינה ימנית תחתונה),
// וכיתוב מותג. צבע הלוגו והכיתוב נבחר אוטומטית — לבן או שחור — לפי בהירות
// האזור שמתחתיהם, כדי להבטיח ניגודיות וקריאוּת. כתוב ב-jimp (pure-JS) כי
// אין Python/Pillow/ImageMagick במערכת.
//
// שימוש:
//   node rani/scripts/process.mjs <input> <output> <width> <height> [brandText]
//
// יציאה: 0 = הצלחה. מדפיס שורת JSON עם מה שבוצע (logo/text/colors) ל-stdout.

import { Jimp, loadFont, HorizontalAlign, VerticalAlign } from "jimp";
import { SANS_32_WHITE, SANS_32_BLACK } from "jimp/fonts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", ".."); // .../5agents
const LOGO_PATH = resolve(PROJECT_ROOT, "rani", "assets", "לוגו יניב המעצב.png");
const MARGIN = 20;
const LOGO_MAX_W = 200;
const TEXT_H_EST = 40; // גובה משוער של שורת הכיתוב לצורך דגימת האזור

// בהירות נתפסת ממוצעת (0=שחור .. 255=לבן) של מלבן בתמונה.
// מדלג על פיקסלים שקופים (alpha נמוך). מחזיר 128 אם אין מספיק נתונים.
function regionLuminance(img, rx, ry, rw, rh) {
  const { data, width, height } = img.bitmap;
  const x0 = Math.max(0, Math.floor(rx));
  const y0 = Math.max(0, Math.floor(ry));
  const x1 = Math.min(width, Math.floor(rx + rw));
  const y1 = Math.min(height, Math.floor(ry + rh));
  let sum = 0, n = 0;
  // דגימה בקפיצות של 3 פיקסלים — מהיר ומספיק מדויק
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 16) continue; // שקוף
      // Rec. 601 luma
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
  }
  return n === 0 ? 128 : sum / n;
}

// בוחר "white" כשהרקע כהה, "black" כשהרקע בהיר.
function pickColor(lum) {
  return lum < 128 ? "white" : "black";
}

// מצבע מחדש את הלוגו (אומנות מונוכרום על רקע שקוף) לצבע נתון — שומר על ה-alpha.
function tintLogo(logo, color) {
  const v = color === "white" ? 255 : 0;
  const { data } = logo.bitmap;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
}

async function main() {
  const [, , input, output, wStr, hStr, brandTextArg] = process.argv;
  if (!input || !output || !wStr || !hStr) {
    console.error("usage: node process.mjs <input> <output> <width> <height> [brandText]");
    process.exit(2);
  }
  const W = parseInt(wStr, 10);
  const H = parseInt(hStr, 10);
  const brandText = brandTextArg ?? "Designing Dreams in Jewelry"; // תרגום של "מעצב חלומות בתכשיטים" (jimp לא תומך עברית)

  const report = { output, size: `${W}x${H}`, logo: false, text: false, logoColor: null, textColor: null, warnings: [] };

  // 1. טען + cover (resize ושמירת יחס, חיתוך ממרכז)
  const img = await Jimp.read(input);
  img.cover({ w: W, h: H });

  // 2. לוגו בפינה ימנית תחתונה — צבע אדפטיבי לפי בהירות האזור
  if (existsSync(LOGO_PATH)) {
    try {
      const logo = await Jimp.read(LOGO_PATH);
      if (logo.bitmap.width > LOGO_MAX_W) {
        logo.resize({ w: LOGO_MAX_W });
      }
      const lx = W - logo.bitmap.width - MARGIN;
      const ly = H - logo.bitmap.height - MARGIN;
      const logoColor = pickColor(regionLuminance(img, lx, ly, logo.bitmap.width, logo.bitmap.height));
      tintLogo(logo, logoColor);
      img.composite(logo, lx, ly);
      report.logo = true;
      report.logoColor = logoColor;
    } catch (e) {
      report.warnings.push(`logo failed: ${e.message}`);
    }
  } else {
    report.warnings.push(`logo missing at ${LOGO_PATH}`);
  }

  // 3. כיתוב מותג בפינה שמאלית עליונה — צבע אדפטיבי לפי בהירות האזור
  //    (גופן bitmap מובנה — לטיני בלבד; עברית לא נתמכת)
  try {
    const textColor = pickColor(regionLuminance(img, MARGIN, MARGIN, W - MARGIN * 2, TEXT_H_EST));
    const font = await loadFont(textColor === "white" ? SANS_32_WHITE : SANS_32_BLACK);
    img.print({
      font,
      x: MARGIN,
      y: MARGIN,
      text: {
        text: brandText,
        alignmentX: HorizontalAlign.LEFT,
        alignmentY: VerticalAlign.TOP,
      },
      maxWidth: W - MARGIN * 2,
    });
    report.text = true;
    report.textColor = textColor;
  } catch (e) {
    report.warnings.push(`text failed: ${e.message}`);
  }

  await img.write(output);
  console.log(JSON.stringify(report));
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
