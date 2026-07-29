# Calendar Scheduling + Urgent Callback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Dani and Yehuda the ability to (a) propose real open meeting slots from a
per-domain Google Calendar and book a chosen slot, and (b) trigger an "urgent callback"
WhatsApp notification to the right sales rep without ever exposing the rep's phone number
to the customer.

**Architecture:** New shared `דני/calendar/` module (used by both agents, mirroring the
existing `דני/crm/` bridge pattern: config → pure logic → raw-fetch client → CLI, all
`--dry-run`-capable until real Google credentials exist). No SDK dependency — Google
Calendar access uses hand-rolled JWT signing (`node:crypto`) and raw `fetch`, exactly like
`דני/crm/client.mjs` and `דני/whatsapp/send.mjs` already do. The urgent-callback path adds
no new code at all — it reuses `דני/whatsapp/send.mjs` and is implemented purely as
playbook/doc changes.

**Tech Stack:** Node.js (`>=18`, ESM `.mjs` files), no external npm dependencies, built-in
`node:test` + `node:assert/strict` for unit tests (no test framework is installed in this
repo — `node:test` avoids adding one), Google Calendar API v3 via raw REST.

**Reference implementation to follow throughout:** `דני/crm/config.mjs`,
`דני/crm/client.mjs`, `דני/crm/create-lead.mjs`, `דני/crm/mapping.mjs`, and
`דני/crm/README.md` — every new file in this plan copies their conventions (CLI arg
parsing, `--dry-run` flag, `.env` via `דני/lib/env.mjs`, plain `Error` messages in Hebrew,
no try/catch beyond the CLI entrypoint).

**Spec:** `docs/superpowers/specs/2026-07-29-calendar-scheduling-design.md` — read it in
full before starting; every task below implements one part of it.

---

### Task 1: Environment variable scaffolding

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add the new variables to `.env.example`**

Open `.env.example` and insert this new section right after the existing WhatsApp section
(after the line `WHATSAPP_WEBHOOK_PORT=3030`, before the line `# --- General ---`):

```
# --- Calendar scheduling (Dani + Yehuda) — Google Calendar API (service account) ---
# One Google Cloud service account, shared with both calendars below (share each
# calendar with the service account's client_email, permission "Make changes to events").
# Download the service account JSON key file and save it at the path below (gitignored).
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./דני/calendar/service-account.json
JEWELRY_CALENDAR_ID=your-jewelry-calendar-id@group.calendar.google.com
STUDIES_CALENDAR_ID=your-studies-calendar-id@group.calendar.google.com
# Recurring event title each rep creates in their own calendar to mark when they're open
# for client calls booked through Dani/Yehuda. Anything outside these blocks is never
# offered to a customer, even if the calendar shows free there.
CALENDAR_BLOCK_TITLE=פניות לקוחות
CALENDAR_SLOT_MINUTES=15
CALENDAR_LOOKAHEAD_DAYS=14

# --- Urgent callback (Dani + Yehuda) — "call me now" path, WhatsApp only ---
# Rep's own WhatsApp number per domain. Customers never see these numbers — Dani/Yehuda
# only forward the customer's number to the rep and reassure the customer.
JEWELRY_SALES_WHATSAPP=+972500000000
STUDIES_SALES_WHATSAPP=+972500000000
```

- [ ] **Step 2: Gitignore the service account key file**

In `.gitignore`, under the existing `# Environment / secrets` block (which currently
contains `.env`, `.env.local`, `.env.*.local`), add one line:

```
דני/calendar/service-account.json
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "Add .env scaffolding for calendar scheduling + urgent callback"
```

---

### Task 2: `דני/lib/lead-fields.mjs` — update a field inside a lead-file section

This is a pure string-manipulation helper (no filesystem, no network) used later by
`book-meeting.mjs` to write the booking result back into a lead file's `## Handoff`
section. Building and testing it first, in isolation, means `book-meeting.mjs` can treat
it as a trusted building block.

**Files:**
- Create: `דני/lib/lead-fields.mjs`
- Create: `דני/lib/lead-fields.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `דני/lib/lead-fields.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test "דני/lib/lead-fields.test.mjs"`
Expected: FAIL — `Cannot find module './lead-fields.mjs'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `דני/lib/lead-fields.mjs`:

```js
// lead-fields.mjs — עדכון שדה בודד בתוך סעיף Markdown של קובץ ליד (למשל "## Handoff").
// פועל על טקסט בזיכרון בלבד (לא נוגע בדיסק) כדי שיהיה קל לבדוק ולהשתמש חוזר.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionRegex(title) {
  return new RegExp(`(^##\\s*${escapeRegExp(title)}[^\\n]*\\n)([\\s\\S]*?)(?=\\n## |$)`, "m");
}

// מעדכן/מוסיף שדה `- **key:** value` בתוך סעיף `## sectionTitle` (ה-heading יכול
// להמשיך אחרי הכותרת, כמו "## Handoff — מסירה ליניב המעצב 📞" — מספיק ש-sectionTitle
// יהיה תחילת הכותרת). אם השדה כבר קיים בתוך הסעיף — מחליף את הערך. אחרת — מוסיף
// שורה חדשה בתחילת גוף הסעיף, מעל התוכן הקיים. אם הסעיף לא קיים בכלל בקובץ — זורק
// שגיאה ברורה (סימן שקובץ הליד ישן/לא תקין).
export function setField(markdown, sectionTitle, key, value) {
  const match = markdown.match(sectionRegex(sectionTitle));
  if (!match) {
    throw new Error(`section not found: "## ${sectionTitle}"`);
  }
  const [full, heading, body] = match;
  const fieldRe = new RegExp(`^(-\\s*\\*\\*\\s*${escapeRegExp(key)}\\s*:\\*\\*\\s*).*$`, "m");
  const newBody = fieldRe.test(body)
    ? body.replace(fieldRe, (_, prefix) => `${prefix}${value}`)
    : `- **${key}:** ${value}\n${body}`;
  return markdown.replace(full, heading + newBody);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "דני/lib/lead-fields.test.mjs"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "דני/lib/lead-fields.mjs" "דני/lib/lead-fields.test.mjs"
git commit -m "Add lead-fields helper for updating a lead file's Handoff section"
```

---

### Task 3: `דני/calendar/config.mjs` — per-domain calendar configuration

**Files:**
- Create: `דני/calendar/config.mjs`
- Create: `דני/calendar/config.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `דני/calendar/config.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getConfig, assertConfigured } from "./config.mjs";

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("getConfig throws on an unknown domain", () => {
  assert.throws(() => getConfig("bogus"), /unknown calendar domain/);
});

test("getConfig reads the jewelry calendar id and applies defaults", () => {
  withEnv(
    { JEWELRY_CALENDAR_ID: "jewelry-cal-id", CALENDAR_BLOCK_TITLE: "", CALENDAR_SLOT_MINUTES: "", CALENDAR_LOOKAHEAD_DAYS: "" },
    () => {
      const config = getConfig("jewelry");
      assert.equal(config.calendarId, "jewelry-cal-id");
      assert.equal(config.blockTitle, "פניות לקוחות");
      assert.equal(config.slotMinutes, 15);
      assert.equal(config.lookaheadDays, 14);
    }
  );
});

test("getConfig reads the studies calendar id separately from jewelry", () => {
  withEnv({ STUDIES_CALENDAR_ID: "studies-cal-id" }, () => {
    const config = getConfig("studies");
    assert.equal(config.calendarId, "studies-cal-id");
  });
});

test("assertConfigured throws a clear error listing what's missing", () => {
  withEnv({ JEWELRY_CALENDAR_ID: "", GOOGLE_SERVICE_ACCOUNT_KEY_FILE: "" }, () => {
    assert.throws(
      () => assertConfigured(getConfig("jewelry")),
      /JEWELRY_CALENDAR_ID.*GOOGLE_SERVICE_ACCOUNT_KEY_FILE/s
    );
  });
});

test("assertConfigured passes when the calendar id and an existing key file are set", () => {
  const tmpFile = path.join(os.tmpdir(), `fake-service-account-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, "{}");
  try {
    withEnv({ JEWELRY_CALENDAR_ID: "jewelry-cal-id", GOOGLE_SERVICE_ACCOUNT_KEY_FILE: tmpFile }, () => {
      assert.doesNotThrow(() => assertConfigured(getConfig("jewelry")));
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test "דני/calendar/config.test.mjs"`
Expected: FAIL — `Cannot find module './config.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `דני/calendar/config.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { loadEnv, PROJECT_ROOT } from "../lib/env.mjs";

// config.mjs — הגדרות חיבור היומן (Google Calendar) לפי תחום.
// שני תחומים אפשריים: "jewelry" (תכשיטים, לדני) ו-"studies" (לימודים+סדנאות, ליהודה).
// שני התחומים חולקים אותו Service Account אבל כל אחד עם יומן Google Calendar נפרד.

export { PROJECT_ROOT };

loadEnv();

const DOMAINS = ["jewelry", "studies"];

export function getConfig(domain) {
  if (!DOMAINS.includes(domain)) {
    throw new Error(`unknown calendar domain: "${domain}" (expected "jewelry" or "studies")`);
  }
  const calendarId =
    domain === "jewelry" ? process.env.JEWELRY_CALENDAR_ID : process.env.STUDIES_CALENDAR_ID;
  return {
    domain,
    calendarId: calendarId || "",
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "",
    blockTitle: process.env.CALENDAR_BLOCK_TITLE || "פניות לקוחות",
    slotMinutes: Number(process.env.CALENDAR_SLOT_MINUTES) || 15,
    lookaheadDays: Number(process.env.CALENDAR_LOOKAHEAD_DAYS) || 14,
  };
}

// זורק שגיאה ברורה אם חסרים פרטי החיבור הנדרשים לגישה אמיתית ל-API.
export function assertConfigured(config) {
  const missing = [];
  if (!config.calendarId) {
    missing.push(config.domain === "jewelry" ? "JEWELRY_CALENDAR_ID" : "STUDIES_CALENDAR_ID");
  }
  if (!config.serviceAccountKeyFile) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  } else if (!fs.existsSync(path.resolve(PROJECT_ROOT, config.serviceAccountKeyFile))) {
    missing.push(`GOOGLE_SERVICE_ACCOUNT_KEY_FILE (file not found: ${config.serviceAccountKeyFile})`);
  }
  if (missing.length) {
    throw new Error(
      "היומן עדיין לא מחובר (" + config.domain + ") — חסר: " + missing.join(", ") +
      ". (אפשר לבדוק בלי פרטי גישה עם הדגל --dry-run)"
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "דני/calendar/config.test.mjs"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "דני/calendar/config.mjs" "דני/calendar/config.test.mjs"
git commit -m "Add per-domain calendar config (jewelry/studies)"
```

---

### Task 4: `דני/calendar/availability.mjs` — pure slot-finding logic

This is the core scheduling logic, and the part with the most edge cases, so it gets the
most thorough test coverage. It never touches the network — it takes an already-fetched
array of Google Calendar event objects (`{ summary, start: { dateTime }, end: { dateTime } }`)
and computes slots.

**Files:**
- Create: `דני/calendar/availability.mjs`
- Create: `דני/calendar/availability.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `דני/calendar/availability.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAvailableSlots, isSlotAvailable } from "./availability.mjs";

const BLOCK_TITLE = "פניות לקוחות";

function event(summary, startIso, endIso) {
  return { summary, start: { dateTime: startIso }, end: { dateTime: endIso } };
}

test("computeAvailableSlots returns back-to-back slots inside an empty block", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T10:45:00+03:00")];
  const now = new Date("2026-08-01T00:00:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now });
  // three 15-minute slots fit in a 45-minute block
  assert.deepEqual(slots, [
    new Date("2026-08-03T10:00:00+03:00").toISOString(),
    new Date("2026-08-03T10:15:00+03:00").toISOString(),
    new Date("2026-08-03T10:30:00+03:00").toISOString(),
  ]);
});

test("computeAvailableSlots skips a busy sub-range inside the block", () => {
  const events = [
    event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T11:00:00+03:00"),
    event("פגישה קיימת", "2026-08-03T10:15:00+03:00", "2026-08-03T10:30:00+03:00"),
  ];
  const now = new Date("2026-08-01T00:00:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now });
  assert.equal(slots.includes(new Date("2026-08-03T10:15:00+03:00").toISOString()), false);
  assert.deepEqual(slots, [
    new Date("2026-08-03T10:00:00+03:00").toISOString(),
    new Date("2026-08-03T10:30:00+03:00").toISOString(),
    new Date("2026-08-03T10:45:00+03:00").toISOString(),
  ]);
});

test("computeAvailableSlots ignores time outside any block even if free", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T10:15:00+03:00")];
  const now = new Date("2026-08-01T00:00:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now });
  assert.deepEqual(slots, [new Date("2026-08-03T10:00:00+03:00").toISOString()]);
});

test("computeAvailableSlots returns slots across multiple blocks in chronological order", () => {
  const events = [
    event(BLOCK_TITLE, "2026-08-04T10:00:00+03:00", "2026-08-04T10:15:00+03:00"),
    event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T10:15:00+03:00"),
  ];
  const now = new Date("2026-08-01T00:00:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now });
  assert.deepEqual(slots, [
    new Date("2026-08-03T10:00:00+03:00").toISOString(),
    new Date("2026-08-04T10:00:00+03:00").toISOString(),
  ]);
});

test("computeAvailableSlots respects the limit option", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T09:00:00+03:00", "2026-08-03T12:00:00+03:00")];
  const now = new Date("2026-08-01T00:00:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now, limit: 2 });
  assert.equal(slots.length, 2);
});

test("computeAvailableSlots skips time before now even inside a block", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T10:45:00+03:00")];
  const now = new Date("2026-08-03T10:20:00+03:00");
  const slots = computeAvailableSlots(events, { blockTitle: BLOCK_TITLE, slotMinutes: 15, lookaheadDays: 14, now });
  assert.deepEqual(slots, [new Date("2026-08-03T10:30:00+03:00").toISOString()]);
});

test("isSlotAvailable is true inside a free block", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T11:00:00+03:00")];
  assert.equal(
    isSlotAvailable(events, "2026-08-03T10:15:00+03:00", { blockTitle: BLOCK_TITLE, slotMinutes: 15 }),
    true
  );
});

test("isSlotAvailable is false outside any block", () => {
  const events = [event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T11:00:00+03:00")];
  assert.equal(
    isSlotAvailable(events, "2026-08-03T12:00:00+03:00", { blockTitle: BLOCK_TITLE, slotMinutes: 15 }),
    false
  );
});

test("isSlotAvailable is false when it overlaps an already-booked event", () => {
  const events = [
    event(BLOCK_TITLE, "2026-08-03T10:00:00+03:00", "2026-08-03T11:00:00+03:00"),
    event("שיחת תכשיטים — מישהו אחר", "2026-08-03T10:15:00+03:00", "2026-08-03T10:30:00+03:00"),
  ];
  assert.equal(
    isSlotAvailable(events, "2026-08-03T10:15:00+03:00", { blockTitle: BLOCK_TITLE, slotMinutes: 15 }),
    false
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test "דני/calendar/availability.test.mjs"`
Expected: FAIL — `Cannot find module './availability.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `דני/calendar/availability.mjs`:

```js
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
    let cursor = Math.max(block.start, now.getTime());
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "דני/calendar/availability.test.mjs"`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "דני/calendar/availability.mjs" "דני/calendar/availability.test.mjs"
git commit -m "Add pure slot-finding logic for calendar availability blocks"
```

---

### Task 5: `דני/calendar/google-auth.mjs` — Service Account JWT + access token

No SDK: a Service Account JWT is signed by hand with `node:crypto` (same "raw fetch, no
external deps" style as `דני/crm/client.mjs`). The JWT-signing part is pure and fully
testable with a throwaway RSA keypair generated in the test itself — no real Google
credentials needed for this test. The token-exchange call to Google is not unit tested
(network + real credentials); it's verified manually in Task 11.

**Files:**
- Create: `דני/calendar/google-auth.mjs`
- Create: `דני/calendar/google-auth.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `דני/calendar/google-auth.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signJwt } from "./google-auth.mjs";

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

test("signJwt produces a JWT verifiable with the matching public key", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const now = 1_800_000_000; // fixed timestamp for a deterministic test
  const token = signJwt({ clientEmail: "svc@example.iam.gserviceaccount.com", privateKey, now });
  const [headerB64, claimsB64, sigB64] = token.split(".");

  const header = JSON.parse(base64urlDecode(headerB64));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT" });

  const claims = JSON.parse(base64urlDecode(claimsB64));
  assert.equal(claims.iss, "svc@example.iam.gserviceaccount.com");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/calendar");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.iat, now);
  assert.equal(claims.exp, now + 3600);

  const unsigned = `${headerB64}.${claimsB64}`;
  const verified = crypto
    .createVerify("RSA-SHA256")
    .update(unsigned)
    .verify(publicKey, sigB64, "base64url");
  assert.equal(verified, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "דני/calendar/google-auth.test.mjs"`
Expected: FAIL — `Cannot find module './google-auth.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `דני/calendar/google-auth.mjs`:

```js
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../lib/env.mjs";

// google-auth.mjs — קבלת access token זמני מ-Google OAuth2 עבור Service Account,
// בלי שום ספריית SDK חיצונית (חתימת JWT ידנית עם node:crypto, עקבי לשאר השכבות
// בפרויקט הזה שמדברות ישירות מול REST עם fetch גולמי).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// בונה וחותם JWT (RS256) לפי מפרט Google Service Account. פונקציה טהורה — ניתנת
// לבדיקה עם זוג מפתחות RSA שנוצר בזמן הבדיקה, בלי credentials אמיתיים.
export function signJwt({ clientEmail, privateKey, scope = SCOPE, now = Math.floor(Date.now() / 1000) }) {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: clientEmail, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

function loadServiceAccount(keyFile) {
  const full = path.resolve(PROJECT_ROOT, keyFile);
  const raw = JSON.parse(fs.readFileSync(full, "utf8"));
  if (!raw.client_email || !raw.private_key) {
    throw new Error(`service account file missing client_email/private_key: ${keyFile}`);
  }
  return { clientEmail: raw.client_email, privateKey: raw.private_key };
}

// מחליף JWT חתום ב-access token אמיתי מול Google. אין dry-run משלו — הסקריפטים
// שקוראים לו (check-availability / book-meeting) בודקים --dry-run *לפני* שמגיעים לכאן.
export async function getAccessToken(keyFile) {
  const { clientEmail, privateKey } = loadServiceAccount(keyFile);
  const assertion = signJwt({ clientEmail, privateKey });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Google OAuth error: " + JSON.stringify(data).slice(0, 500));
  }
  return data.access_token;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "דני/calendar/google-auth.test.mjs"`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "דני/calendar/google-auth.mjs" "דני/calendar/google-auth.test.mjs"
git commit -m "Add Service Account JWT signing + Google OAuth token exchange"
```

---

### Task 6: `דני/calendar/client.mjs` — raw Google Calendar API v3 calls

No unit test here — this is a thin network wrapper, same as `דני/crm/client.mjs` (which
also has no unit test). It's verified manually in Task 11 once real credentials exist.

**Files:**
- Create: `דני/calendar/client.mjs`

- [ ] **Step 1: Write the implementation**

Create `דני/calendar/client.mjs`:

```js
// client.mjs — קריאות גולמיות ל-Google Calendar API v3 (בלי googleapis SDK,
// עקבי לשאר השכבות בפרויקט הזה שמדברות ישירות מול REST עם fetch).

const API_BASE = "https://www.googleapis.com/calendar/v3";

async function api(pathAndQuery, { accessToken, ...options }) {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("non-JSON response from Google Calendar: " + text.slice(0, 500));
  }
  if (!res.ok || data.error) {
    throw new Error("Google Calendar API error: " + JSON.stringify(data.error || data).slice(0, 800));
  }
  return data;
}

// שולף אירועים בטווח זמן נתון (timeMin/timeMax בפורמט ISO), ממוינים לפי זמן התחלה.
export async function listEvents(calendarId, { timeMin, timeMax, accessToken }) {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
  const data = await api(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    method: "GET",
    accessToken,
  });
  return data.items || [];
}

// יוצר אירוע חדש ביומן. eventBody בפורמט Google Calendar (summary/description/start/end).
export async function createEvent(calendarId, eventBody, { accessToken }) {
  return api(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(eventBody),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add "דני/calendar/client.mjs"
git commit -m "Add raw Google Calendar API v3 client (listEvents/createEvent)"
```

---

### Task 7: `דני/calendar/check-availability.mjs` — CLI entrypoint

**Files:**
- Create: `דני/calendar/check-availability.mjs`

- [ ] **Step 1: Write the implementation**

Create `דני/calendar/check-availability.mjs`:

```js
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
  if (dryRun) {
    console.log(`DRY-RUN (${domain}) — שעות לדוגמה (בלי לפנות ל-API):`);
    console.log(JSON.stringify(DRY_RUN_SLOTS, null, 2));
    return DRY_RUN_SLOTS;
  }
  const config = getConfig(domain);
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
```

- [ ] **Step 2: Run it manually to verify the dry-run path works**

Run: `node "דני/calendar/check-availability.mjs" jewelry --dry-run`
Expected output: a `DRY-RUN (jewelry) — ...` line followed by a JSON array of 3 ISO
datetimes (the fixed `DRY_RUN_SLOTS`).

Run: `node "דני/calendar/check-availability.mjs" studies --dry-run`
Expected: same shape, `DRY-RUN (studies) — ...`.

Run: `node "דני/calendar/check-availability.mjs"` (no domain)
Expected: usage message printed to stderr, exit code 1.

- [ ] **Step 3: Commit**

```bash
git add "דני/calendar/check-availability.mjs"
git commit -m "Add check-availability CLI for proposing meeting slots"
```

---

### Task 8: `דני/calendar/book-meeting.mjs` — CLI entrypoint

Reuses `parseLeadFile`/`leadToCrmParams` from `דני/crm/mapping.mjs` (already handles both
`דני/לידים/...` and `יהודה/לידים/...` file shapes) instead of writing a second lead parser.

**Files:**
- Create: `דני/calendar/book-meeting.mjs`

- [ ] **Step 1: Write the implementation**

Create `דני/calendar/book-meeting.mjs`:

```js
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
```

- [ ] **Step 2: Manually verify the dry-run path against the real Dani example lead**

First check out a scratch copy so this test doesn't leave a permanent diff in a real lead
file:

```bash
cp "דני/לידים/2026-06-12-גאבו.md" "דני/לידים/_scratch-test-גאבו.md"
node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/_scratch-test-גאבו.md" "2026-08-03T11:00:00+03:00" --dry-run
```

Expected: a `DRY-RUN (jewelry) — ...` block printing `summary: "שיחת תכשיטים — גאבו"`,
then `DRY-RUN — קובץ הליד עודכן, לא נוצר אירוע אמיתי`. Open
`דני/לידים/_scratch-test-גאבו.md` and confirm the `## Handoff` section now starts with:

```markdown
## Handoff — מסירה ליניב המעצב 📞
- **פגישה שנקבעה:** 2026-08-03T11:00:00+03:00 (DRY-RUN — לא נוצר אירוע אמיתי ביומן)
- **אופן העברה:** תיאום פגישה
מוכן ליניב — שיחת טלפון לסגירה. ...
```

Then delete the scratch file:

```bash
rm "דני/לידים/_scratch-test-גאבו.md"
```

- [ ] **Step 3: Manually verify the "slot no longer available" error path is reachable**

This can't be exercised without real credentials (it depends on a real calendar lookup),
so just confirm by reading the code in Step 1 that `isSlotAvailable` is called before
`createEvent`, and note in the PR description that this path will be exercised for real in
Task 11's end-to-end check once a real service account exists.

- [ ] **Step 4: Commit**

```bash
git add "דני/calendar/book-meeting.mjs"
git commit -m "Add book-meeting CLI for creating calendar events from a lead file"
```

---

### Task 9: `דני/calendar/README.md` — setup documentation

Mirrors `דני/crm/README.md` exactly in structure and tone.

**Files:**
- Create: `דני/calendar/README.md`

- [ ] **Step 1: Write the file**

Create `דני/calendar/README.md`:

```markdown
# שכבת חיבור יומן (Google Calendar) לדני ויהודה

קוד Node (בלי תלויות חיצוניות) שמאפשר לדני וליהודה להציע שעות פנויות ולקבוע פגישה
אמיתית ביומן — לפי תחום (תכשיטים / לימודים+סדנאות), לא לפי שם אדם. בנוי במקביל
לשכבת `דני/crm/`. עד שפרטי החשבון מגיעים, עובד ב-`--dry-run`.

## קבצים

| קובץ | תפקיד |
|------|-------|
| `config.mjs` | טוען `.env` (דרך `../lib/env.mjs`), חושף `getConfig(domain)` ו-`assertConfigured(config)`. |
| `availability.mjs` | לוגיקה טהורה: `computeAvailableSlots()` (שעות מוצעות) ו-`isSlotAvailable()` (בדיקת מרוץ). |
| `google-auth.mjs` | `signJwt()` + `getAccessToken()` — אימות מול Google OAuth2 עם Service Account, בלי SDK. |
| `client.mjs` | `listEvents()` / `createEvent()` — קריאות REST גולמיות ל-Google Calendar API v3. |
| `check-availability.mjs` | CLI: מחזיר 2-3 שעות פנויות. זו הנקודה שראובן מריץ כשדני/יהודה מבקשים הצעת שעות. |
| `book-meeting.mjs` | CLI: קובע את השעה שנבחרה ביומן, ומעדכן את קובץ הליד. |

## מוסכמת "פניות לקוחות"

בכל אחד משני היומנים, הנציג/ה הרלוונטי/ת יוצר/ת **אירוע חוזר** בכותרת קבועה
(ברירת מחדל: **"פניות לקוחות"**, ניתן לשינוי ב-`CALENDAR_BLOCK_TITLE`). זהו החלון
שבו הוא/היא פנוי/ה לשיחות שנקבעות דרך הסוכנים. הסקריפטים מציעים שעות **רק** בתוך
הבלוקים האלה — כל דבר מחוץ להם לא מוצע, גם אם היומן ריק שם.

## הקמה חד-פעמית (Google Cloud)

1. ב-Google Cloud Console: צור פרויקט (או השתמש בקיים) → הפעל את **Google Calendar
   API** → צור **Service Account** → צור לו מפתח JSON והורד אותו.
2. שמור את קובץ ה-JSON שהורדת בנתיב `דני/calendar/service-account.json`
   (כבר מוחרג מגיט ב-`.gitignore`).
3. ב-Google Calendar: שתף את **יומן התכשיטים** ואת **יומן הלימודים+סדנאות** עם
   כתובת המייל של ה-Service Account (`client_email` בתוך קובץ ה-JSON), בהרשאת
   **"ביצוע שינויים באירועים"**.
4. בכל אחד משני היומנים, צור אירוע חוזר בכותרת **"פניות לקוחות"** בטווחי הזמן
   שהנציג/ה פנוי/ה בהם.
5. מלא ב-`.env`: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`, `JEWELRY_CALENDAR_ID`,
   `STUDIES_CALENDAR_ID` (ראה `.env.example`).

## בדיקה עכשיו (בלי פרטי גישה) — `--dry-run`

```bash
node "דני/calendar/check-availability.mjs" jewelry --dry-run
node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/2026-06-12-גאבו.md" "2026-08-03T11:00:00+03:00" --dry-run
```

`--dry-run` מדפיס את מה שהיה נשלח/נוצר בלי לפנות ל-API — חוץ מעדכון קובץ הליד,
שקורה גם ב-dry-run (מסומן בבירור בטקסט "DRY-RUN — לא נוצר אירוע אמיתי ביומן").

## הפעלה אמיתית (כשה-Service Account מוכן)

1. ודא ששלבי ההקמה למעלה בוצעו (שיתוף היומנים + `.env` מלא).
2. הרץ בלי `--dry-run`:
   `node "דני/calendar/check-availability.mjs" jewelry`
   ואז, אחרי שהלקוח בחר שעה:
   `node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/<ליד>.md" "<שעה שנבחרה>"`
3. ודא שהאירוע נוצר ביומן האמיתי, ושקובץ הליד עודכן.
```

- [ ] **Step 2: Commit**

```bash
git add "דני/calendar/README.md"
git commit -m "Document calendar layer setup and dry-run testing"
```

---

### Task 10: Update the lead templates' Handoff section

Adds the new fields to all four places a Handoff section is defined, so both a freshly
created lead file and the flow described in the agent playbooks agree on the field names
`setField()` writes (`אופן העברה`, `פגישה שנקבעה`).

**Files:**
- Modify: `דני/לידים/_תבנית-ליד.md`
- Modify: `יהודה/לידים/_תבנית-ליד.md`
- Modify: `.claude/agents/dani.md` (embedded lead template, "## תבנית ליד" section)
- Modify: `.claude/agents/yehuda.md` (reference to the template — see Step 4)

- [ ] **Step 1: Update `דני/לידים/_תבנית-ליד.md`**

Old:
```markdown
## Handoff — השלב הבא
<תכנון / הדמיה / תלת-ממד / ייצור — מה צריך לקרות עכשיו>
```

New:
```markdown
## Handoff — השלב הבא
- **אופן העברה:** תיאום פגישה / חזרה מיידית
- **פגישה שנקבעה:** <תאריך ושעה, אם "תיאום פגישה"> / אין
- **הועבר לנציג/ה בתאריך/שעה:** <למסלול "חזרה מיידית" בלבד>

<תכנון / הדמיה / תלת-ממד / ייצור — מה צריך לקרות עכשיו>
```

- [ ] **Step 2: Update `יהודה/לידים/_תבנית-ליד.md`**

Old:
```markdown
## Handoff — השלב הבא
מוכן לסגירה עם יניב/טלי — שיחת ייעוץ אישית / הרשמה. פרטי קשר: <טלפון>.
נותר לסגור: <מועד התחלה / מחיר / פריסת תשלום / כל פתוח אחר>.
```

New:
```markdown
## Handoff — השלב הבא
- **אופן העברה:** תיאום פגישה / חזרה מיידית
- **פגישה שנקבעה:** <תאריך ושעה, אם "תיאום פגישה"> / אין
- **הועבר לנציג/ה בתאריך/שעה:** <למסלול "חזרה מיידית" בלבד>

מוכן לסגירה עם איש/אשת המכירות — שיחת ייעוץ אישית / הרשמה. פרטי קשר: <טלפון>.
נותר לסגור: <מועד התחלה / מחיר / פריסת תשלום / כל פתוח אחר>.
```

(Note: this also drops the old "יניב/טלי" wording per the approved spec — the studies
domain now hands off to a single sales rep, not named individuals.)

- [ ] **Step 3: Update the embedded template in `.claude/agents/dani.md`**

Find this block (in the "## תבנית ליד" section):

Old:
```markdown
## Handoff — מסירה ליניב המעצב 📞
מוכן ליניב — שיחת טלפון לסגירה. פרטי קשר: <מספר>. נותר לסגור: <מחיר סופי /
חומרים / לוח זמנים / כל פתוח אחר>.
```

New:
```markdown
## Handoff — מסירה ליניב המעצב 📞
- **אופן העברה:** תיאום פגישה / חזרה מיידית
- **פגישה שנקבעה:** <תאריך ושעה, אם "תיאום פגישה"> / אין
- **הועבר לנציג/ה בתאריך/שעה:** <למסלול "חזרה מיידית" בלבד>

מוכן ליניב — שיחת טלפון לסגירה. פרטי קשר: <מספר>. נותר לסגור: <מחיר סופי /
חומרים / לוח זמנים / כל פתוח אחר>.
```

- [ ] **Step 4: Update the template reference in `.claude/agents/yehuda.md`**

Find this line (in the "## תבנית ליד" section):

Old:
```markdown
## תבנית ליד

ראה `יהודה/לידים/_תבנית-ליד.md`. שדות המפתח: תאריך, מקור (בית הספר —
לימודים/סדנאות), ערוץ כניסה, שם מלא, טלפון, אימייל, עיר, אבחון (איך שמע, ניסיון,
מטרה, זמינות, תחום עניין), מסלול מומלץ, הערות, Handoff.
```

New:
```markdown
## תבנית ליד

ראה `יהודה/לידים/_תבנית-ליד.md`. שדות המפתח: תאריך, מקור (בית הספר —
לימודים/סדנאות), ערוץ כניסה, שם מלא, טלפון, אימייל, עיר, אבחון (איך שמע, ניסיון,
מטרה, זמינות, תחום עניין), מסלול מומלץ, הערות, Handoff (כולל אופן העברה: תיאום
פגישה / חזרה מיידית — ראה שלב 6 למטה).
```

- [ ] **Step 5: Commit**

```bash
git add "דני/לידים/_תבנית-ליד.md" "יהודה/לידים/_תבנית-ליד.md" ".claude/agents/dani.md" ".claude/agents/yehuda.md"
git commit -m "Add Handoff meeting fields to Dani and Yehuda lead templates"
```

---

### Task 11: Add the Stage 6 fork to `.claude/agents/dani.md`

**Files:**
- Modify: `.claude/agents/dani.md`

- [ ] **Step 1: Insert the fork before the existing handoff explanation**

Find this text in "### שלב 6 — סיכום והעברה ליניב (Handoff)":

Old:
```markdown
### שלב 6 — סיכום והעברה ליניב (Handoff)

סכם ללקוח את כל מה שסוכם (עיצוב נבחר, חריטה, מידה, תקציב, לוח זמנים), ועדכן בליד
את שלב ה-**handoff**: **כל העיצוב עובר ליניב המעצב, שסוגר את ההזמנה עם הלקוח
בשיחת טלפון.** רשום בליד "מוכן ליניב — שיחת טלפון לסגירה", כולל פרטי הקשר של
הלקוח והנקודות שנותרו לסגירה.
```

New:
```markdown
### שלב 6 — סיכום והעברה לנציג/ת המכירות (Handoff)

סכם ללקוח את כל מה שסוכם (עיצוב נבחר, חריטה, מידה, תקציב, לוח זמנים). לפני
המסירה בפועל, שאל את הלקוח איך הוא מעדיף להמשיך:

> "מעולה 🙏 אפשר לתאם איתך שיחה בזמן נוח, או שנציג/ת המכירות יחזור/תחזור אליך
> בהקדם — מה נוח לך יותר?"

**אם הלקוח בוחר "לתאם שיחה"** — בקש מראובן להריץ
`node "דני/calendar/check-availability.mjs" jewelry`, הצג ללקוח את 2-3 השעות
שיחזרו, ואחרי שבחר — בקש מראובן להריץ
`node "דני/calendar/book-meeting.mjs" jewelry "<קובץ-הליד>" "<השעה שנבחרה>"`.
אם ראובן מדווח ששום שעה לא פנויה, או שהשעה שנבחרה כבר נתפסה — התנצל בחום ובקש
מהלקוח שעה חלופית, ונסה שוב.

**אם הלקוח בוחר "חזרה בהקדם"** — בקש מראובן לשלוח שתי הודעות דרך
`דני/whatsapp/send.mjs`: הודעה דחופה לנציג/ת המכירות של תכשיטים (המספר ב-.env,
`JEWELRY_SALES_WHATSAPP`) עם שם הלקוח, תקציר קצר מהליד, ומספר הטלפון של הלקוח,
ובקשה לחזור תוך שעה; והודעת הרגעה ללקוח (**בלי לחשוף את מספר הנציג/ה**):
> "העברתי את הפרטים שלך לנציג/ת המכירות שלנו — הוא/היא יחזור/תחזור אליך תוך
> שעה לשיחה מקצועית שתסביר הכל 🙏"

בשני המקרים, עדכן בליד את שלב ה-**handoff** (ראה תבנית הליד למטה): **כל העיצוב
עובר ליניב המעצב, שסוגר את ההזמנה עם הלקוח בשיחת טלפון** — זה לא משתנה, רק אופן
המסירה (שעה שתואמה, או חזרה מיידית) הוא מה שמתעד עכשיו.
```

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/dani.md"
git commit -m "Add schedule-vs-urgent fork to Dani's handoff stage"
```

---

### Task 12: Add the Stage 6 fork to `.claude/agents/yehuda.md`

**Files:**
- Modify: `.claude/agents/yehuda.md`

- [ ] **Step 1: Insert the fork before the existing handoff explanation**

Find this text in "### שלב 6 — העברה לסגירה (Handoff)":

Old:
```markdown
### שלב 6 — העברה לסגירה (Handoff)

בסיום, אם המתעניין רוצה להתקדם / להירשם — הסבר בחום שאיש המכירות (**יניב/טלי**)
יחזור אליו לשיחת ייעוץ אישית / סגירת הרשמה (פרטים אחרונים, מועד התחלה, תשלום).
עדכן בליד את שלב ה-handoff עם פרטי הקשר והנקודות שנותרו לסגירה.
```

New:
```markdown
### שלב 6 — העברה לסגירה (Handoff)

בסיום, אם המתעניין רוצה להתקדם / להירשם, שאל אותו איך הוא מעדיף להמשיך:

> "מעולה 🙏 אפשר לתאם איתך שיחה בזמן נוח עם איש/אשת המכירות, או שהוא/היא יחזור/
> תחזור אליך בהקדם — מה נוח לך יותר?"

**אם בוחר/ת "לתאם שיחה"** — בקש מראובן להריץ
`node "דני/calendar/check-availability.mjs" studies`, הצג 2-3 שעות, ואחרי בחירה —
בקש מראובן להריץ
`node "דני/calendar/book-meeting.mjs" studies "<קובץ-הליד>" "<השעה שנבחרה>"`.
אם שום שעה לא פנויה, או שהשעה שנבחרה כבר נתפסה — התנצל בחום ובקש שעה חלופית.

**אם בוחר/ת "חזרה בהקדם"** — בקש מראובן לשלוח שתי הודעות דרך
`דני/whatsapp/send.mjs`: הודעה דחופה לאיש/אשת המכירות של לימודים+סדנאות (המספר
ב-.env, `STUDIES_SALES_WHATSAPP`) עם שם המתעניין, תקציר קצר מהליד, ומספר הטלפון
שלו, ובקשה לחזור תוך שעה; והודעת הרגעה למתעניין (**בלי לחשוף את מספר הנציג/ה**):
> "העברתי את הפרטים שלך לאיש/אשת המכירות שלנו — הוא/היא יחזור/תחזור אליך תוך
> שעה לשיחה מקצועית שתסביר הכל 🙏"

בשני המקרים, עדכן בליד את שלב ה-handoff עם פרטי הקשר והנקודות שנותרו לסגירה.
```

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/yehuda.md"
git commit -m "Add schedule-vs-urgent fork to Yehuda's handoff stage"
```

---

### Task 13: Document the new setup requirements in `דני/מה-צריך-ממך.md`

**Files:**
- Modify: `דני/מה-צריך-ממך.md`

- [ ] **Step 1: Add a new numbered section**

Find this text (the start of section 4):

Old:
```markdown
## 4. מיתוג ומידע עסקי 🟨 כדאי (משפר איכות)
```

New (inserts a new section 4, renumbering the old section 4 to 5 and old section 5 to 6):

```markdown
## 4. תיאום פגישות ביומן + חזרה דחופה 🟨 כדאי (משפר את חוויית הסגירה)

שכבת `דני/calendar/` בנויה ונבדקה ב-`--dry-run` (ראה `דני/calendar/README.md`).
כדי להפעיל אותה חי צריך ממך:

1. **Service Account ב-Google Cloud** עם Calendar API מופעל, וקובץ ה-JSON שלו
   שמור ב-`דני/calendar/service-account.json` (מוחרג מגיט).
2. **שיתוף שני היומנים** — יומן תכשיטים ויומן לימודים+סדנאות — עם כתובת המייל
   של ה-Service Account, בהרשאת "ביצוע שינויים באירועים".
3. **אירוע חוזר "פניות לקוחות"** בכל אחד משני היומנים, בטווחי הזמן שהנציג/ה
   הרלוונטי/ת פנוי/ה בהם לשיחות עם לקוחות.
4. **מספרי הוואטסאפ** של נציג/ת המכירות של תכשיטים ושל נציג/ת המכירות של
   לימודים+סדנאות — למסלול "חזרה בהקדם" (הלקוח לא רואה את המספרים האלה).
5. `.env`: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`, `JEWELRY_CALENDAR_ID`,
   `STUDIES_CALENDAR_ID`, `JEWELRY_SALES_WHATSAPP`, `STUDIES_SALES_WHATSAPP`.

עד שכל אלה קיימים — דני ויהודה ממשיכים לעבוד כרגיל, רק בלי לתאם שעה בפועל
(מציינים בליד "מוכן ל[נציג] — שיחת טלפון לסגירה", ללא שעה קבועה).

## 5. מיתוג ומידע עסקי 🟨 כדאי (משפר איכות)
```

Then find the old section 5 heading further down and renumber it to 6:

Old:
```markdown
## 5. כבר קיים — לא צריך ממך ✅
```

New:
```markdown
## 6. כבר קיים — לא צריך ממך ✅
```

- [ ] **Step 2: Commit**

```bash
git add "דני/מה-צריך-ממך.md"
git commit -m "Document calendar + urgent-callback setup requirements"
```

---

### Task 14: Update `CLAUDE.md` — mention the new capability

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Extend the Dani CRM-push sentence to mention calendar scheduling**

Find this text (in the "ניתוב לדני" section):

Old:
```markdown
עברית: לקוח חדש, ייעוץ תכשיט, שיחת היכרות, אין לי מושג מה אני רוצה, תפתיעו אותי, בריף, ליד
- English: new client, jewelry consultation, intake, design brief, lead, "surprise me"

דני עובד עם Read, Write, Edit, Glob (לניהול קובצי לידים). **חיבור טכני:** שכבות
ה-WhatsApp (`דני/whatsapp/`) וה-CRM (`דני/crm/`, fixdigital) **כבר נבנו** ונבדקו
ב-`--dry-run`; כל אחת מחכה רק לפרטי הגישה שלה ב-`.env`. את דחיפת הליד ל-CRM מבצע
**ראובן** (Bash: `node "דני/crm/create-lead.mjs" "<קובץ-ליד>"`) — דני עצמו לא ניגש ל-CRM.
```

New:
```markdown
עברית: לקוח חדש, ייעוץ תכשיט, שיחת היכרות, אין לי מושג מה אני רוצה, תפתיעו אותי, בריף, ליד
- English: new client, jewelry consultation, intake, design brief, lead, "surprise me"

דני עובד עם Read, Write, Edit, Glob (לניהול קובצי לידים). **חיבור טכני:** שכבות
ה-WhatsApp (`דני/whatsapp/`), ה-CRM (`דני/crm/`, fixdigital) וה-יומן
(`דני/calendar/`, Google Calendar) **כבר נבנו** ונבדקו ב-`--dry-run`; כל אחת
מחכה רק לפרטי הגישה שלה ב-`.env`. את דחיפת הליד ל-CRM מבצע **ראובן**
(Bash: `node "דני/crm/create-lead.mjs" "<קובץ-ליד>"`), ואת הצעת/קביעת הפגישה
ביומן מבצע גם הוא (`node "דני/calendar/check-availability.mjs" jewelry` ואז
`node "דני/calendar/book-meeting.mjs" jewelry "<קובץ-ליד>" "<שעה>"`) — דני עצמו
לא ניגש ישירות ל-CRM או ליומן.
```

- [ ] **Step 2: Add the same calendar mention to the Yehuda routing section**

Find this text (in the "ניתוב ליהודה" section):

Old:
```markdown
יהודה עובד עם Read, Write, Edit, Glob (לניהול קובצי הלידים ובסיס הידע). הוא **משתף
תשתית WhatsApp+CRM עם דני** (`דני/whatsapp/`, `דני/crm/`); הליד מסומן כמקור "בית
הספר — לימודים/סדנאות". את דחיפת הליד ל-CRM מבצע **ראובן**
(`node "דני/crm/create-lead.mjs" "<קובץ-ליד>"`; `--dry-run` עד שמזהי החשבון ב-`.env`)
— יהודה עצמו לא ניגש ל-CRM. ההעברה לסגירה היא ל**יניב/טלי** (איש המכירות).
```

New:
```markdown
יהודה עובד עם Read, Write, Edit, Glob (לניהול קובצי הלידים ובסיס הידע). הוא **משתף
תשתית WhatsApp+CRM+יומן עם דני** (`דני/whatsapp/`, `דני/crm/`, `דני/calendar/`);
הליד מסומן כמקור "בית הספר — לימודים/סדנאות". את דחיפת הליד ל-CRM מבצע **ראובן**
(`node "דני/crm/create-lead.mjs" "<קובץ-ליד>"`; `--dry-run` עד שמזהי החשבון ב-`.env`),
ואת הצעת/קביעת הפגישה ביומן מבצע גם הוא (`check-availability.mjs studies` /
`book-meeting.mjs studies`) — יהודה עצמו לא ניגש ישירות ל-CRM או ליומן. ההעברה
לסגירה היא לאיש/אשת המכירות של לימודים+סדנאות (תיאום שעה, או חזרה בהקדם).
```

- [ ] **Step 3: Add `דני/calendar/` to the folder-structure section**

Find this text (in "## מבנה הת folders", the bullet describing `דני/`):

Old:
```markdown
- `דני/` — סביבת העבודה של דני (`לידים/` — קובץ MD לכל ליד, בתבנית
  `<YYYY-MM-DD>-<שם-לקוח>.md`; `_תבנית-ליד.md` היא תבנית הבסיס). **מבנה-גשר** עד
  לחיבור ה-CRM: שדות הליד ממופים מראש לשדות CRM, וכשיגיעו פרטי הגישה הכתיבה
  תעבור ישירות ל-CRM. שכבות ה-WhatsApp (`דני/whatsapp/`) וה-CRM (`דני/crm/`)
  משותפות גם ליהודה.
```

New:
```markdown
- `דני/` — סביבת העבודה של דני (`לידים/` — קובץ MD לכל ליד, בתבנית
  `<YYYY-MM-DD>-<שם-לקוח>.md`; `_תבנית-ליד.md` היא תבנית הבסיס). **מבנה-גשר** עד
  לחיבור ה-CRM: שדות הליד ממופים מראש לשדות CRM, וכשיגיעו פרטי הגישה הכתיבה
  תעבור ישירות ל-CRM. שכבות ה-WhatsApp (`דני/whatsapp/`), ה-CRM (`דני/crm/`)
  וה-יומן (`דני/calendar/` — הצעת שעות + קביעת פגישה ב-Google Calendar, לפי
  תחום: תכשיטים / לימודים+סדנאות) משותפות גם ליהודה.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the calendar scheduling capability in Reuven's playbook"
```

---

### Task 15: End-to-end dry-run verification (both domains)

Final manual pass confirming every new piece works together, using scratch copies so no
real lead files are left modified.

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `node --test "דני/lib/lead-fields.test.mjs" "דני/calendar/config.test.mjs" "דני/calendar/availability.test.mjs" "דני/calendar/google-auth.test.mjs"`
Expected: all tests pass (19 tests total across the four files).

- [ ] **Step 2: Dry-run the jewelry domain end-to-end**

```bash
node "דני/calendar/check-availability.mjs" jewelry --dry-run
cp "דני/לידים/2026-06-12-גאבו.md" "דני/לידים/_scratch-e2e-גאבו.md"
node "דני/calendar/book-meeting.mjs" jewelry "דני/לידים/_scratch-e2e-גאבו.md" "2026-08-03T11:00:00+03:00" --dry-run
```

Confirm the printed slots match `check-availability.mjs`'s fixed dry-run list, and the
scratch lead file's `## Handoff` section now contains the new `אופן העברה` /
`פגישה שנקבעה` fields. Delete the scratch file afterward:
`rm "דני/לידים/_scratch-e2e-גאבו.md"`.

- [ ] **Step 3: Dry-run the studies domain end-to-end**

Create a throwaway lead file from the Yehuda template so there's something to update
(no real Yehuda lead exists yet):

```bash
cp "יהודה/לידים/_תבנית-ליד.md" "יהודה/לידים/_scratch-e2e-test.md"
node "דני/calendar/check-availability.mjs" studies --dry-run
node "דני/calendar/book-meeting.mjs" studies "יהודה/לידים/_scratch-e2e-test.md" "2026-08-04T14:00:00+03:00" --dry-run
```

Confirm the same shape of output as Step 2, then delete the scratch file:
`rm "יהודה/לידים/_scratch-e2e-test.md"`.

- [ ] **Step 4: Confirm the working tree is clean**

Run: `git status`
Expected: no uncommitted changes (all scratch files were deleted, everything real was
committed in earlier tasks).

- [ ] **Step 5: Update `דני/מה-צריך-ממך.md`'s summary line if needed**

No code change — just confirm the "סיכום — המינימום כדי לצאת לדרך" section at the
bottom of the file still reads correctly given the new section 4 (it doesn't reference
calendar scheduling as part of the minimum viable setup, which is correct — calendar
scheduling is an enhancement, not a blocker for going live).
