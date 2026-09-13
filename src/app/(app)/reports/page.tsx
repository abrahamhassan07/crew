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
    <div>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <WeekNav weekOffset={weekOffset} basePath="/reports" />
        <div className="font-serif text-[17px] font-semibold ml-1">{rangeLabel}</div>
      </div>
      <div className="mb-1">
        <DateRangeFilter basePath="/reports" />
      </div>

      <div className="font-serif text-lg font-semibold mt-6 mb-3">Client Hours</div>
      <div className="flex flex-col gap-2">
        {clientRows.length === 0 && <div className="text-sm text-ink-faint py-3">No clients yet.</div>}
        {clientRows.map(({ client, totalMinutes, minutesByType, jobCount }) => (
          <div key={client.id} className="bg-white border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] flex-[2]">
              <div className="font-semibold text-sm">{client.name}</div>
              <div className="text-xs text-ink-faint">
                {jobCount} job{jobCount === 1 ? "" : "s"} {periodPhrase}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {JOB_TYPES.filter((t) => minutesByType[t] > 0).map((t) => (
                <Badge key={t} label={`${TYPE_META[t].label}: ${durationLabel(minutesByType[t])}`} color={TYPE_META[t].hex} tint={TYPE_META[t].tint} />
              ))}
            </div>
            <div className="font-semibold text-sm ml-auto">{durationLabel(totalMinutes)}</div>
          </div>
        ))}
      </div>

      <div className="font-serif text-lg font-semibold mt-8 mb-3">Staff Hours</div>
      <div className="flex flex-col gap-2">
        {staffRows.length === 0 && <div className="text-sm text-ink-faint py-3">No staff yet.</div>}
        {staffRows.map(({ staff, totalMinutes, jobCount }) => (
          <div key={staff.id} className="bg-white border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 min-w-[160px] flex-[2]">
              <div
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                style={{ background: staffColorHex(staff.color_hue) }}
              >
                {initialsOf(staff.name)}
              </div>
              <div>
                <div className="font-semibold text-sm">{staff.name}</div>
                <div className="text-xs text-ink-faint">
                  {jobCount} job{jobCount === 1 ? "" : "s"} {periodPhrase}
                </div>
              </div>
            </div>
            <div className="font-semibold text-sm ml-auto">{durationLabel(totalMinutes)}</div>
          </div>
        ))}
      </div>

      {unmatchedJobs.length > 0 && (
        <>
          <div className="font-serif text-lg font-semibold mt-8 mb-1">Unmatched Jobs</div>
          <div className="text-xs text-ink-faint mb-3">
            {unmatchedJobs.length} job{unmatchedJobs.length === 1 ? "" : "s"} ({durationLabel(unmatchedMinutes)}) {periodPhrase} whose client name
            doesn&rsquo;t match anyone in your Clients directory — not counted in Client Hours above. Click one to fix the client name or add them as a
            client.
          </div>
          <div>
            {unmatchedJobs.map((job) => (
              <JobRow key={job.id} job={job} showPrice showTime={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
