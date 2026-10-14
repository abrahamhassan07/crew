"use client";

import { useState } from "react";
import type { EnrichedJob } from "@/lib/design";
import type { Crew } from "@/lib/supabase/types";
import { addDays, fmtISO, startOfWeek, MONTHS } from "@/lib/design";

interface MonthGridProps {
  monthAnchor: Date; // any date within the target month
  jobsByDate: Map<string, EnrichedJob[]>;
  crewById: Map<string, Crew>;
  todayIso: string;
  onDayClick: (iso: string) => void;
  onJobClick: (jobId: string) => void;
  canEdit: boolean;
  onDropOnDay: (iso: string, e: React.DragEvent) => void;
}

export function MonthGrid({ monthAnchor, jobsByDate, crewById, todayIso, onDayClick, onJobClick, canEdit, onDropOnDay }: MonthGridProps) {
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > addDays(new Date(year, month + 1, 0), 6)) break;
  }

  return (
    <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wide text-ink-muted py-2.5 border-l border-line-soft first:border-l-0">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-line-soft last:border-b-0">
          {week.map((date) => {
            const iso = fmtISO(date);
            const inMonth = date.getMonth() === month;
            const isToday = iso === todayIso;
            const dayJobs = jobsByDate.get(iso) ?? [];
            return (
              <button
                key={iso}
                onClick={() => onDayClick(iso)}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  if (dragOverIso !== iso) setDragOverIso(iso);
                }}
                onDragLeave={() => setDragOverIso((cur) => (cur === iso ? null : cur))}
                onDrop={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOverIso(null);
                  onDropOnDay(iso, e);
                }}
                className={`min-h-[104px] p-1.5 text-left border-l border-line-soft first:border-l-0 hover:bg-page-bg transition-colors ${
                  dragOverIso === iso ? "bg-ok-bg/60 ring-2 ring-inset ring-brand" : inMonth ? "" : "bg-page-bg/60"
                }`}
              >
                <div className={`text-xs font-bold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-brand text-white" : inMonth ? "text-ink-primary" : "text-ink-muted"}`}>
                  {date.getDate()}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayJobs.slice(0, 3).map((job) => {
                    const crew = job.crew_id ? crewById.get(job.crew_id) : undefined;
                    return (
                      <div
                        key={job.id}
                        role="button"
                        draggable={canEdit}
                        onDragStart={(e) => e.dataTransfer.setData("application/x-job-id", job.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onJobClick(job.id);
                        }}
                        className={`text-[10px] font-semibold text-ink-primary truncate px-1 py-0.5 rounded ${canEdit ? "cursor-grab" : ""}`}
                        style={{ background: crew?.tint_hex ?? job.typeTintHex, borderLeft: `2px solid ${crew?.color_hex ?? job.staffColorHex}` }}
                      >
                        {job.timeLabel} {job.client_name}
                      </div>
                    );
                  })}
                  {dayJobs.length > 3 && <div className="text-[10px] text-ink-muted px-1">+{dayJobs.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="px-3 py-1.5 text-[11px] text-ink-muted border-t border-line-soft">
        {MONTHS[month]} {year}
      </div>
    </div>
  );
}
