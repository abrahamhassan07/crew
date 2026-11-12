import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/errors";
import { JOB_SNAPSHOT_COLUMNS, notifyJobChange, type JobSnapshot } from "@/lib/staffNotify";
import type { Database, JobStatus } from "@/lib/supabase/types";

/**
 * Job changes shared by the site (server actions) and the phone app (/api/app/*). The database client must act as the
 * signed-in person, so the normal row rules decide what they may change (staff: only status and checklist of their own
 * jobs).
 */

type Db = SupabaseClient<Database>;
type Result = { ok: true } | { ok: false; error: string };

export const JOB_STATUSES: JobStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];
export { cleanChecklist } from "@/lib/checklist";

export async function setJobStatus(db: Db, actor: { orgId: string; staffId: string | null }, id: string, status: JobStatus): Promise<Result> {
  if (!JOB_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const { data: before } = status === "cancelled" ? await db.from("jobs").select(JOB_SNAPSHOT_COLUMNS).eq("id", id).single() : { data: null };
  const { data: updated, error } = await db.from("jobs").update({ status }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!updated?.length) return { ok: false, error: "That job wasn't found." };
  if (before) {
    const { orgId, staffId } = actor;
    after(() => notifyJobChange(orgId, before as JobSnapshot, { ...(before as JobSnapshot), status }, staffId));
  }
  return { ok: true };
}

export async function setJobChecklist(db: Db, id: string, checklist: { t: string; done: boolean }[]): Promise<Result> {
  const { data: updated, error } = await db.from("jobs").update({ checklist }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!updated?.length) return { ok: false, error: "That job wasn't found." };
  return { ok: true };
}
