import { loadEnv, PROJECT_ROOT } from "../lib/env.mjs";

// config.mjs — קריאת הגדרות ה-CRM (fixdigital) מ-.env.
// ה-API של fixdigital פשוט: מזהי הנכס/חברה (assetId/assetTypeId/companyId) משמשים
// גם כאימות ליצירת ליד. ה-api_key נדרש רק לעדכון/שליפת לידים.
// מזהים אלה נלקחים ישירות מתוך "הגדרת חיבור API" של הנכס הדיגיטלי בממשק פיקס
// (נכסים → הנכס הרלוונטי → טאב "חיבור אתר"), לא ממייל תמיכה.
//
// שני קווי עסק חולקים את אותו חשבון פיקס אבל כל אחד עם נכס API + תהליך משלו:
// דני (תכשיטים, ברירת מחדל) ויהודה (לימודים/סדנאות, סיומת _YEHUDA ב-.env).
// כל שאר המודולים בתיקייה הזו (client / create-lead) קוראים ל-getConfig(agent).

export { PROJECT_ROOT };

loadEnv();

export function getConfig(agent = "dani") {
  const suffix = agent === "yehuda" ? "_YEHUDA" : "";
  const env = (name, fallback) => process.env[`${name}${suffix}`] || fallback || "";
  return {
    agent,
    baseUrl: process.env.CRM_API_BASE || "https://www.fixdigital.co.il/api/v1.2",
    leadPath: process.env.CRM_LEAD_PATH || "/lead/addApi", // או /lead/addwhatsapp

    // מזהי הנכס/חברה (מטאב "חיבור אתר" של הנכס הדיגיטלי בפיקס) — נדרשים בכל יצירת ליד.
    assetId: env("CRM_ASSET_ID"),
    assetTypeId: env("CRM_ASSET_TYPE_ID"),
    companyId: env("CRM_COMPANY_ID"),
    channelId: env("CRM_CHANNEL_ID"), // אופציונלי — סימון ערוץ המקור

    apiKey: env("CRM_API_KEY"), // לעדכון/שליפת לידים (לא נדרש ליצירה)

    // שדות מקור חובה ב-addApi — ערכי ברירת מחדל לפי הסוכן.
    formUrl: env("CRM_FORM_URL", `${agent}-whatsapp`),
    urlRefer: env("CRM_URL_REFER", "whatsapp"),
  };
}

// זורק שגיאה ברורה אם חסרים מזהי הנכס הדרושים ליצירת ליד.
export function assertConfigured(config) {
  const suffix = config.agent === "yehuda" ? "_YEHUDA" : "";
  const missing = [];
  if (!config.assetId) missing.push(`CRM_ASSET_ID${suffix}`);
  if (!config.assetTypeId) missing.push(`CRM_ASSET_TYPE_ID${suffix}`);
  if (!config.companyId) missing.push(`CRM_COMPANY_ID${suffix}`);
  if (missing.length) {
    throw new Error(
      "ה-CRM עדיין לא מחובר (" + config.agent + ") — חסר ב-.env: " + missing.join(", ") +
      ". (אפשר לבדוק בלי פרטי גישה עם הדגל --dry-run)"
    );
  }
}
