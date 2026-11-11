"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewJobButton } from "@/components/NewJobButton";
import { useJobModal } from "@/components/JobModalContext";
import { rescheduleJob, convertRequestToJob } from "@/app/(app)/actions";
import { addDays, DAYS, fmtDateLabel, fmtISO, fmtMonthDay, MONTHS, parseISO, startOfWeek, todayISO } from "@/lib/design";
import type { EnrichedJob } from "@/lib/design";
import type { Crew, Service, ServiceRequest } from "@/lib/supabase/types";
import { TimeGrid, type GridDay } from "./TimeGrid";
import { MonthGrid } from "./MonthGrid";
import { CrewView } from "./CrewView";
import { UnscheduledPanel } from "./UnscheduledPanel";
import { GRID_END_MIN, GRID_START_MIN, minutesToTime } from "./scheduleTime";

type View = "day" | "week" | "month" | "crew";

// The week view is one long strip of days you can scroll sideways. It starts a few weeks either side of the week
// you're looking at and grows by STRIP_GROW days whenever you get close to either end.
const STRIP_BEFORE = 28;
const STRIP_DAYS = 91;
const STRIP_GROW = 28;
const STRIP_EDGE = 7;
const HOUR_LABEL_PX = 56;
const midnight = (d: Date) => parseISO(fmtISO(d));
const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / 86_400_000);

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

  // ---- Scrolling week strip ----
  const scroller = useRef<HTMLDivElement>(null);
  const [stripStart, setStripStart] = useState(() => addDays(midnight(startOfWeek(new Date())), -STRIP_BEFORE));
  const [stripDays, setStripDays] = useState(STRIP_DAYS);
  const [colWidth, setColWidth] = useState(120);
  const [visibleCols, setVisibleCols] = useState(7);
  const [firstVisible, setFirstVisible] = useState(STRIP_BEFORE);
  // A day index (may be fractional) to scroll to once the grid has rendered: first load, switching to week, jumping
  // far away, or keeping your place when earlier days are added on the left.
  const pendingScroll = useRef<number | null>(STRIP_BEFORE);
  const growing = useRef(false);

  // Seven days fill the width on a computer; on a phone each day keeps a readable minimum and you swipe.
  useEffect(() => {
    const el = scroller.current;
    if (view !== "week" || !el) return;
    const measure = () => {
      const w = Math.max(90, Math.floor((el.clientWidth - HOUR_LABEL_PX) / 7));
      setColWidth(w);
      setVisibleCols(Math.max(1, Math.min(7, Math.floor((el.clientWidth - HOUR_LABEL_PX) / w))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  // Once added days are on screen, nearing an edge can grow the strip again.
  useLayoutEffect(() => {
    growing.current = false;
  }, [stripStart, stripDays]);

  // Applies a pending scroll position. Always an exact position (never "move by"), so it can't be applied twice.
  useLayoutEffect(() => {
    const el = scroller.current;
    const p = pendingScroll.current;
    if (view === "week" && el && p != null) {
      pendingScroll.current = null;
      el.scrollLeft = p * colWidth;
    }
  });

  // Keep the first visible day in place when the column width changes (window resized).
  const prevColWidth = useRef(colWidth);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && prevColWidth.current !== colWidth && !pendingScroll.current) el.scrollLeft = firstVisible * colWidth;
    prevColWidth.current = colWidth;
  }, [colWidth, firstVisible]);

  /** Scrolls the strip so `date` is the first column, rebuilding the strip around it if it's out of range. */
  const scrollStripTo = useCallback(
    (date: Date, smooth: boolean) => {
      const idx = daysBetween(stripStart, date);
      const inRange = idx >= STRIP_EDGE && idx <= stripDays - 7 - STRIP_EDGE;
      if (inRange && scroller.current) {
        scroller.current.scrollTo({ left: idx * colWidth, behavior: smooth ? "smooth" : "auto" });
        return;
      }
      if (inRange) {
        // The grid isn't on screen yet (switching to week view): scroll once it renders.
        pendingScroll.current = idx;
        setFirstVisible(idx);
        return;
      }
      setStripStart(addDays(midnight(date), -STRIP_BEFORE));
      setStripDays(STRIP_DAYS);
      setFirstVisible(STRIP_BEFORE);
      pendingScroll.current = STRIP_BEFORE;
    },
    [stripStart, stripDays, colWidth]
  );

  const onStripScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const first = Math.round(el.scrollLeft / colWidth);
    if (first !== firstVisible) setFirstVisible(first);
    if (growing.current) return;
    if (first + visibleCols > stripDays - STRIP_EDGE) {
      growing.current = true;
      setStripDays((n) => n + STRIP_GROW);
    } else if (first < STRIP_EDGE) {
      growing.current = true;
      // Keep exactly the same spot: the days you're looking at move STRIP_GROW columns to the right.
      pendingScroll.current = el.scrollLeft / colWidth + STRIP_GROW;
      setStripStart((d) => addDays(d, -STRIP_GROW));
      setStripDays((n) => n + STRIP_GROW);
    }
  };

  // The day the strip is showing first, used for the label, New job's date and when switching views.
  const stripFirstDay = addDays(stripStart, firstVisible);

  const goToday = () => {
    setAnchor(new Date());
    if (view === "week") scrollStripTo(midnight(startOfWeek(new Date())), true);
  };
  const goPrev = () => {
    if (view === "day") setAnchor((d) => addDays(d, -1));
    else if (view === "month") setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === "week") scrollStripTo(addDays(stripFirstDay, -7), true);
    else setAnchor((d) => addDays(d, -7));
  };
  const goNext = () => {
    if (view === "day") setAnchor((d) => addDays(d, 1));
    else if (view === "month") setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === "week") scrollStripTo(addDays(stripFirstDay, 7), true);
    else setAnchor((d) => addDays(d, 7));
  };

  const changeView = (v: View) => {
    // Carry the date across: leaving the strip keeps the day you scrolled to; entering it opens on the anchor's week.
    if (view === "week" && v !== "week") setAnchor(stripFirstDay);
    if (v === "week" && view !== "week") scrollStripTo(midnight(startOfWeek(anchor)), false);
    setView(v);
  };

  const weekStart = startOfWeek(anchor);
  const weekEnd = addDays(weekStart, 6);

  const rangeLabel =
    view === "day"
      ? fmtDateLabel(fmtISO(anchor))
      : view === "month"
        ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
        : view === "week"
          ? `${fmtMonthDay(stripFirstDay)} – ${fmtMonthDay(addDays(stripFirstDay, visibleCols - 1))}`
          : `${fmtMonthDay(weekStart)} – ${fmtMonthDay(weekEnd)}`;

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

  const buildGridDays = (start: Date, count: number): GridDay[] =>
    Array.from({ length: count }, (_, i) => {
      const d = addDays(start, i);
      const iso = fmtISO(d);
      return {
        iso,
        dayName: DAYS[d.getDay()],
        dateNum: d.getDate(),
        monthName: MONTHS[d.getMonth()],
        isToday: iso === today,
        jobs: [...(jobsByDate.get(iso) ?? [])].sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
      };
    });

  const gridDays = view === "day" ? buildGridDays(anchor, 1) : buildGridDays(stripStart, stripDays);


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

  const handleDropOnDay = async (iso: string, startMinutes: number, e: React.DragEvent) => {
    const jobId = e.dataTransfer.getData("application/x-job-id");
    const requestId = e.dataTransfer.getData("application/x-request-id");
    // Keep the whole block inside the visible grid.
    const clampStart = (durationMinutes: number) =>
      minutesToTime(Math.min(Math.max(startMinutes, GRID_START_MIN), Math.max(GRID_START_MIN, GRID_END_MIN - durationMinutes)));
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      await rescheduleJob(jobId, iso, clampStart(job?.duration_minutes ?? 60));
      router.refresh();
    } else if (requestId) {
      await convertRequestToJob(requestId, iso, clampStart(60));
      router.refresh();
    }
  };

  // Month view has no time axis: moving a job keeps its time (or gives an unscheduled one 09:00).
  const handleMonthDrop = async (iso: string, e: React.DragEvent) => {
    const jobId = e.dataTransfer.getData("application/x-job-id");
    const requestId = e.dataTransfer.getData("application/x-request-id");
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      await rescheduleJob(jobId, iso, job?.start_time ? undefined : "09:00");
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
                  onClick={() => changeView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors ${
                    view === v ? "bg-card-bg text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <NewJobButton prefillDate={fmtISO(view === "week" ? stripFirstDay : anchor)} />
          </>
        }
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
                key={view}
                days={gridDays}
                crewById={crewById}
                canEdit={isAdmin}
                onSlotClick={(iso) => openNewJob(iso)}
                onJobClick={openJob}
                onDropOnDay={handleDropOnDay}
                {...(view === "week" ? { colWidth, scrollRef: scroller, onScroll: onStripScroll } : {})}
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
                canEdit={isAdmin}
                onDropOnDay={handleMonthDrop}
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
