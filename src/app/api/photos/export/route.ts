import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, photoContext } from "@/lib/photos";
import { zipStore } from "@/lib/photoFiles";

// Owners and admins download every photo on a job as one ZIP, before the cleanup removes them.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const jobId = request.nextUrl.searchParams.get("job") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const ctx = await photoContext(jobId);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: 403 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only owners and admins can export photos." }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from("job_photos").select("*").eq("org_id", ctx.viewer.orgId).eq("job_id", jobId).order("created_at", { ascending: true });
  const now = Date.now();
  const rows = (data ?? []).filter((p) => p.preserved || new Date(p.expires_at).getTime() > now);
  if (!rows.length) return NextResponse.json({ error: "No photos to export." }, { status: 404 });

  const files: { name: string; data: Uint8Array }[] = [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const { data: blob } = await admin.storage.from(BUCKET).download(r.storage_path);
    if (!blob) continue;
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    files.push({ name: `${r.kind}-${counts[r.kind]}-${r.created_at.slice(0, 10)}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  if (!files.length) return NextResponse.json({ error: "The photo files couldn't be read." }, { status: 500 });
  const zip = zipStore(files);
  const label = (ctx.job.title || ctx.job.job_type || "job").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "job";
  return new NextResponse(zip as unknown as BodyInit, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="photos-${label}-${ctx.job.job_date}.zip"`, "Cache-Control": "private, no-store" },
  });
}
