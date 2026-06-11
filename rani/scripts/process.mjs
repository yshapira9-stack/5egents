// process.mjs — עיבוד תמונת תכשיט לגרסה שיווקית בפלטפורמה נתונה.
// משלב: שינוי גודל + חיתוך ממרכז (cover), הוספת לוגו (פינה ימנית תחתונה),
// וכיתוב מותג. כתוב ב-jimp (pure-JS) כי אין Python/Pillow/ImageMagick במערכת.
//
// שימוש:
//   node rani/scripts/process.mjs <input> <output> <width> <height> [brandText]
//
// יציאה: 0 = הצלחה. מדפיס שורת JSON עם מה שבוצע (logo/text) ל-stdout.

import { Jimp, loadFont, HorizontalAlign, VerticalAlign } from "jimp";
import { SANS_32_WHITE } from "jimp/fonts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", ".."); // .../5agents
const LOGO_PATH = resolve(PROJECT_ROOT, "rani", "assets", "לוגו יניב המעצב.png");
const MARGIN = 20;
const LOGO_MAX_W = 200;

async function main() {
  const [, , input, output, wStr, hStr, brandTextArg] = process.argv;
  if (!input || !output || !wStr || !hStr) {
    console.error("usage: node process.mjs <input> <output> <width> <height> [brandText]");
    process.exit(2);
  }
  const W = parseInt(wStr, 10);
  const H = parseInt(hStr, 10);
  const brandText = brandTextArg ?? "Designing Dreams in Jewelry"; // ברירת מחדל לטינית (jimp לא תומך עברית); תרגום של "מעצב חלומות בתכשיטים"

  const report = { output, size: `${W}x${H}`, logo: false, text: false, warnings: [] };

  // 1. טען + cover (resize ושמירת יחס, חיתוך ממרכז)
  const img = await Jimp.read(input);
  img.cover({ w: W, h: H });

  // 2. לוגו בפינה ימנית תחתונה
  if (existsSync(LOGO_PATH)) {
    try {
      const logo = await Jimp.read(LOGO_PATH);
      if (logo.bitmap.width > LOGO_MAX_W) {
        logo.resize({ w: LOGO_MAX_W });
      }
      const x = W - logo.bitmap.width - MARGIN;
      const y = H - logo.bitmap.height - MARGIN;
      img.composite(logo, x, y);
      report.logo = true;
    } catch (e) {
      report.warnings.push(`logo failed: ${e.message}`);
    }
  } else {
    report.warnings.push(`logo missing at ${LOGO_PATH}`);
  }

  // 3. כיתוב מותג (גופן bitmap מובנה — לטיני בלבד; עברית לא נתמכת ותדולג)
  try {
    const font = await loadFont(SANS_32_WHITE);
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
