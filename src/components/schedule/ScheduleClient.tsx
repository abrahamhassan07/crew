"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewJobButton } from "@/components/NewJobButton";
import { useJobModal } from "@/components/JobModalContext";
import { rescheduleJob, convertRequestToJob } from "@/app/(app)/actions";
import { addDays, DAYS, fmtDateLabel, fmtISO, fmtMonthDay, MONTHS, startOfWeek, todayISO } from "@/lib/design";
import type { EnrichedJob } from "@/lib/design";
import type { Crew, Service, ServiceRequest } from "@/lib/supabase/types";
import { TimeGrid, type GridDay } from "./TimeGrid";
import { MonthGrid } from "./MonthGrid";
import { CrewView } from "./CrewView";
import { UnscheduledPanel } from "./UnscheduledPanel";

type View = "day" | "week" | "month" | "crew";

export function ScheduleClient({
  jobs,
  crews,
  requests,
  services,
  isAdmin,
}: {
  jobs: EnrichedJob[];
  crews: Crew[];
  requests: ServiceRequest[];
  services: Service[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { openJob, openNewJob } = useJobModal();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [activeCrewIds, setActiveCrewIds] = useState(() => new Set(crews.map((c) => c.id)));

  const today = todayISO();
  const crewById = useMemo(() => new Map(crews.map((c) => [c.id, c])), [crews]);

  const filteredJobs = useMemo(
    () => jobs.filter((j) => !j.crew_id || activeCrewIds.has(j.crew_id)),
    [jobs, activeCrewIds]
  );

  const toggleCrew = (id: string) => {
    setActiveCrewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToday = () => setAnchor(new Date());
  const goPrev = () => {
    if (view === "day") setAnchor((d) => addDays(d, -1));
    else if (view === "month") setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else setAnchor((d) => addDays(d, -7));
  };
  const goNext = () => {
    if (view === "day") setAnchor((d) => addDays(d, 1));
    else if (view === "month") setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else setAnchor((d) => addDays(d, 7));
  };

  const weekStart = startOfWeek(anchor);
  const weekEnd = addDays(weekStart, 6);

  const rangeLabel =
    view === "day"
      ? fmtDateLabel(fmtISO(anchor))
      : view === "month"
        ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
        : `${fmtMonthDay(weekStart)} – ${fmtMonthDay(weekEnd)}`;

  const buildGridDays = (start: Date, count: number): GridDay[] =>
    Array.from({ length: count }, (_, i) => {
      const d = addDays(start, i);
      const iso = fmtISO(d);
      return {
        iso,
        dayName: DAYS[d.getDay()],
        dateNum: d.getDate(),
        isToday: iso === today,
        jobs: filteredJobs.filter((j) => j.job_date === iso).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
      };
    });

  const gridDays = view === "day" ? buildGridDays(anchor, 1) : buildGridDays(weekStart, 7);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, EnrichedJob[]>();
    for (const j of filteredJobs) {
      if (!j.job_date) continue;
      const arr = map.get(j.job_date) ?? [];
      arr.push(j);
      map.set(j.job_date, arr);
    }
    return map;
  }, [filteredJobs]);

  const weekJobs = filteredJobs.filter((j) => j.job_date && j.job_date >= fmtISO(weekStart) && j.job_date <= fmtISO(weekEnd));
  const jobsByCrew = useMemo(() => {
    const map = new Map<string, EnrichedJob[]>();
    for (const j of weekJobs) {
      if (!j.crew_id) continue;
      const arr = map.get(j.crew_id) ?? [];
      arr.push(j);
      map.set(j.crew_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.job_date ?? "").localeCompare(b.job_date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    return map;
  }, [weekJobs]);
  const unassignedCrewJobs = weekJobs.filter((j) => !j.crew_id).sort((a, b) => (a.job_date ?? "").localeCompare(b.job_date ?? ""));

  const handleDropOnDay = async (iso: string, e: React.DragEvent) => {
    const jobId = e.dataTransfer.getData("application/x-job-id");
    const requestId = e.dataTransfer.getData("application/x-request-id");
    if (jobId) {
      await rescheduleJob(jobId, iso);
      router.refresh();
    } else if (requestId) {
      await convertRequestToJob(requestId, iso, "09:00");
      router.refresh();
    }
  };

  const handleQuickSchedule = async (requestId: string) => {
    await convertRequestToJob(requestId, today, "09:00");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Schedule"
        actions={
          <>
            <div className="flex items-center gap-1 bg-page-bg rounded-lg p-1">
              {(["day", "week", "month", "crew"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors ${
                    view === v ? "bg-card-bg text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <NewJobButton prefillDate={fmtISO(anchor)} />
          </>
        }
        sticky
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={goToday} className="px-3.5 py-2 rounded-md border border-field-border bg-card-bg text-sm font-semibold hover:bg-page-bg transition-colors">
            Today
          </button>
          <button onClick={goPrev} className="p-2 hover:bg-page-bg rounded-lg transition-colors" aria-label="Previous">
            <ChevronLeft className="w-4 h-4 text-ink-primary" />
          </button>
          <button onClick={goNext} className="p-2 hover:bg-page-bg rounded-lg transition-colors" aria-label="Next">
            <ChevronRight className="w-4 h-4 text-ink-primary" />
          </button>
          <span className="text-sm font-semibold text-ink-primary">{rangeLabel}</span>
          <div className="flex-1" />
          {crews.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-ink-muted">Crews</span>
              {crews.map((c) => {
                const active = activeCrewIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCrew(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-line transition-opacity ${active ? "" : "opacity-40"}`}
                    style={{ background: active ? c.tint_hex : "transparent" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color_hex }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 w-full">
            {(view === "day" || view === "week") && (
              <TimeGrid
                days={gridDays}
                crewById={crewById}
                canEdit={isAdmin}
                onSlotClick={(iso) => openNewJob(iso)}
                onJobClick={openJob}
                onDropOnDay={handleDropOnDay}
              />
            )}
            {view === "month" && (
              <MonthGrid
                monthAnchor={anchor}
                jobsByDate={jobsByDate}
                crewById={crewById}
                todayIso={today}
                onDayClick={(iso) => openNewJob(iso)}
                onJobClick={openJob}
              />
            )}
            {view === "crew" && (
              <CrewView crews={crews} jobsByCrew={jobsByCrew} unassignedJobs={unassignedCrewJobs} onJobClick={openJob} />
            )}
          </div>

          {isAdmin && (
            <UnscheduledPanel requests={requests} services={services} crewById={crewById} canEdit={isAdmin} onQuickSchedule={handleQuickSchedule} />
          )}
        </div>
      </div>
    </div>
  );
}
