import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/photos";
import { cleanupExpired, sweepOrphanedOrgs, type CleanupResult } from "@/lib/photoCleanupCore";

export type { CleanupResult };

/** Daily cleanup: expired photos, then files left behind by deleted businesses. See photoCleanupCore.ts. */
export async function runPhotoCleanup(dryRun = false): Promise<CleanupResult> {
  const admin = createAdminClient();
  const bucket = () => admin.storage.from(BUCKET);

  const result = await cleanupExpired(
    {
      async listDue(limit) {
        const { data, error } = await admin.from("job_photos").select("id, storage_path, size_bytes").eq("preserved", false).lt("expires_at", new Date().toISOString()).order("expires_at", { ascending: true }).limit(limit);
        return { rows: data ?? [], error: error?.message };
      },
      async removeFiles(paths) {
        const { error } = await bucket().remove(paths);
        return { error: error?.message };
      },
      async deleteRows(ids) {
        const { error } = await admin.from("job_photos").delete().in("id", ids).eq("preserved", false);
        return { error: error?.message };
      },
      async log(entry) {
        await admin.from("photo_cleanup_runs").insert(entry);
      },
    },
    { dryRun },
  );

  const list = async (prefix: string) => {
    const out: { name: string; folder: boolean }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket().list(prefix, { limit: 1000, offset });
      if (error) return { entries: out, error: error.message };
      for (const e of data ?? []) out.push({ name: e.name, folder: e.id == null });
      if (!data || data.length < 1000) return { entries: out };
    }
  };

  const orphans = await sweepOrphanedOrgs(
    {
      async listOrgFolders() {
        const r = await list("");
        return { names: r.entries.filter((e) => e.folder).map((e) => e.name), error: r.error };
      },
      async existingOrgIds(ids) {
        const found = new Set<string>();
        for (let i = 0; i < ids.length; i += 100) {
          const { data, error } = await admin.from("organizations").select("id").in("id", ids.slice(i, i + 100));
          if (error) return { ids: found, error: error.message };
          for (const o of data ?? []) found.add(o.id);
        }
        return { ids: found };
      },
      async listFilesUnder(org) {
        const jobs = await list(org);
        if (jobs.error) return { paths: [], error: jobs.error };
        const paths = jobs.entries.filter((e) => !e.folder).map((e) => `${org}/${e.name}`);
        for (const job of jobs.entries.filter((e) => e.folder)) {
          const files = await list(`${org}/${job.name}`);
          if (files.error) return { paths, error: files.error };
          paths.push(...files.entries.filter((e) => !e.folder).map((e) => `${org}/${job.name}/${e.name}`));
        }
        return { paths };
      },
      async removeFiles(paths) {
        const { error } = await bucket().remove(paths);
        return { error: error?.message };
      },
    },
    { dryRun },
  );
  result.orphanFilesDeleted = orphans.filesDeleted;
  if (orphans.error) result.detail = `${result.detail}; orphan sweep: ${orphans.error}`.slice(0, 500);
  if (!dryRun && (orphans.filesDeleted || orphans.error)) {
    await admin.from("photo_cleanup_runs").insert({ photos_deleted: 0, files_failed: orphans.error ? 1 : 0, bytes_freed: 0, detail: `orphan sweep: ${orphans.error ?? `${orphans.filesDeleted} files from ${orphans.orgs} deleted business(es)`}`.slice(0, 500) });
  }
  return result;
}
