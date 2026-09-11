import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { addDays, buildStaffMap, enrichJob, fmtDateLabel, fmtISO, startOfWeek, todayISO } from "@/lib/design";
import { JobRow } from "@/components/JobRow";

export default async function DashboardPage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*"),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  const enriched = (jobs ?? []).map((j) => enrichJob(j, staffById));

  const today = todayISO();
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = fmtISO(weekStart);
  const weekEndISO = fmtISO(weekEnd);

  const jobsToday = enriched.filter((j) => j.job_date === today);
  const jobsThisWeek = enriched.filter((j) => j.job_date >= weekStartISO && j.job_date <= weekEndISO);
  const unassignedActive = enriched.filter((j) => !j.assigned_staff_id && j.status !== "cancelled" && j.status !== "completed");
  const activeStaffCount = (staffList ?? []).filter((s) => s.active).length;

  const needsAttentionUnassigned = unassignedActive
    .filter((j) => j.job_date >= today)
    .sort((a, b) => (a.job_date === b.job_date ? a.start_time.localeCompare(b.start_time) : a.job_date.localeCompare(b.job_date)))
    .slice(0, 6);
  const needsAttentionOverdue = enriched
    .filter((j) => j.job_date < today && j.status === "scheduled")
    .sort((a, b) => a.job_date.localeCompare(b.job_date));
  const todaySchedule = jobsToday.slice().sort((a, b) => a.start_time.localeCompare(b.start_time));

  const isAdmin = viewer.profile.role === "admin";
  const hasNeedsAttention = needsAttentionOverdue.length > 0 || needsAttentionUnassigned.length > 0;

  const kpiCards = isAdmin
    ? [
        { label: "Jobs Today", value: jobsToday.length, alert: false },
        { label: "Jobs This Week", value: jobsThisWeek.length, alert: false },
        { label: "Unassigned Jobs", value: unassignedActive.length, alert: unassignedActive.length > 0 },
        { label: "Active Staff", value: activeStaffCount, alert: false },
      ]
    : [
        { label: "My Jobs Today", value: jobsToday.length, alert: false },
        { label: "My Jobs This Week", value: jobsThisWeek.length, alert: false },
      ];

  return (
    <div>
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white border border-border rounded-2xl px-5 py-4.5">
            <div className="text-[13px] font-medium text-ink-faint mb-1.5">{card.label}</div>
            <div
              className="text-[32px] font-bold font-serif"
              style={card.alert ? { color: "var(--color-danger)" } : undefined}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        {hasNeedsAttention ? (
          <div className="rounded-2xl px-5 py-4.5" style={{ background: "var(--color-danger-tint)", border: "1px solid var(--color-danger-border)" }}>
            <div className="font-serif font-semibold text-[17px] mb-3" style={{ color: "var(--color-danger-strong)" }}>
              Needs Attention
            </div>
            {needsAttentionOverdue.length > 0 && (
              <>
                <div className="text-xs font-bold tracking-wide uppercase mb-2" style={{ color: "var(--color-danger)" }}>
                  Overdue &middot; still marked scheduled
                </div>
                {needsAttentionOverdue.map((job) => (
                  <JobRow key={job.id} job={job} showTime={false} />
                ))}
              </>
            )}
            {needsAttentionUnassigned.length > 0 && (
              <>
                <div className="text-xs font-bold tracking-wide uppercase mt-3.5 mb-2" style={{ color: "var(--color-danger)" }}>
                  Unassigned &middot; upcoming
                </div>
                {needsAttentionUnassigned.map((job) => (
                  <JobRow key={job.id} job={job} showTime={false} unassignedNotice />
                ))}
              </>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl px-5 py-4 text-sm font-medium"
            style={{ background: "var(--color-success-tint)", border: "1px solid var(--color-success-border)", color: "var(--color-success-strong)" }}
          >
            All caught up — no unassigned or overdue jobs.
          </div>
        )}
      </div>

      <div>
        <div className="font-serif font-semibold text-[17px] mb-3">Today&rsquo;s Schedule &middot; {fmtDateLabel(today)}</div>
        {todaySchedule.length > 0 ? (
          todaySchedule.map((job) => <JobRow key={job.id} job={job} showTime />)
        ) : (
          <div className="text-sm text-ink-faint py-3.5">No jobs scheduled today.</div>
        )}
      </div>
    </div>
  );
}
