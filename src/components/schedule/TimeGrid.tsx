"use client";

import type { EnrichedJob } from "@/lib/design";
import type { Crew } from "@/lib/supabase/types";
import { GRID_HEIGHT_PX, GRID_HOURS, HOUR_PX, blockHeight, blockTop, fmtHourLabel, fmtTimeRangeLabel, layoutOverlaps, nowOffsetPx } from "./scheduleTime";

export interface GridDay {
  iso: string;
  dayName: string;
  dateNum: number;
  isToday: boolean;
  jobs: EnrichedJob[];
}

interface TimeGridProps {
  days: GridDay[];
  crewById: Map<string, Crew>;
  canEdit: boolean;
  onSlotClick: (iso: string) => void;
  onJobClick: (jobId: string) => void;
  onDropOnDay: (iso: string, e: React.DragEvent) => void;
}

export function TimeGrid({ days, crewById, canEdit, onSlotClick, onJobClick, onDropOnDay }: TimeGridProps) {
  const nowPx = nowOffsetPx();

  return (
    <div className="bg-card-bg border border-line rounded-lg overflow-x-auto">
      {/* Day headers */}
      <div className="flex border-b border-line sticky top-0 bg-card-bg z-10">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div
            key={day.iso}
            className={`flex-1 min-w-[90px] text-center py-2.5 border-l border-line-soft ${day.isToday ? "bg-ok-bg/40" : ""}`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-wide ${day.isToday ? "text-brand" : "text-ink-muted"}`}>
              {day.dayName}
            </div>
            <div className={`text-lg font-bold ${day.isToday ? "text-brand" : "text-ink-primary"}`}>{day.dateNum}</div>
            <div className="text-[11px] text-ink-muted">{day.jobs.length} job{day.jobs.length === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>

      {/* Grid body — scrolls horizontally together with the header via the outer container */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT_PX }}>
          {GRID_HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-muted"
              style={{ top: i * HOUR_PX }}
            >
              {fmtHourLabel(h)}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day.iso}
            className="flex-1 min-w-[90px] relative border-l border-line-soft"
            style={{ height: GRID_HEIGHT_PX }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onSlotClick(day.iso);
            }}
            onDragOver={(e) => canEdit && e.preventDefault()}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              onDropOnDay(day.iso, e);
            }}
          >
            {/* Hour gridlines */}
            {GRID_HOURS.map((h, i) => (
              <div key={h} className="absolute left-0 right-0 border-t border-line-soft" style={{ top: i * HOUR_PX }} />
            ))}

            {/* Now indicator */}
            {day.isToday && nowPx != null && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowPx }}>
                <div className="h-[2px] bg-danger-red relative">
                  <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-danger-red" />
                </div>
              </div>
            )}

            {/* Job blocks — overlapping jobs cascade left-to-right (each nearly
                full width, later ones layered on top), Google Calendar-style,
                so there's room for time/client/address instead of a thin sliver */}
            {(() => {
              const layout = layoutOverlaps(day.jobs);
              return day.jobs.map((job) => {
                const crew = job.crew_id ? crewById.get(job.crew_id) : undefined;
                const bg = crew?.tint_hex ?? job.typeTintHex;
                const border = crew?.color_hex ?? job.staffColorHex;
                const { col, cols } = layout.get(job.id) ?? { col: 0, cols: 1 };
                const stepPct = cols > 1 ? Math.min(30, 60 / (cols - 1)) : 0;
                const leftPct = col * stepPct;
                const height = blockHeight(job.duration_minutes);
                const showAddress = height >= 60;
                return (
                  <button
                    key={job.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-job-id", job.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobClick(job.id);
                    }}
                    className="absolute flex flex-col items-stretch justify-start rounded-md px-2 py-1 text-left overflow-hidden hover:shadow-lg hover:z-20 transition-shadow cursor-pointer shadow-sm"
                    style={{
                      top: blockTop(job.start_time ?? "00:00"),
                      height,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${100 - leftPct}% - 4px)`,
                      zIndex: col + 1,
                      background: bg,
                      borderLeft: `3px solid ${border}`,
                      boxShadow: col > 0 ? "0 0 0 2px var(--color-card-bg)" : undefined,
                      opacity: job.status === "cancelled" ? 0.5 : 1,
                    }}
                    title={`${job.timeLabel} · ${job.client_name} · ${job.typeLabel}`}
                  >
                    <div className="text-[11px] font-bold text-ink-primary truncate flex items-center gap-1">
                      {job.status === "completed" && <span>✓</span>}
                      {job.status === "in_progress" && <span>▶</span>}
                      {fmtTimeRangeLabel(job.start_time, job.duration_minutes) || job.timeLabel}
                    </div>
                    <div className="text-[11px] font-semibold text-ink-primary truncate leading-tight">{job.client_name}</div>
                    {showAddress && <div className="text-[10px] text-ink-secondary truncate leading-tight mt-0.5">{job.address}</div>}
                  </button>
                );
              });
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
