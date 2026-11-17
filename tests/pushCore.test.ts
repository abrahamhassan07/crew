import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessages, chunk, deadTokens, isExpoToken, safeTarget, time12, tomorrowNote, type ExpoMessage } from "../src/lib/pushCore.ts";

const T1 = "ExponentPushToken[abcdefghijklmnop]";
const T2 = "ExponentPushToken[qrstuvwxyz012345]";

test("accepts only Expo push tokens", () => {
  assert.equal(isExpoToken(T1), true);
  assert.equal(isExpoToken("ExpoPushToken[abcdefghijklmnop]"), true);
  assert.equal(isExpoToken("abc"), false);
  assert.equal(isExpoToken("ExponentPushToken[<script>]"), false);
  assert.equal(isExpoToken(42), false);
  assert.equal(isExpoToken(`ExponentPushToken[${"a".repeat(300)}]`), false);
});

test("notification taps only open our own screens and paths", () => {
  assert.ok(safeTarget({ kind: "job", jobId: "8b1f2c3d-1111-2222-3333-444455556666" }));
  assert.equal(safeTarget({ kind: "job", jobId: "../x" }), null);
  assert.ok(safeTarget({ kind: "today", date: "2026-11-18" }));
  assert.equal(safeTarget({ kind: "today", date: "tomorrow" }), null);
  assert.ok(safeTarget({ kind: "web", path: "/invoices/abc" }));
  assert.equal(safeTarget({ kind: "web", path: "//evil.example" }), null);
  assert.equal(safeTarget({ kind: "web", path: "https://evil.example" }), null);
  assert.equal(safeTarget({ kind: "web", path: "javascript:alert(1)" }), null);
});

test("builds one message per unique valid token and clips long text", () => {
  const msgs = buildMessages([T1, T1, "junk", T2], { title: "x".repeat(200), body: "y".repeat(500), target: { kind: "today", date: "2026-11-18" } });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].title.length, 80);
  assert.equal(msgs[0].body.length, 180);
  assert.ok(msgs[0].body.endsWith("…"));
  assert.deepEqual(msgs[0].data, { kind: "today", date: "2026-11-18" });
});

test("sends nothing for an unsafe target", () => {
  assert.deepEqual(buildMessages([T1], { title: "a", body: "b", target: { kind: "web", path: "//x" } }), []);
});

test("chunks into Expo-sized batches", () => {
  const out = chunk(Array.from({ length: 250 }, (_, i) => i));
  assert.deepEqual(out.map((c) => c.length), [100, 100, 50]);
});

test("forgets only tokens Expo reports as unregistered", () => {
  const msgs = buildMessages([T1, T2], { title: "a", body: "b", target: { kind: "today", date: "2026-11-18" } }) as ExpoMessage[];
  const dead = deadTokens(msgs, [
    { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    { status: "error", message: "busy", details: { error: "MessageRateExceeded" } },
  ]);
  assert.deepEqual(dead, [T1]);
  assert.deepEqual(deadTokens(msgs, [{ status: "ok", id: "1" }]), []);
});

test("formats times like the site", () => {
  assert.equal(time12("08:00:00"), "8:00 AM");
  assert.equal(time12("12:30"), "12:30 PM");
  assert.equal(time12("00:05"), "12:05 AM");
  assert.equal(time12(null), "");
});

test("tomorrow's push names the count and the earliest job", () => {
  const note = tomorrowNote("2026-11-18", [
    { start_time: "13:00:00", client_name: "Late" },
    { start_time: null, client_name: "Whenever" },
    { start_time: "08:30:00", client_name: "Early" },
  ]);
  assert.equal(note?.title, "3 jobs tomorrow");
  assert.equal(note?.body, "First at 8:30 AM: Early");
  assert.deepEqual(note?.target, { kind: "today", date: "2026-11-18" });
  assert.equal(tomorrowNote("2026-11-18", [{ start_time: null, client_name: "Solo" }])?.title, "1 job tomorrow");
  assert.equal(tomorrowNote("2026-11-18", []), null);
});
