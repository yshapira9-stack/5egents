import fs from "node:fs";
import { parseLeadFile, leadToCrmParams } from "../crm/mapping.mjs";
import { setField } from "../lib/lead-fields.mjs";
import { getConfig, assertConfigured } from "./config.mjs";
import { getAccessToken } from "./google-auth.mjs";
import { listEvents, createEvent } from "./client.mjs";
import { isSlotAvailable } from "./availability.mjs";

// book-meeting.mjs — קובע פגישה בפועל ביומן התחום המבוקש, ומעדכן את קובץ הליד.
// זו הנקודה שראובן מריץ אחרי שהלקוח בחר שעה מתוך ההצעות של check-availability.mjs.
//
// CLI:
//   node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/<ליד>.md" "2026-08-03T11:00:00+03:00" [--dry-run]
//   node "דני/calendar/book-meeting.mjs" studies "יהודה/לידים/<ליד>.md" "2026-08-04T14:00:00+03:00" [--dry-run]
//
// ב-dry-run: לא נוצר אירוע אמיתי ביומן, אבל קובץ הליד עדיין מתעדכן (מסומן בבירור
// כ-DRY-RUN בשדה "פגישה שנקבעה"), כדי שאפשר לבדוק את כל הזרימה בלי credentials.

const DOMAIN_LABEL = { jewelry: "תכשיטים", studies: "לימודים וסדנאות" };

export async function bookMeeting(domain, leadFilePath, slotIso, { dryRun = false } = {}) {
  const label = DOMAIN_LABEL[domain];
  if (!label) throw new Error(`unknown calendar domain: "${domain}" (expected "jewelry" or "studies")`);

  const config = getConfig(domain);
  const lead = parseLeadFile(leadFilePath);
  const params = leadToCrmParams(lead);

  const summary = `שיחת ${label} — ${lead.name}`;
  const description = [`טלפון: ${params.phone || "—"}`, params.comments].filter(Boolean).join("\n\n");
  const start = new Date(slotIso);
  const end = new Date(start.getTime() + config.slotMinutes * 60 * 1000);

  if (dryRun) {
    console.log(`DRY-RUN (${domain}) — היה נוצר אירוע:`);
    console.log(JSON.stringify(
      { calendarId: config.calendarId || "<not-set>", summary, description, start, end },
      null,
      2
    ));
  } else {
    assertConfigured(config);
    const accessToken = await getAccessToken(config.serviceAccountKeyFile);
    const now = new Date();
    const timeMax = new Date(now.getTime() + config.lookaheadDays * 24 * 60 * 60 * 1000);
    const events = await listEvents(config.calendarId, {
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      accessToken,
    });
    if (!isSlotAvailable(events, slotIso, { blockTitle: config.blockTitle, slotMinutes: config.slotMinutes })) {
      throw new Error(`השעה ${slotIso} כבר לא פנויה — בקש/י מהלקוח שעה אחרת`);
    }
    await createEvent(
      config.calendarId,
      { summary, description, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } },
      { accessToken }
    );
  }

  const markdown = fs.readFileSync(leadFilePath, "utf8");
  const meetingValue = dryRun ? `${slotIso} (DRY-RUN — לא נוצר אירוע אמיתי ביומן)` : slotIso;
  let updated = setField(markdown, "Handoff", "אופן העברה", "תיאום פגישה");
  updated = setField(updated, "Handoff", "פגישה שנקבעה", meetingValue);
  fs.writeFileSync(leadFilePath, updated, "utf8");

  return { summary, description, start: start.toISOString(), end: end.toISOString(), dryRun };
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("book-meeting.mjs")) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const [domain, leadFile, slotIso] = argv.filter((x) => x !== "--dry-run");
  if (!domain || !leadFile || !slotIso) {
    console.error(
      'usage: node "דני/calendar/book-meeting.mjs" <jewelry|studies> <lead-file.md> <ISO-datetime> [--dry-run]'
    );
    process.exit(1);
  }
  try {
    await bookMeeting(domain, leadFile, slotIso, { dryRun });
    console.log(dryRun ? "DRY-RUN — קובץ הליד עודכן, לא נוצר אירוע אמיתי" : "BOOKED");
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
