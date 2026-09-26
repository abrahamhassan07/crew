import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { addDays, buildStaffMap, DAYS, enrichJob, fmtISO, fmtMonthDay, startOfWeek, todayISO } from "@/lib/design";
import { NewJobButton } from "@/components/NewJobButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

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
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${fmtMonthDay(weekStart)} – ${fmtMonthDay(weekEnd)}`;

  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(weekStart, i);
    const iso = fmtISO(d);
    const isToday = iso === today;
    const dayJobs = enriched
      .filter((j) => j.job_date === iso)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { iso, dayName: DAYS[d.getDay()], dateLabel: d.getDate(), isToday, jobs: dayJobs };
  });

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Page header */}
      <div className="px-6 py-8 border-b border-line bg-card-bg sticky top-16 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-ink-primary">Schedule</h1>
              <p className="text-sm text-ink-secondary mt-1">
                Week of {weekLabel}
              </p>
            </div>
            <NewJobButton />
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-3">
            <Link href={`/schedule?week=${weekOffset - 1}`}>
              <button className="p-2 hover:bg-page-bg rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-ink-primary" />
              </button>
            </Link>
            <span className="text-sm font-semibold text-ink-secondary min-w-48 text-center">
              {weekLabel}
            </span>
            <Link href={`/schedule?week=${weekOffset + 1}`}>
              <button className="p-2 hover:bg-page-bg rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-ink-primary" />
              </button>
            </Link>
            <div className="flex-1" />
            {weekOffset !== 0 && (
              <Link href="/schedule">
                <button className="text-xs font-semibold text-brand hover:text-brand-hover">
                  Today
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Week grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {weekDays.map((day) => (
              <Card key={day.iso} className={day.isToday ? "border-2 border-brand bg-ok-bg/5" : ""}>
                <div className="p-4">
                  {/* Day header */}
                  <div className="mb-4">
                    <div className={`text-xs font-bold tracking-wide uppercase mb-1 ${day.isToday ? "text-brand" : "text-ink-muted"}`}>
                      {day.dayName}
                    </div>
                    <div className="text-xl font-bold text-ink-primary">{day.dateLabel}</div>
                  </div>

                  {/* Jobs */}
                  <div className="space-y-2">
                    {day.jobs.length === 0 ? (
                      <div className="text-xs text-ink-muted py-4 text-center">
                        No jobs scheduled
                      </div>
                    ) : (
                      day.jobs.map((job) => (
                        <Link key={job.id} href={`/jobs/${job.id}`}>
                          <div className="p-3 rounded-lg bg-page-bg hover:bg-line-soft transition-colors cursor-pointer">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Clock className="w-3 h-3 text-ink-muted flex-shrink-0" />
                                <span className="text-xs font-semibold text-ink-primary">
                                  {job.start_time}
                                </span>
                              </div>
                              <StatusBadge
                                status={
                                  job.status === "in_progress"
                                    ? "in-progress"
                                    : job.status === "completed"
                                      ? "completed"
                                      : "scheduled"
                                }
                                label={
                                  job.status === "in_progress"
                                    ? "In"
                                    : job.status === "completed"
                                      ? "Done"
                                      : "Sch"
                                }
                                showDot
                              />
                            </div>
                            <div className="text-xs font-semibold text-ink-primary truncate mb-1">
                              {job.client_name}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-ink-muted mb-2">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{job.address}</span>
                            </div>
                            {job.assigned_staff_id && job.staffName && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: job.staffColorHex }}
                                />
                                <span className="text-ink-secondary">{job.staffName}</span>
                              </div>
                            )}
                            {!job.assigned_staff_id && (
                              <div className="text-xs text-warn-fg bg-warn-bg px-2 py-1 rounded inline-block">
                                Unassigned
                              </div>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
