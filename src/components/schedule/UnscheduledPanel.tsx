"use client";

import { GripVertical } from "lucide-react";
import type { ServiceRequest, Service, Crew } from "@/lib/supabase/types";

interface UnscheduledPanelProps {
  requests: ServiceRequest[];
  services: Service[];
  crewById: Map<string, Crew>;
  canEdit: boolean;
  onQuickSchedule: (requestId: string) => void;
}

export function UnscheduledPanel({ requests, services, crewById, canEdit, onQuickSchedule }: UnscheduledPanelProps) {
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return (
    <div className="w-full lg:w-72 shrink-0 bg-card-bg border border-line rounded-lg overflow-hidden h-fit">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="font-bold text-sm text-ink-primary">Unscheduled</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn-bg text-warn-fg">{requests.length}</span>
      </div>
      <p className="px-4 pt-3 text-xs text-ink-muted">
        {canEdit ? "Drag onto the calendar to book in, or use Quick schedule." : "Requests waiting to be scheduled."}
      </p>
      <div className="p-3 flex flex-col gap-2">
        {requests.length === 0 && <div className="text-xs text-ink-muted text-center py-4">Nothing waiting to be scheduled.</div>}
        {requests.map((r) => {
          const service = r.service_id ? serviceById.get(r.service_id) : undefined;
          const crew = service?.default_crew_id ? crewById.get(service.default_crew_id) : undefined;
          return (
            <div
              key={r.id}
              draggable={canEdit}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-request-id", r.id);
              }}
              className={`border border-line rounded-lg p-3 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={crew ? { borderLeftColor: crew.color_hex, borderLeftWidth: 3 } : undefined}
            >
              <div className="flex items-start gap-2">
                {canEdit && <GripVertical className="w-3.5 h-3.5 text-ink-muted mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-primary truncate">{r.name}</div>
                  <div className="text-xs text-ink-muted truncate">
                    {service ? `${service.name} · ${service.duration_minutes >= 60 ? `${(service.duration_minutes / 60).toFixed(service.duration_minutes % 60 ? 1 : 0)}h` : `${service.duration_minutes}m`}` : "No service selected"}
                  </div>
                  {crew && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: crew.color_hex }} />
                      <span className="text-[11px] text-ink-muted">{crew.name}</span>
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => onQuickSchedule(r.id)}
                  className="mt-2 w-full text-center text-xs font-semibold text-brand hover:text-brand-hover py-1.5 rounded-md border border-line hover:bg-page-bg transition-colors"
                >
                  Quick schedule (today, 9am)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
