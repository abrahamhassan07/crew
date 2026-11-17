import { createAdminClient } from "@/lib/supabase/admin";
import { photoContextFor, removeFiles } from "@/lib/photos";
import { appError, appJson, isUuid, withAppViewer } from "@/lib/appApi";

export const dynamic = "force-dynamic";

/** DELETE: owners and admins delete any photo on their jobs; staff only the ones they took themselves (same as the site). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return appError("Photo not found.", 404);
  return withAppViewer(req, async ({ viewer }) => {
    const admin = createAdminClient();
    const { data: photo } = await admin.from("job_photos").select("*").eq("id", id).eq("org_id", viewer.orgId).maybeSingle();
    if (!photo) return appError("Photo not found.", 404);
    const ctx = await photoContextFor(viewer, photo.job_id);
    if (!ctx.ok) return appError("Photo not found.", 404);
    if (!ctx.isAdmin && photo.uploaded_by !== viewer.userId) return appError("You can only delete photos you took.", 403);
    const removed = await removeFiles([photo.storage_path]);
    if (!removed.ok) return appError("Couldn't delete the file. Please try again.", 500);
    const { error } = await admin.from("job_photos").delete().eq("id", id).eq("org_id", viewer.orgId);
    if (error) return appError("Couldn't delete the photo. Please try again.", 500);
    return appJson({ ok: true });
  });
}
