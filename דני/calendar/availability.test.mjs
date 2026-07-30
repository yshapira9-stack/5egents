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
