import test from "node:test";
import assert from "node:assert/strict";
import { cleanupExpired, sweepOrphanedOrgs, type CleanupDeps, type DueRow, type OrphanDeps } from "../src/lib/photoCleanupCore.ts";

// An in-memory bucket and table, with switches to make storage or the database fail.
function world(n: number, opts: { failRemove?: (call: number) => boolean; failDelete?: boolean; failList?: boolean } = {}) {
  const files = new Set<string>();
  const rows = new Map<string, DueRow>();
  for (let i = 0; i < n; i++) {
    const r = { id: `p${i}`, storage_path: `org/job/${i}.jpg`, size_bytes: 1000 };
    rows.set(r.id, r);
    files.add(r.storage_path);
  }
  const logs: { photos_deleted: number; files_failed: number; detail: string }[] = [];
  let removeCalls = 0;
  const deps: CleanupDeps = {
    async listDue(limit) {
      return opts.failList ? { rows: [], error: "db down" } : { rows: [...rows.values()].slice(0, limit) };
    },
    async removeFiles(paths) {
      removeCalls++;
      if (opts.failRemove?.(removeCalls)) return { error: "storage unavailable" };
      for (const p of paths) files.delete(p);
      return {};
    },
    async deleteRows(ids) {
      if (opts.failDelete) return { error: "db write failed" };
      for (const id of ids) rows.delete(id);
      return {};
    },
    async log(e) {
      logs.push(e);
    },
  };
  return { files, rows, logs, deps };
}

test("normal run deletes files and rows together", async () => {
  const w = world(250);
  const r = await cleanupExpired(w.deps);
  assert.equal(r.photosDeleted, 250);
  assert.equal(r.filesFailed, 0);
  assert.equal(w.rows.size, 0);
  assert.equal(w.files.size, 0);
  assert.equal(w.logs.length, 1);
});

test("storage failure keeps the rows so nothing is orphaned, and logs it", async () => {
  const w = world(50, { failRemove: () => true });
  const r = await cleanupExpired(w.deps);
  assert.equal(r.photosDeleted, 0);
  assert.equal(r.filesFailed, 50);
  assert.equal(w.rows.size, 50, "rows kept for tomorrow");
  assert.equal(w.files.size, 50, "files untouched");
  assert.match(w.logs[0].detail, /storage unavailable/);
  assert.equal(w.logs[0].files_failed, 50);
});

test("a failure in one batch doesn't stop the others; the failed batch is retried next run", async () => {
  const w = world(250, { failRemove: (call) => call === 2 }); // second batch of 100 fails once
  const first = await cleanupExpired(w.deps);
  assert.equal(first.photosDeleted, 150);
  assert.equal(first.filesFailed, 100);
  assert.equal(w.rows.size, 100);
  // Every remaining row still has its file: no orphans, no dangling rows.
  for (const r of w.rows.values()) assert.ok(w.files.has(r.storage_path));
  const second = await cleanupExpired(w.deps);
  assert.equal(second.photosDeleted, 100);
  assert.equal(w.rows.size, 0);
  assert.equal(w.files.size, 0);
});

test("database delete failure after files are removed is reported, and the next run finishes the job", async () => {
  const w = world(10, { failDelete: true });
  const r = await cleanupExpired(w.deps);
  assert.equal(r.filesFailed, 10);
  assert.match(r.detail, /db write failed/);
  assert.equal(w.rows.size, 10);
  // Next run: removing already-missing files succeeds, so the rows are cleared.
  const ok = { ...w.deps, deleteRows: async (ids: string[]) => (ids.forEach((id) => w.rows.delete(id)), {}) };
  const r2 = await cleanupExpired(ok);
  assert.equal(r2.photosDeleted, 10);
  assert.equal(w.rows.size, 0);
});

test("query failure is logged and deletes nothing; dry run changes nothing and logs nothing", async () => {
  const w = world(5, { failList: true });
  const r = await cleanupExpired(w.deps);
  assert.match(r.detail, /query failed/);
  assert.equal(w.files.size, 5);
  assert.equal(w.logs.length, 1);
  const d = world(5);
  const dr = await cleanupExpired(d.deps, { dryRun: true });
  assert.equal(dr.photosDeleted, 5);
  assert.equal(d.files.size, 5);
  assert.equal(d.logs.length, 0);
});

const LIVE = "11111111-1111-4111-8111-111111111111";
const GONE = "22222222-2222-4222-8222-222222222222";
function bucket(opts: { lookupFails?: boolean; partialLookup?: boolean } = {}) {
  const files = new Set([`${LIVE}/j1/a.jpg`, `${LIVE}/j2/b.jpg`, `${GONE}/j9/c.jpg`, `${GONE}/j9/d.jpg`, `not-a-business/x.jpg`]);
  const deps: OrphanDeps = {
    async listOrgFolders() {
      return { names: [...new Set([...files].map((f) => f.split("/")[0]))] };
    },
    async existingOrgIds(ids) {
      if (opts.lookupFails) return { ids: new Set(), error: "db down" };
      return { ids: new Set(ids.filter((i) => i === LIVE)) };
    },
    async listFilesUnder(prefix) {
      return { paths: [...files].filter((f) => f.startsWith(`${prefix}/`)) };
    },
    async removeFiles(paths) {
      paths.forEach((p) => files.delete(p));
      return {};
    },
  };
  return { files, deps };
}

test("orphan sweep removes only files of businesses that no longer exist", async () => {
  const b = bucket();
  const r = await sweepOrphanedOrgs(b.deps);
  assert.equal(r.filesDeleted, 2);
  assert.deepEqual([...b.files].sort(), [`${LIVE}/j1/a.jpg`, `${LIVE}/j2/b.jpg`, "not-a-business/x.jpg"]);
});

test("orphan sweep deletes nothing if the business lookup fails", async () => {
  const b = bucket({ lookupFails: true });
  const r = await sweepOrphanedOrgs(b.deps);
  assert.equal(r.filesDeleted, 0);
  assert.match(r.error!, /db down/);
  assert.equal(b.files.size, 5);
});
