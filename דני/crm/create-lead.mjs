import { parseLeadFile, leadToCrmParams } from "./mapping.mjs";
import { createLead } from "./client.mjs";

// create-lead.mjs — דוחף קובץ ליד מקומי ל-CRM.
//
// CLI:
//   node "דני/crm/create-lead.mjs" "דני/לידים/2026-06-12-גאבו.md" [--dry-run]
//   node "דני/crm/create-lead.mjs" "יהודה/לידים/2026-06-12-מישהו.md" [--dry-run]
//
// --dry-run מדפיס את ה-payload הממופה + ה-endpoint, בלי קריאת רשת.
// הסוכן (דני/יהודה — וממנו נכס ה-CRM המתאים) נקבע אוטומטית לפי תיקיית המקור של
// קובץ הליד (יהודה/... → yehuda, אחרת → dani). אפשר לדרוס עם --agent=yehuda.

function detectAgent(filePath, argv) {
  const flag = argv.find((x) => x.startsWith("--agent="));
  if (flag) return flag.slice("--agent=".length);
  return /(^|[\\/])יהודה[\\/]/.test(filePath) ? "yehuda" : "dani";
}

export async function pushLeadFile(filePath, { dryRun = false, agent } = {}) {
  const lead = parseLeadFile(filePath);
  const params = leadToCrmParams(lead);
  return createLead(params, { dryRun, agent: agent || detectAgent(filePath, []) });
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("create-lead.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const file = argv.find((x) => x !== "--dry-run" && !x.startsWith("--agent="));
  if (!file) {
    console.error('usage: node "דני/crm/create-lead.mjs" <lead-file.md> [--dry-run] [--agent=dani|yehuda]');
    process.exit(1);
  }
  const agent = detectAgent(file, argv);
  try {
    await pushLeadFile(file, { dryRun, agent });
    if (!dryRun) console.log(`CREATED in CRM (${agent})`);
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
