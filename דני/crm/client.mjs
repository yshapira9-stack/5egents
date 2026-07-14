import { getConfig, assertConfigured } from "./config.mjs";

// client.mjs — יצירת ליד ב-CRM של fixdigital.
// ה-API מקבל את הפרמטרים כ-query-string (לא כ-JSON body), כולל מזהי הנכס/חברה.
// תיעוד: https://info.fixdigital.co.il/docs/receiveapi/

// בונה את מפת הפרמטרים המלאה (מזהי נכס/חברה + שדות מקור + שדות הליד).
export function buildLeadParams(config, params) {
  return {
    assetId: config.assetId,
    assetTypeId: config.assetTypeId,
    companyId: config.companyId,
    FORMURL: config.formUrl,
    URLREFER: config.urlRefer,
    ...(config.channelId ? { channelid: config.channelId } : {}),
    ...params,
  };
}

function buildLeadUrl(config, all) {
  const u = new URL(config.baseUrl.replace(/\/$/, "") + config.leadPath);
  for (const [k, v] of Object.entries(all)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

// agent: "dani" (ברירת מחדל, תכשיטים) או "yehuda" (לימודים/סדנאות) — בוחר איזה
// נכס API/תהליך בפיקס ישמש (ראה config.mjs).
export async function createLead(params, { dryRun = false, agent = "dani" } = {}) {
  const config = getConfig(agent);
  const all = buildLeadParams(config, params);
  if (dryRun) {
    console.log(`DRY-RUN (${agent}) — would POST to fixdigital (query-string params):`);
    console.log(JSON.stringify(all, null, 2));
    console.log("URL: " + buildLeadUrl(config, all));
    return { dryRun: true, params: all, url: buildLeadUrl(config, all) };
  }
  assertConfigured(config);
  const url = buildLeadUrl(config, all);
  const res = await fetch(url, { method: "POST", headers: { Accept: "application/json" } });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok || data.error) {
    throw new Error("CRM API error: " + JSON.stringify(data.error || data).slice(0, 800));
  }
  return data;
}
