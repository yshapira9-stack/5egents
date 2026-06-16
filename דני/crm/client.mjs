import { config, assertConfigured } from "./config.mjs";

// client.mjs — יצירת ליד ב-CRM של fixdigital.
// ה-API מקבל את הפרמטרים כ-query-string (לא כ-JSON body), כולל מזהי החשבון.
// תיעוד: https://info.fixdigital.co.il/docs/receiveapi/

// בונה את מפת הפרמטרים המלאה (מזהי חשבון + שדות מקור + שדות הליד).
export function buildLeadParams(params) {
  return {
    clientID: config.clientID,
    tenantID: config.tenantID,
    projectID: config.projectID,
    projectTypeID: config.projectTypeID,
    FORMURL: config.formUrl,
    URLREFER: config.urlRefer,
    ...(config.channelId ? { channelid: config.channelId } : {}),
    ...params,
  };
}

function buildLeadUrl(all) {
  const u = new URL(config.baseUrl.replace(/\/$/, "") + config.leadPath);
  for (const [k, v] of Object.entries(all)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function createLead(params, { dryRun = false } = {}) {
  const all = buildLeadParams(params);
  if (dryRun) {
    console.log("DRY-RUN — would POST to fixdigital (query-string params):");
    console.log(JSON.stringify(all, null, 2));
    console.log("URL: " + buildLeadUrl(all));
    return { dryRun: true, params: all, url: buildLeadUrl(all) };
  }
  assertConfigured();
  const url = buildLeadUrl(all);
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
