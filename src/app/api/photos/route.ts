import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, photoContext, removeFiles } from "@/lib/photos";
import { PHOTO_DEFAULT_DAYS, PHOTO_MAX_BYTES, PHOTO_MAX_PER_JOB, PHOTO_UPLOADS_PER_HOUR, jpegSize, stripJpegMetadata } from "@/lib/photoFiles";

// Upload one job photo (already compressed to JPEG in the browser). Everything is checked again here: who is asking,
// whether the job is theirs, the file really is a JPEG under the size limit, and that location data is removed.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That upload couldn't be read." }, { status: 400 });
  }
  const jobId = String(form.get("jobId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (kind !== "before" && kind !== "after" && kind !== "general") return NextResponse.json({ error: "Choose before, after or general." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) return NextResponse.json({ error: "That photo is still over 2 MB after compressing. Try a smaller one." }, { status: 413 });

  const ctx = await photoContext(jobId);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.error === "Job not found." ? 404 : 403 });
  const { viewer } = ctx;

  const clean = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!clean) return NextResponse.json({ error: "Only JPEG photos are accepted." }, { status: 415 });
  if (clean.length > PHOTO_MAX_BYTES) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  const size = jpegSize(clean);

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { count: onJob } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("org_id", viewer.orgId).eq("job_id", jobId).or(`preserved.eq.true,expires_at.gt.${nowIso}`);
  if ((onJob ?? 0) >= PHOTO_MAX_PER_JOB) return NextResponse.json({ error: `A job can hold ${PHOTO_MAX_PER_JOB} photos. Delete some first.` }, { status: 409 });
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("uploaded_by", viewer.userId).gte("created_at", hourAgo);
  if ((recent ?? 0) >= PHOTO_UPLOADS_PER_HOUR) return NextResponse.json({ error: "That's a lot of photos in an hour. Please wait a little and try again." }, { status: 429 });

  const path = `${viewer.orgId}/${jobId}/${randomUUID()}.jpg`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, clean, { contentType: "image/jpeg", upsert: false });
  if (upErr) {
    console.error("[photos] upload failed", upErr.message);
    return NextResponse.json({ error: "Couldn't save the photo. Please try again." }, { status: 500 });
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
    return NextResponse.json({ error: "Couldn't save the photo. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: row.id });
}
