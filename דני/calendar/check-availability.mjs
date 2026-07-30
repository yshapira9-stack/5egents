import { getConfig, assertConfigured } from "./config.mjs";
import { getAccessToken } from "./google-auth.mjs";
import { listEvents } from "./client.mjs";
import { computeAvailableSlots } from "./availability.mjs";

// check-availability.mjs — מחזיר 2-3 שעות פנויות בתוך בלוקי "פניות לקוחות" ביומן
// של התחום המבוקש. זו הנקודה שראובן מריץ כשדני/יהודה מבקשים הצעת שעות ללקוח.
//
// CLI:
//   node "דני/calendar/check-availability.mjs" jewelry [--dry-run]
//   node "דני/calendar/check-availability.mjs" studies [--dry-run]

const DRY_RUN_SLOTS = [
  "2026-08-03T11:00:00+03:00",
  "2026-08-03T11:15:00+03:00",
  "2026-08-04T14:00:00+03:00",
];

export async function getAvailableSlots(domain, { dryRun = false } = {}) {
  const config = getConfig(domain);
  if (dryRun) {
    console.log(`DRY-RUN (${domain}) — שעות לדוגמה (בלי לפנות ל-API):`);
    console.log(JSON.stringify(DRY_RUN_SLOTS, null, 2));
    return DRY_RUN_SLOTS;
  }
  assertConfigured(config);
  const accessToken = await getAccessToken(config.serviceAccountKeyFile);
  const now = new Date();
  const timeMax = new Date(now.getTime() + config.lookaheadDays * 24 * 60 * 60 * 1000);
  const events = await listEvents(config.calendarId, {
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    accessToken,
  });
  return computeAvailableSlots(events, {
    blockTitle: config.blockTitle,
    slotMinutes: config.slotMinutes,
    lookaheadDays: config.lookaheadDays,
    now,
  });
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("check-availability.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const domain = argv.find((x) => x !== "--dry-run");
  if (!domain) {
    console.error('usage: node "דני/calendar/check-availability.mjs" <jewelry|studies> [--dry-run]');
    process.exit(1);
  }
  try {
    const slots = await getAvailableSlots(domain, { dryRun });
    if (!dryRun) console.log(JSON.stringify(slots, null, 2));
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
