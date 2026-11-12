import { jobsOnDate } from "@/lib/appJobs";
import { appError, appJson, isIsoDate, withAppViewer } from "@/lib/appApi";

export const dynamic = "force-dynamic";

/** GET ?date=YYYY-MM-DD: the jobs on that day the person may see. */
export async function GET(req: Request) {
  return withAppViewer(req, async ({ db, viewer }) => {
    const date = new URL(req.url).searchParams.get("date");
    if (!isIsoDate(date)) return appError("Pick a valid date.", 400);
    const jobs = await jobsOnDate(db, date);
    if (!jobs) return appError("Couldn't load the jobs. Please try again.", 500);
    return appJson({ date, role: viewer.isAdmin ? "admin" : "staff", jobs });
  });
}
