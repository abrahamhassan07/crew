import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/photos";

export type CleanupResult = { photosDeleted: number; filesFailed: number; bytesFreed: number; detail: string };

/**
 * Daily cleanup: deletes photos past their expiry unless the owner kept them. Files are removed first; a row is only
 * deleted once its file is gone, so a storage failure leaves the row to be retried tomorrow instead of orphaning a file.
 * Safe to run twice (a photo already deleted is simply not found). Each run is logged.
 */
export async function runPhotoCleanup(dryRun = false): Promise<CleanupResult> {
  const admin = createAdminClient();
  const result: CleanupResult = { photosDeleted: 0, filesFailed: 0, bytesFreed: 0, detail: "" };
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  // Up to 1000 per run keeps the job inside the serverless time limit; anything left is picked up the next day.
  const { data: due, error } = await admin.from("job_photos").select("id, storage_path, size_bytes").eq("preserved", false).lt("expires_at", nowIso).order("expires_at", { ascending: true }).limit(1000);
  if (error) {
    result.detail = `query failed: ${error.message}`;
    if (!dryRun) await admin.from("photo_cleanup_runs").insert({ photos_deleted: 0, files_failed: 1, bytes_freed: 0, detail: result.detail });
    return result;
  }
  const rows = due ?? [];
  if (dryRun) {
    result.photosDeleted = rows.length;
    result.bytesFreed = rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
    result.detail = "dry run";
    return result;
  }
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(batch.map((r) => r.storage_path));
    if (rmErr) {
      result.filesFailed += batch.length;
      errors.push(rmErr.message);
      continue;
    }
    const { error: delErr } = await admin.from("job_photos").delete().in("id", batch.map((r) => r.id)).eq("preserved", false);
    if (delErr) {
      result.filesFailed += batch.length;
      errors.push(delErr.message);
      continue;
    }
    result.photosDeleted += batch.length;
    result.bytesFreed += batch.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  }
  result.detail = errors.length ? errors.slice(0, 3).join("; ").slice(0, 500) : rows.length ? "ok" : "nothing due";
  // Only log runs that did something or failed; a quiet day writes nothing.
  if (rows.length) await admin.from("photo_cleanup_runs").insert({ photos_deleted: result.photosDeleted, files_failed: result.filesFailed, bytes_freed: result.bytesFreed, detail: result.detail });
  return result;
}
