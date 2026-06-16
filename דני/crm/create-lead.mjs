import { parseLeadFile, leadToCrmParams } from "./mapping.mjs";
import { createLead } from "./client.mjs";

// create-lead.mjs — דוחף קובץ ליד מקומי ל-CRM.
//
// CLI:
//   node "דני/crm/create-lead.mjs" "דני/לידים/2026-06-12-גאבו.md" [--dry-run]
//
// --dry-run מדפיס את ה-payload הממופה + ה-endpoint, בלי קריאת רשת.

export async function pushLeadFile(filePath, { dryRun = false } = {}) {
  const lead = parseLeadFile(filePath);
  const params = leadToCrmParams(lead);
  return createLead(params, { dryRun });
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("create-lead.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const file = argv.find((x) => x !== "--dry-run");
  if (!file) {
    console.error('usage: node "דני/crm/create-lead.mjs" <lead-file.md> [--dry-run]');
    process.exit(1);
  }
  try {
    await pushLeadFile(file, { dryRun });
    if (!dryRun) console.log("CREATED in CRM");
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
