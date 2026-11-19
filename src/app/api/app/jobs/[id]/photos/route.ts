import { photoContextFor, photosWithUrls } from "@/lib/photos";
import { readPhotoForm, savePhoto } from "@/lib/photoUpload";
import { stripUpsell } from "@/lib/upsell";
import { appError, appJson, isUuid, withAppViewer } from "@/lib/appApi";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET: a job's photos with short-lived links, and whether this plan includes photos. Same rules as the site. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return appError("That job wasn't found.", 404);
  return withAppViewer(req, async ({ viewer }) => {
    const ctx = await photoContextFor(viewer, id);
    if (!ctx.ok) return appError(ctx.error, ctx.error === "Job not found." ? 404 : 403);
    const photos = ctx.planAllowed ? await photosWithUrls(viewer.orgId, id, viewer.userId) : [];
    return appJson({ photos, planAllowed: ctx.planAllowed, isAdmin: ctx.isAdmin });
  });
}

/** POST multipart { kind, file }: add a photo taken on the phone (JPEG, compressed on the phone, checked here). */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return appError("That job wasn't found.", 404);
  return withAppViewer(req, async ({ viewer }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return appError("That upload couldn't be read.", 400);
    }
    form.set("jobId", id);
    const input = readPhotoForm(form);
    if ("error" in input) return appError(input.error, input.status);
    const result = await savePhoto(viewer, id, input.kind, input.file);
    // The app's own requests don't carry the site's in-app marker, so plan prompts are dropped here.
    if (!result.ok) return appError(stripUpsell(result.error), result.status);
    return appJson({ ok: true, id: result.id });
  });
}
