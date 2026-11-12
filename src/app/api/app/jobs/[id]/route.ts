import { jobDetail } from "@/lib/appJobs";
import { cleanChecklist, JOB_STATUSES, setJobChecklist, setJobStatus } from "@/lib/jobOps";
import { appError, appJson, isUuid, withAppViewer } from "@/lib/appApi";
import type { JobStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET: one job with what's needed on site. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return appError("That job wasn't found.", 404);
  return withAppViewer(req, async ({ db, viewer }) => {
    const job = await jobDetail(db, id, viewer.isAdmin);
    if (!job) return appError("That job wasn't found.", 404);
    return appJson({ job });
  });
}

/** PATCH { status } or { checklist }: what staff can change on their own jobs (owners on any job in the business). */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return appError("That job wasn't found.", 404);
  return withAppViewer(req, async ({ db, viewer }) => {
    const body = (await req.json().catch(() => null)) as { status?: unknown; checklist?: unknown } | null;
    if (!body) return appError("Nothing to change.", 400);
    if (body.status !== undefined) {
      if (!JOB_STATUSES.includes(body.status as JobStatus)) return appError("Unknown status.", 400);
      // Cancelling stays an office decision: owners only.
      if (body.status === "cancelled" && !viewer.isAdmin) return appError("Only the owner can cancel a job.", 403);
      const r = await setJobStatus(db, { orgId: viewer.orgId, staffId: viewer.staff?.id ?? null }, id, body.status as JobStatus);
      if (!r.ok) return appError(r.error, 400);
    }
    if (body.checklist !== undefined) {
      const clean = cleanChecklist(body.checklist);
      if (!clean) return appError("That checklist couldn't be saved.", 400);
      const r = await setJobChecklist(db, id, clean);
      if (!r.ok) return appError(r.error, 400);
    }
    const job = await jobDetail(db, id, viewer.isAdmin);
    return job ? appJson({ job }) : appError("That job wasn't found.", 404);
  });
}
