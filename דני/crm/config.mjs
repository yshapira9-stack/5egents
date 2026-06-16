import { loadEnv, PROJECT_ROOT } from "../lib/env.mjs";

// config.mjs — קריאת הגדרות ה-CRM (fixdigital) מ-.env.
// ה-API של fixdigital פשוט: מזהי החשבון/פרויקט (clientID/tenantID/projectID/
// projectTypeID) משמשים גם כאימות ליצירת ליד. ה-api_key נדרש רק לעדכון/שליפת לידים.
// תיעוד: https://info.fixdigital.co.il/docs/receiveapi/
// כל שאר המודולים בתיקייה הזו (client / create-lead) מייבאים מכאן.

export { PROJECT_ROOT };

loadEnv();

export const config = {
  baseUrl: process.env.CRM_API_BASE || "https://www.fixdigital.co.il/api/v1.2",
  leadPath: process.env.CRM_LEAD_PATH || "/lead/addApi", // או /lead/addwhatsapp

  // מזהי החשבון/פרויקט (מ-fixdigital) — נדרשים בכל יצירת ליד.
  clientID: process.env.CRM_CLIENT_ID || "",
  tenantID: process.env.CRM_TENANT_ID || "",
  projectID: process.env.CRM_PROJECT_ID || "",
  projectTypeID: process.env.CRM_PROJECT_TYPE_ID || "",
  channelId: process.env.CRM_CHANNEL_ID || "", // אופציונלי — סימון ערוץ המקור

  apiKey: process.env.CRM_API_KEY || "", // לעדכון/שליפת לידים (לא נדרש ליצירה)

  // שדות מקור חובה ב-addApi — ערכי ברירת מחדל המתאימים לליד מדני/וואטסאפ.
  formUrl: process.env.CRM_FORM_URL || "dani-whatsapp",
  urlRefer: process.env.CRM_URL_REFER || "whatsapp",
};

// זורק שגיאה ברורה אם חסרים מזהי החשבון הדרושים ליצירת ליד.
export function assertConfigured() {
  const missing = [];
  if (!config.clientID) missing.push("CRM_CLIENT_ID");
  if (!config.tenantID) missing.push("CRM_TENANT_ID");
  if (!config.projectID) missing.push("CRM_PROJECT_ID");
  if (!config.projectTypeID) missing.push("CRM_PROJECT_TYPE_ID");
  if (missing.length) {
    throw new Error(
      "ה-CRM עדיין לא מחובר — חסר ב-.env: " + missing.join(", ") +
      ". (אפשר לבדוק בלי פרטי גישה עם הדגל --dry-run)"
    );
  }
}
