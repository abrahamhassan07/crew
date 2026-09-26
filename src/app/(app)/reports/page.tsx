import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  addDays,
  buildStaffMap,
  durationLabel,
  enrichJob,
  fmtISO,
  fmtMonthDay,
  initialsOf,
  parseISO,
  staffColorHex,
  startOfWeek,
  TYPE_META,
} from "@/lib/design";
import { Badge } from "@/components/Badge";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { JobRow } from "@/components/JobRow";
import { WeekNav } from "@/components/WeekNav";

const JOB_TYPES = ["cleaning", "gardening", "both"] as const;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireAdmin();
  const params = await searchParams;
  const weekOffset = Number(params.week ?? 0) || 0;
  const supabase = await createClient();

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${fmtMonthDay(weekStart)} – ${fmtMonthDay(weekEnd)}`;

  const fromParam = typeof params.from === "string" && params.from ? params.from : null;
  const toParam = typeof params.to === "string" && params.to ? params.to : null;
  const hasCustomRange = Boolean(fromParam || toParam);

  const rangeStartISO = hasCustomRange ? fromParam ?? "0001-01-01" : fmtISO(weekStart);
  const rangeEndISO = hasCustomRange ? toParam ?? "9999-12-31" : fmtISO(weekEnd);
  const rangeLabel = hasCustomRange
    ? fromParam && toParam
      ? `${fmtMonthDay(parseISO(fromParam))} – ${fmtMonthDay(parseISO(toParam))}`
      : fromParam
        ? `From ${fmtMonthDay(parseISO(fromParam))}`
        : `Through ${fmtMonthDay(parseISO(toParam!))}`
    : weekLabel;
  const periodPhrase = hasCustomRange ? "in this range" : "this week";

  const [{ data: clients }, { data: staffList }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("staff").select("*").order("name"),
    supabase.from("jobs").select("*").gte("job_date", rangeStartISO).lte("job_date", rangeEndISO).neq("status", "cancelled"),
  ]);

  const rangeJobs = jobs ?? [];
  const clientNames = new Set((clients ?? []).map((c) => c.name.trim().toLowerCase()));

  const clientRows = (clients ?? []).map((c) => {
    const matched = rangeJobs.filter((j) => j.client_name.trim().toLowerCase() === c.name.trim().toLowerCase());
    const minutesByType: Record<string, number> = { cleaning: 0, gardening: 0, both: 0 };
    for (const j of matched) minutesByType[j.job_type] += j.duration_minutes;
    const totalMinutes = matched.reduce((sum, j) => sum + j.duration_minutes, 0);
    return { client: c, totalMinutes, minutesByType, jobCount: matched.length };
  });

  const staffRows = (staffList ?? []).map((s) => {
    const matched = rangeJobs.filter((j) => j.assigned_staff_id === s.id);
    const totalMinutes = matched.reduce((sum, j) => sum + j.duration_minutes, 0);
    return { staff: s, totalMinutes, jobCount: matched.length };
  });

  const staffById = buildStaffMap(staffList ?? []);
  const unmatchedJobs = rangeJobs
    .filter((j) => !clientNames.has(j.client_name.trim().toLowerCase()))
    .map((j) => enrichJob(j, staffById));
  const unmatchedMinutes = unmatchedJobs.reduce((sum, j) => sum + j.duration_minutes, 0);

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-ink-primary mb-4">Reports</h1>
          <p className="text-sm text-ink-secondary">
            View hours worked by clients and staff for {rangeLabel}.
          </p>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Client Hours Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-primary mb-4">Client Hours</h2>
            {clientRows.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted">
                No clients yet.
              </div>
            ) : (
              <div className="space-y-2">
                {clientRows.map(({ client, totalMinutes, minutesByType, jobCount }) => (
                  <div key={client.id} className="bg-card-bg border border-line rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-ink-primary">{client.name}</div>
                      <div className="text-xs text-ink-muted mt-1">
                        {jobCount} job{jobCount === 1 ? "" : "s"} {periodPhrase}
                      </div>
                    </div>
                    <div className="font-bold text-lg text-brand">{durationLabel(totalMinutes)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staff Hours Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-primary mb-4">Staff Hours</h2>
            {staffRows.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted">
                No staff yet.
              </div>
            ) : (
              <div className="space-y-2">
                {staffRows.map(({ staff, totalMinutes, jobCount }) => (
                  <div key={staff.id} className="bg-card-bg border border-line rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ background: staffColorHex(staff.color_hue) }}
                      >
                        {initialsOf(staff.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-ink-primary">{staff.name}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {jobCount} job{jobCount === 1 ? "" : "s"} {periodPhrase}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-lg text-brand">{durationLabel(totalMinutes)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unmatched Jobs Section */}
          {unmatchedJobs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Unmatched Jobs</h2>
              <p className="text-sm text-ink-muted mb-4">
                {unmatchedJobs.length} job{unmatchedJobs.length === 1 ? "" : "s"} ({durationLabel(unmatchedMinutes)}) {periodPhrase} whose client name doesn&rsquo;t match your Clients directory.
              </p>
              <div className="space-y-2">
                {unmatchedJobs.map((job) => (
                  <div key={job.id} className="bg-card-bg border border-line rounded-lg p-4">
                    <div className="font-semibold text-ink-primary">{job.client_name}</div>
                    <div className="text-sm text-ink-secondary mt-1">{job.address}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
