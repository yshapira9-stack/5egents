// availability.mjs — לוגיקה טהורה לחישוב שעות פנויות מתוך רשימת אירועים ביומן.
// לא נוגע ברשת/API — מקבל מערך אירועים (כבר נשלפו מ-Google Calendar) ומחזיר הצעות.
//
// אירוע נחשב "בלוק זמינות" אם summary שלו שווה בדיוק ל-blockTitle. כל אירוע אחר
// נחשב "תפוס" ומוחסר מתוך כל בלוק שהוא חופף אליו.

function toMs(dateTime) {
  return new Date(dateTime).getTime();
}

export function computeAvailableSlots(events, { blockTitle, slotMinutes, lookaheadDays, now = new Date(), limit = 3 }) {
  const horizonMs = now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000;

  const blocks = events
    .filter((e) => e.summary === blockTitle)
    .map((e) => ({ start: toMs(e.start.dateTime), end: toMs(e.end.dateTime) }))
    .filter((b) => b.end > now.getTime() && b.start < horizonMs)
    .sort((a, b) => a.start - b.start);

  const busy = events
    .filter((e) => e.summary !== blockTitle)
    .map((e) => ({ start: toMs(e.start.dateTime), end: toMs(e.end.dateTime) }));

  const slotMs = slotMinutes * 60 * 1000;
  const slots = [];

  for (const block of blocks) {
    // מיישרים את הסמן לרשת המשבצות שמוגדרת ע"י תחילת הבלוק — לא רק קופצים ל-"now" —
    // כדי שתמיד נציע שעות עגולות (10:00, 10:15, ...) גם כשה"now" נופל באמצע משבצת.
    let cursor = block.start;
    if (cursor < now.getTime()) {
      const elapsedMs = now.getTime() - cursor;
      const steps = Math.ceil(elapsedMs / slotMs);
      cursor += steps * slotMs;
    }
    while (cursor + slotMs <= block.end && slots.length < limit) {
      const slotEnd = cursor + slotMs;
      const overlapping = busy.filter((b) => b.start < slotEnd && b.end > cursor);
      if (overlapping.length === 0) {
        slots.push(new Date(cursor).toISOString());
        cursor += slotMs;
      } else {
        // קופצים לסוף האירוע התפוס האחרון שחופף, כדי לא לבדוק כל דקה בנפרד.
        cursor = Math.max(...overlapping.map((b) => b.end));
      }
    }
    if (slots.length >= limit) break;
  }
  return slots;
}

// בודק אם משבצת ספציפית (שעת התחלה + משך) עדיין פנויה — לשימוש ב-book-meeting.mjs
// כהגנה מפני מרוץ (race condition) בין הצעת השעה ללקוח לבין יצירת האירוע בפועל.
export function isSlotAvailable(events, slotStartIso, { blockTitle, slotMinutes }) {
  const start = toMs(slotStartIso);
  const end = start + slotMinutes * 60 * 1000;

  const insideBlock = events
    .filter((e) => e.summary === blockTitle)
    .some((e) => toMs(e.start.dateTime) <= start && toMs(e.end.dateTime) >= end);
  if (!insideBlock) return false;

  const overlapsBusy = events
    .filter((e) => e.summary !== blockTitle)
    .some((e) => toMs(e.start.dateTime) < end && toMs(e.end.dateTime) > start);
  return !overlapsBusy;
}
