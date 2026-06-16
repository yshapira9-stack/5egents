import fs from "node:fs";

// mapping.mjs — פענוח קובץ ליד (Markdown) ומיפויו לפרמטרי ה-CRM של fixdigital.
//
// השדות הסטנדרטיים (name / phone / email) מתועדים. ⚠️ שדות מותאמים (comments
// וה-cf_* האנגליים) חייבים להיות מוגדרים מראש ב-CRM כשמות אנגלית ללא רווחים —
// אם שם שדה לא קיים אצלך, מוחקים אותו מכאן. זה המקום היחיד שמתעדכן לפי החשבון.

// פענוח קובץ ליד → אובייקט שטוח של { תווית: ערך } + שם הלקוח.
// תומך בשורות עם כמה שדות (`**א:** ... **ב:** ...`).
export function parseLeadFile(filePath) {
  const md = fs.readFileSync(filePath, "utf8");
  return parseLeadMarkdown(md);
}

export function parseLeadMarkdown(md) {
  const fields = {};
  for (const line of md.split(/\r?\n/)) {
    const re = /\*\*\s*([^*:]+?)\s*:\*\*\s*(.*?)(?=\s*\*\*|$)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const key = m[1].trim();
      // מסיר מפריד גורר (· • |) שנשאר לפני השדה הבא באותה שורה.
      const val = m[2].trim().replace(/[\s·•|]+$/, "").trim();
      if (key && val && !(key in fields)) fields[key] = val;
    }
  }
  // שם הלקוח: עדיפות לשדה המפורש, אחרת מכותרת "# ליד — <שם>".
  let name = fields["שם לקוח"] || "";
  if (!name) {
    const h = md.match(/^#\s*ליד\s*[—–-]\s*(.+)$/m);
    if (h) name = h[1].trim();
  }
  name = name.replace(/\s*\(.*?\)\s*$/, "").trim(); // מסיר הערה בסוגריים מהכותרת
  return { fields, name, _raw: md };
}

// מיפוי הליד לפרמטרי ה-CRM של fixdigital (name/phone/email + שדות מותאמים).
export function leadToCrmParams(lead) {
  const f = lead.fields || {};
  const get = (...keys) => {
    for (const k of keys) if (f[k] && f[k] !== "—" && !/^<.*>$/.test(f[k])) return f[k];
    return "";
  };

  // תקציר עשיר — כל מה שאספנו, כטקסט קריא לתוך שדה comments.
  const brief = [
    ["סיפור אישי", get("סיפור אישי")],
    ["למי מיועד", get("למי מיועד")],
    ["אירוע", get("אירוע")],
    ["ערכים", get("ערכים")],
    ["סמלים", get("סמלים")],
    ["צבעים אהובים", get("צבעים אהובים")],
    ["סוג תכשיט", get("סוג תכשיט")],
    ["מתכת", get("מתכת")],
    ["תקציב", get("תקציב")],
    ["לוח זמנים", get("לוח זמנים", "לו\"ז")],
    ["מידה", get("מידה")],
    ["כיוון נבחר", extractSection(lead._raw, "הכיוון שנבחר")],
    ["חריטה", extractSection(lead._raw, "חריטה")],
    // שדות לידי בית הספר (יהודה) — נוספים בלבד; בלידי תכשיטים של דני הם ריקים
    // ולכן מסוננים החוצה ע"י .filter, כך שאין שינוי בהתנהגות הקיימת.
    ["מקור", get("מקור")],
    ["תחום עניין", get("תחום עניין")],
    ["מסלול מומלץ", extractSection(lead._raw, "מסלול מומלץ")],
    ["עיר מגורים", get("עיר מגורים", "עיר")],
    ["ניסיון קודם", get("ניסיון קודם")],
    ["מטרה", get("מטרה")],
    ["זמינות", get("זמינות")],
    ["איך שמע עלינו", get("איך שמעת עלינו", "איך שמע עלינו")],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" | ");

  return {
    // שדות סטנדרטיים מתועדים.
    name: lead.name || "לקוח",
    phone: get("פרטי קשר (וואטסאפ)", "פרטי קשר", "טלפון"),
    email: get("אימייל", "מייל"), // לרוב ריק בליד וואטסאפ
    comments: brief,

    // שדות מותאמים — חייבים להיות מוגדרים מראש ב-CRM (אנגלית, בלי רווחים).
    // אם שם לא קיים אצלך — מחק אותו כאן.
    jewelry_type: get("סוג תכשיט"),
    metal: get("מתכת"),
    budget: get("תקציב"),
    timeline: get("לוח זמנים", "לו\"ז"),
    event: get("אירוע"),
  };
}

// מחלץ טקסט מתחת לכותרת `## <title>` עד הכותרת הבאה (לשדות חופשיים).
function extractSection(md, title) {
  if (!md) return "";
  const re = new RegExp(`^##\\s*${title}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "m");
  const m = md.match(re);
  if (!m) return "";
  return m[1].trim()
    .replace(/\*\*/g, "")          // מסיר סימוני bold של markdown
    .replace(/^\s*[-*]\s*/gm, "")  // מסיר תבליטים בתחילת שורה
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
