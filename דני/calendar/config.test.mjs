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
