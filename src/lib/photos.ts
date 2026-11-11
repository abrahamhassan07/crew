import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer, type Viewer } from "@/lib/auth";
import { photosAllowed } from "@/lib/billing";
import type { Job, JobPhoto } from "@/lib/supabase/types";

// Job photos. The storage bucket is private and has no policies, so nothing is reachable by URL. Everything goes
// through the server, which checks WHO is asking and WHICH job it is for, then uses the service role. Owners and
// admins can use any job in their business; staff only jobs assigned to them. Links to files are signed and short-lived.

export const BUCKET = "job-photos";
export const SIGNED_URL_SECONDS = 600; // dashboard and staff views
export const GALLERY_URL_SECONDS = 3600; // customer gallery page (re-signed on every page load)

export type PhotoContext = { ok: true; viewer: Viewer; isAdmin: boolean; job: Job; planAllowed: boolean } | { ok: false; error: string };

/** Whether the signed-in person may work with this job's photos. */
export async function photoContext(jobId: string): Promise<PhotoContext> {
  const viewer = await getViewer();
  const isAdmin = viewer.profile.role === "admin";
  if (!isAdmin && !(viewer.profile.role === "staff" && viewer.staff)) return { ok: false, error: "Not allowed." };
  const { data: job } = await createAdminClient().from("jobs").select("*").eq("id", jobId).eq("org_id", viewer.orgId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };
  if (!isAdmin && job.assigned_staff_id !== viewer.staff!.id) return { ok: false, error: "That job isn't assigned to you." };
  const { data: org } = await createAdminClient().from("organizations").select("*").eq("id", viewer.orgId).single();
  return { ok: true, viewer, isAdmin, job, planAllowed: photosAllowed(org) };
}

/** Shown when a plan without photos tries to add or share one. */
export const PHOTOS_PLAN_MESSAGE = "Job photos are included with the Team and Business plans. Upgrade under Subscription to add photos.";

export type PhotoView = Pick<JobPhoto, "id" | "kind" | "expires_at" | "preserved" | "created_at" | "size_bytes"> & { url: string | null; mine: boolean };

/** Photos for a job with short-lived signed links. Expired-but-not-yet-cleaned photos are hidden. */
export async function photosWithUrls(orgId: string, jobId: string, viewerId: string | null, seconds = SIGNED_URL_SECONDS): Promise<PhotoView[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("job_photos").select("*").eq("org_id", orgId).eq("job_id", jobId).order("created_at", { ascending: true });
  const now = Date.now();
  const rows = (data ?? []).filter((p) => p.preserved || new Date(p.expires_at).getTime() > now);
  if (!rows.length) return [];
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), seconds);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    expires_at: r.expires_at,
    preserved: r.preserved,
    created_at: r.created_at,
    size_bytes: r.size_bytes,
    url: byPath.get(r.storage_path) ?? null,
    mine: viewerId != null && r.uploaded_by === viewerId,
  }));
}

/** A new random gallery token and the hash that is stored. Only the hash is kept, so a leaked database can't open galleries. */
export function newGalleryToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Removes storage files; returns the paths that were handled without error. */
export async function removeFiles(paths: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!paths.length) return { ok: true };
  const { error } = await createAdminClient().storage.from(BUCKET).remove(paths);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Deletes every stored file for a job (used before a job is deleted, since the rows cascade but files wouldn't). */
export async function deleteJobPhotoFiles(orgId: string, jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("job_photos").select("storage_path").eq("org_id", orgId).eq("job_id", jobId);
  const paths = (data ?? []).map((p) => p.storage_path);
  for (let i = 0; i < paths.length; i += 100) await removeFiles(paths.slice(i, i + 100));
}
