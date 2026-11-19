import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, PHOTOS_PLAN_MESSAGE, photoContextFor, removeFiles, type PhotoViewer } from "@/lib/photos";
import { PHOTO_DEFAULT_DAYS, PHOTO_MAX_BYTES, PHOTO_MAX_PER_JOB, PHOTO_UPLOADS_PER_HOUR, jpegSize, stripJpegMetadata } from "@/lib/photoFiles";
import { appSafe } from "@/lib/inApp";

export type PhotoKind = "before" | "after" | "general";
export type UploadResult = { ok: true; id: string } | { ok: false; error: string; status: number };

/** Reads the shared upload form (jobId, kind, file) used by the site and the app. */
export function readPhotoForm(form: FormData): { jobId: string; kind: PhotoKind; file: File } | { error: string; status: number } {
  const jobId = String(form.get("jobId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { error: "Job not found.", status: 404 };
  if (kind !== "before" && kind !== "after" && kind !== "general") return { error: "Choose before, after or general.", status: 400 };
  if (!(file instanceof File)) return { error: "Choose a photo.", status: 400 };
  return { jobId, kind, file };
}

/**
 * Saves one job photo (already compressed to JPEG on the device). Everything is checked here: whether the job is
 * theirs, the plan, that the file really is a JPEG under the size limit, the per-job and hourly limits, and that
 * location data is removed.
 */
export async function savePhoto(who: PhotoViewer, jobId: string, kind: PhotoKind, file: File): Promise<UploadResult> {
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "That photo is still over 2 MB after compressing. Try a smaller one.", status: 413 };
  const ctx = await photoContextFor(who, jobId);
  if (!ctx.ok) return { ok: false, error: ctx.error, status: ctx.error === "Job not found." ? 404 : 403 };
  const { viewer } = ctx;
  if (!ctx.planAllowed) return { ok: false, error: await appSafe(PHOTOS_PLAN_MESSAGE), status: 402 };

  const clean = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!clean) return { ok: false, error: "Only JPEG photos are accepted.", status: 415 };
  if (clean.length > PHOTO_MAX_BYTES) return { ok: false, error: "That photo is too large.", status: 413 };
  const size = jpegSize(clean);

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { count: onJob } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("org_id", viewer.orgId).eq("job_id", jobId).or(`preserved.eq.true,expires_at.gt.${nowIso}`);
  if ((onJob ?? 0) >= PHOTO_MAX_PER_JOB) return { ok: false, error: `A job can hold ${PHOTO_MAX_PER_JOB} photos. Delete some first.`, status: 409 };
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("uploaded_by", viewer.userId).gte("created_at", hourAgo);
  if ((recent ?? 0) >= PHOTO_UPLOADS_PER_HOUR) return { ok: false, error: "That's a lot of photos in an hour. Please wait a little and try again.", status: 429 };

  const path = `${viewer.orgId}/${jobId}/${randomUUID()}.jpg`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, clean, { contentType: "image/jpeg", upsert: false });
  if (upErr) {
    console.error("[photos] upload failed", upErr.message);
    return { ok: false, error: "Couldn't save the photo. Please try again.", status: 500 };
  }
  const { data: row, error } = await admin
    .from("job_photos")
    .insert({
      job_id: jobId,
      org_id: viewer.orgId,
      kind,
      storage_path: path,
      expires_at: new Date(Date.now() + PHOTO_DEFAULT_DAYS * 86_400_000).toISOString(),
      uploaded_by: viewer.userId,
      size_bytes: clean.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    await removeFiles([path]); // don't leave an orphan file behind
    console.error("[photos] insert failed", error?.message);
    return { ok: false, error: "Couldn't save the photo. Please try again.", status: 500 };
  }
  return { ok: true, id: row.id };
}
