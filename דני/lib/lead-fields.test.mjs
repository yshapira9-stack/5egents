import { test } from "node:test";
import assert from "node:assert/strict";
import { setField } from "./lead-fields.mjs";

const SAMPLE = `# ליד — גאבו

- **תאריך:** 2026-06-12
- **סטטוס:** פתוח

## הבריף
- **סוג תכשיט:** טבעת

## Handoff — מסירה ליניב המעצב 📞
מוכן ליניב — שיחת טלפון לסגירה.

## הערות
עוד טקסט אחרי הסעיף האחרון.
`;

test("setField replaces an existing field inside the target section", () => {
  const withField = setField(SAMPLE, "Handoff", "אופן העברה", "תיאום פגישה");
  const updated = setField(withField, "Handoff", "אופן העברה", "חזרה מיידית");
  const matches = updated.match(/- \*\*אופן העברה:\*\* .*/g);
  assert.equal(matches.length, 1);
  assert.equal(matches[0], "- **אופן העברה:** חזרה מיידית");
});

test("setField appends a new field at the top of the section when missing", () => {
  const updated = setField(SAMPLE, "Handoff", "פגישה שנקבעה", "2026-08-03T11:00:00+03:00");
  const handoffSection = updated.match(/## Handoff[^\n]*\n([\s\S]*?)(?=\n## |$)/)[1];
  assert.match(handoffSection, /^- \*\*פגישה שנקבעה:\*\* 2026-08-03T11:00:00\+03:00\n/);
  assert.match(handoffSection, /מוכן ליניב — שיחת טלפון לסגירה\./); // existing text preserved
});

test("setField does not touch content in other sections", () => {
  const updated = setField(SAMPLE, "Handoff", "אופן העברה", "תיאום פגישה");
  assert.match(updated, /## הערות\nעוד טקסט אחרי הסעיף האחרון\.\n$/);
  assert.match(updated, /- \*\*סוג תכשיט:\*\* טבעת/);
});

test("setField throws a clear error when the section does not exist", () => {
  assert.throws(
    () => setField(SAMPLE, "לא קיים", "מפתח", "ערך"),
    /section not found: "## לא קיים"/
  );
});

test("setField sees the whole multi-line section body across repeated calls (reschedule scenario)", () => {
  let updated = setField(SAMPLE, "Handoff", "פגישה שנקבעה", "2026-08-03T11:00:00+03:00");
  updated = setField(updated, "Handoff", "אופן העברה", "תיאום פגישה");
  // re-set the first field, which is no longer on line 1 of the section body
  updated = setField(updated, "Handoff", "פגישה שנקבעה", "2026-08-10T09:30:00+03:00");

  const meetingMatches = updated.match(/- \*\*פגישה שנקבעה:\*\* .*/g);
  assert.equal(meetingMatches.length, 1);
  assert.equal(meetingMatches[0], "- **פגישה שנקבעה:** 2026-08-10T09:30:00+03:00");

  const modeMatches = updated.match(/- \*\*אופן העברה:\*\* .*/g);
  assert.equal(modeMatches.length, 1);
  assert.equal(modeMatches[0], "- **אופן העברה:** תיאום פגישה");

  assert.match(updated, /מוכן ליניב — שיחת טלפון לסגירה\./); // existing text preserved
  assert.match(updated, /## הערות\nעוד טקסט אחרי הסעיף האחרון\.\n$/); // other sections untouched
});

test("setField treats the value literally even when it looks like a $-substitution pattern", () => {
  const updated = setField(SAMPLE, "Handoff", "הערת בדיקה", "$&");
  const matches = updated.match(/- \*\*הערת בדיקה:\*\* .*/g);
  assert.equal(matches.length, 1);
  assert.equal(matches[0], "- **הערת בדיקה:** $&");

  const updated2 = setField(SAMPLE, "Handoff", "הערת בדיקה", "$`");
  const matches2 = updated2.match(/- \*\*הערת בדיקה:\*\* .*/g);
  assert.equal(matches2.length, 1);
  assert.equal(matches2[0], "- **הערת בדיקה:** $`");
});
