// The photo cleanup logic, separated from Supabase so it can be tested with fake storage (including storage that
// fails). photoCleanup.ts wires it to the real database and bucket.

export type DueRow = { id: string; storage_path: string; size_bytes: number | null };
export type CleanupResult = { photosDeleted: number; filesFailed: number; bytesFreed: number; orphanFilesDeleted: number; detail: string };

export interface CleanupDeps {
  /** Expired, not-kept photos, oldest first (at most `limit`). */
  listDue(limit: number): Promise<{ rows: DueRow[]; error?: string }>;
  removeFiles(paths: string[]): Promise<{ error?: string }>;
  /** Deletes rows by id, but only ones still not kept (an owner may have pressed Keep in the meantime). */
  deleteRows(ids: string[]): Promise<{ error?: string }>;
  log(entry: { photos_deleted: number; files_failed: number; bytes_freed: number; detail: string }): Promise<void>;
}

export interface OrphanDeps {
  /** Top-level folder names in the bucket (one per business id), or an error. */
  listOrgFolders(): Promise<{ names: string[]; error?: string }>;
  /** Which of these business ids still exist, or an error. Must be complete: a partial answer would delete real files. */
  existingOrgIds(ids: string[]): Promise<{ ids: Set<string>; error?: string }>;
  /** Every file path under a folder (recursively), or an error. */
  listFilesUnder(prefix: string): Promise<{ paths: string[]; error?: string }>;
  removeFiles(paths: string[]): Promise<{ error?: string }>;
}

const BATCH = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes photos past their expiry unless kept. Files go first; a row is deleted only once its file is gone, so a
 * storage failure leaves the row for tomorrow instead of orphaning a file. Safe to run twice. Logs runs that did
 * something or failed.
 */
export async function cleanupExpired(deps: CleanupDeps, opts: { dryRun?: boolean; limit?: number } = {}): Promise<CleanupResult> {
  const result: CleanupResult = { photosDeleted: 0, filesFailed: 0, bytesFreed: 0, orphanFilesDeleted: 0, detail: "" };
  const { rows, error } = await deps.listDue(opts.limit ?? 1000);
  if (error) {
    result.detail = `query failed: ${error}`;
    if (!opts.dryRun) await deps.log({ photos_deleted: 0, files_failed: 1, bytes_freed: 0, detail: result.detail.slice(0, 500) });
    return result;
  }
  if (opts.dryRun) {
    result.photosDeleted = rows.length;
    result.bytesFreed = rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
    result.detail = "dry run";
    return result;
  }
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const rm = await deps.removeFiles(batch.map((r) => r.storage_path));
    if (rm.error) {
      result.filesFailed += batch.length;
      errors.push(`storage: ${rm.error}`);
      continue; // rows stay, so tomorrow's run tries these files again
    }
    const del = await deps.deleteRows(batch.map((r) => r.id));
    if (del.error) {
      result.filesFailed += batch.length;
      errors.push(`rows: ${del.error}`);
      continue;
    }
    result.photosDeleted += batch.length;
    result.bytesFreed += batch.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  }
  result.detail = errors.length ? errors.slice(0, 3).join("; ").slice(0, 500) : rows.length ? "ok" : "nothing due";
  if (rows.length) await deps.log({ photos_deleted: result.photosDeleted, files_failed: result.filesFailed, bytes_freed: result.bytesFreed, detail: result.detail });
  return result;
}

/**
 * Removes photo files left behind when a whole business was deleted (its database rows cascade away, its files don't).
 * Fails safe: any lookup error means nothing is deleted this run. Only folders named like a business id are touched.
 */
export async function sweepOrphanedOrgs(deps: OrphanDeps, opts: { dryRun?: boolean; maxOrgs?: number } = {}): Promise<{ filesDeleted: number; orgs: number; error?: string }> {
  const folders = await deps.listOrgFolders();
  if (folders.error) return { filesDeleted: 0, orgs: 0, error: `list: ${folders.error}` };
  const ids = folders.names.filter((n) => UUID.test(n));
  if (!ids.length) return { filesDeleted: 0, orgs: 0 };
  const existing = await deps.existingOrgIds(ids);
  if (existing.error) return { filesDeleted: 0, orgs: 0, error: `lookup: ${existing.error}` };
  const gone = ids.filter((id) => !existing.ids.has(id)).slice(0, opts.maxOrgs ?? 20);
  let filesDeleted = 0;
  for (const org of gone) {
    const files = await deps.listFilesUnder(org);
    if (files.error) return { filesDeleted, orgs: gone.length, error: `list ${org}: ${files.error}` };
    if (opts.dryRun) {
      filesDeleted += files.paths.length;
      continue;
    }
    for (let i = 0; i < files.paths.length; i += BATCH) {
      const rm = await deps.removeFiles(files.paths.slice(i, i + BATCH));
      if (rm.error) return { filesDeleted, orgs: gone.length, error: `remove: ${rm.error}` };
      filesDeleted += Math.min(BATCH, files.paths.length - i);
    }
  }
  return { filesDeleted, orgs: gone.length };
}
