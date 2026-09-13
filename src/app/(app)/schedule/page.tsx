import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { addDays, buildStaffMap, DAYS, enrichJob, fmtISO, fmtMonthDay, startOfWeek, todayISO } from "@/lib/design";
import { JobBlock } from "@/components/JobBlock";
import { JobRow } from "@/components/JobRow";
import { AddJobButton } from "@/components/AddJobButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { WeekNav } from "@/components/WeekNav";

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const params = await searchParams;
  const weekOffset = Number(params.week ?? 0) || 0;
  const viewer = await getViewer();
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*"),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  const enriched = (jobs ?? []).map((j) => enrichJob(j, staffById));

  const today = todayISO();
  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const weekLabel = `${fmtMonthDay(weekStart)} – ${fmtMonthDay(addDays(weekStart, 6))}`;
  const isAdmin = viewer.profile.role === "admin";

  const fromParam = typeof params.from === "string" && params.from ? params.from : null;
  const toParam = typeof params.to === "string" && params.to ? params.to : null;
  const hasCustomRange = Boolean(fromParam || toParam);

  const headerNav = (
    <div>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <WeekNav weekOffset={weekOffset} basePath="/schedule" />
        {!hasCustomRange && <div className="font-serif text-[17px] font-semibold ml-1">{weekLabel}</div>}
      </div>
      <div className="mb-1">
        <DateRangeFilter basePath="/schedule" />
      </div>
    </div>
  );

  if (hasCustomRange) {
    const rangeStartISO = fromParam ?? "0001-01-01";
    const rangeEndISO = toParam ?? "9999-12-31";
    const rangeJobs = enriched
      .filter((j) => j.job_date >= rangeStartISO && j.job_date <= rangeEndISO)
      .sort((a, b) => (a.job_date === b.job_date ? a.start_time.localeCompare(b.start_time) : a.job_date.localeCompare(b.job_date)));

    return (
      <div>
        {headerNav}
        <div className="text-[13px] text-ink-faint mb-3 mt-3">{rangeJobs.length} jobs</div>
        {rangeJobs.length > 0 ? (
          rangeJobs.map((job) => <JobRow key={job.id} job={job} showPrice />)
        ) : (
          <div className="text-sm text-ink-faint py-5">No jobs in this range.</div>
        )}
      </div>
    );
  }

  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(weekStart, i);
    const iso = fmtISO(d);
    const isToday = iso === today;
    const dayJobs = enriched
      .filter((j) => j.job_date === iso)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { iso, dayName: DAYS[d.getDay()], dateLabel: `${d.getMonth() + 1}/${d.getDate()}`, isToday, jobs: dayJobs };
  });

  return (
    <div>
      {headerNav}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {weekDays.map((day) => (
          <div
            key={day.iso}
            className="rounded-xl p-2.5 flex flex-col gap-1.5 min-h-[120px]"
            style={{
              background: day.isToday ? "var(--color-today-tint)" : "white",
              border: `1px solid ${day.isToday ? "var(--color-today-border)" : "var(--color-border)"}`,
            }}
          >
            <div className="mb-1" style={day.isToday ? { color: "var(--color-accent-strong)" } : undefined}>
              <div className="text-xs font-bold tracking-wide uppercase">{day.dayName}</div>
              <div className="text-sm font-semibold">{day.dateLabel}</div>
            </div>
            {day.jobs.map((job) => (
              <JobBlock key={job.id} job={job} />
            ))}
            {isAdmin && <AddJobButton date={day.iso} />}
          </div>
        ))}
      </div>
    </div>
  );
}
