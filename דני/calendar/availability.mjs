// availability.mjs — לוגיקה טהורה לחישוב שעות פנויות מתוך רשימת אירועים ביומן.
// לא נוגע ברשת/API — מקבל מערך אירועים (כבר נשלפו מ-Google Calendar) ומחזיר הצעות.
//
// אירוע נחשב "בלוק זמינות" אם summary שלו שווה בדיוק ל-blockTitle. כל אירוע אחר
// נחשב "תפוס" ומוחסר מתוך כל בלוק שהוא חופף אליו.

function toMs(dateTime) {
  return new Date(dateTime).getTime();
}

// מחשב את הרגע (מילישניות) של קצה אירוע — תומך גם באירועי "יום שלם" של גוגל
// (start.date/end.date, בלי שעה) וגם באירועים רגילים עם dateTime. אירועי יום שלם
// הם דרך נפוצה לגמרי לסמן חופשה/אי-זמינות, וחייבים להיתפס כתפוסים כמו כל אירוע אחר.
function eventMs(edge) {
  return new Date(edge.dateTime || edge.date).getTime();
}

// מיישר "ms" קדימה לרשת המשבצות שמעוגנת ב-gridStart (למשל תחילת הבלוק), כך שתמיד
// נציע/נמשיך משעות עגולות (10:00, 10:15, ...) — גם כשה"now" נופל באמצע משבצת, וגם
// אחרי שקופצים לסוף אירוע תפוס שלא מיושר לרשת.
function alignUp(ms, gridStart, slotMs) {
  if (ms <= gridStart) return gridStart;
  return gridStart + Math.ceil((ms - gridStart) / slotMs) * slotMs;
}

// ממזג אינטרוולים חופפים/צמודים (משמש למניעת משבצות כפולות כשיש שני אירועי-בלוק
// חופפים, למשל בלוק קבוע + בלוק אד-הוק שמכסה חלק מאותו זמן).
function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

// בונה את רשימת בלוקי הזמינות הממוזגים מתוך האירועים הגולמיים — משותף בין
// computeAvailableSlots ל-isSlotAvailable, כדי ששתי הפונקציות יסכימו על אותה
// "אמת": משבצת שהוצעה כי היא נופלת בתוך האיחוד של שני בלוקים צמודים/חופפים
// חייבת להיחשב זמינה גם כשבודקים אותה מחדש (למשל ב-book-meeting.mjs).
function mergedBlocks(events, blockTitle) {
  const raw = events
    .filter((e) => e.summary === blockTitle)
    .map((e) => ({ start: eventMs(e.start), end: eventMs(e.end) }));
  return mergeIntervals(raw);
}

export function computeAvailableSlots(events, { blockTitle, slotMinutes, lookaheadDays, now = new Date(), limit = 3 }) {
  const horizonMs = now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000;

  const blocks = mergedBlocks(events, blockTitle)
    .filter((b) => b.end > now.getTime() && b.start < horizonMs)
    .sort((a, b) => a.start - b.start);

  const busy = events
    .filter((e) => e.summary !== blockTitle)
    .map((e) => ({ start: eventMs(e.start), end: eventMs(e.end) }));

  const slotMs = slotMinutes * 60 * 1000;
  const slots = [];

  for (const block of blocks) {
    let cursor = alignUp(now.getTime(), block.start, slotMs);
    while (cursor + slotMs <= block.end && slots.length < limit) {
      const slotEnd = cursor + slotMs;
      const overlapping = busy.filter((b) => b.start < slotEnd && b.end > cursor);
      if (overlapping.length === 0) {
        slots.push(new Date(cursor).toISOString());
        cursor += slotMs;
      } else {
        // קופצים לסוף האירוע התפוס האחרון שחופף, ומיישרים מחדש לרשת — כדי לא לבדוק
        // כל דקה בנפרד וגם לא לסחוף את הרשת אם האירוע התפוס לא מיושר אליה.
        const jumpTo = Math.max(...overlapping.map((b) => b.end));
        cursor = alignUp(jumpTo, block.start, slotMs);
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

  const insideBlock = mergedBlocks(events, blockTitle).some((b) => b.start <= start && b.end >= end);
  if (!insideBlock) return false;

  const overlapsBusy = events
    .filter((e) => e.summary !== blockTitle)
    .some((e) => eventMs(e.start) < end && eventMs(e.end) > start);
  return !overlapsBusy;
}
