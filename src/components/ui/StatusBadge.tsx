import React from "react";

type StatusType =
  | "active"
  | "approved"
  | "paid"
  | "completed"
  | "converted"
  | "lead"
  | "new"
  | "sent"
  | "scheduled"
  | "contacted"
  | "unscheduled"
  | "partially-paid"
  | "expired"
  | "overdue"
  | "declined"
  | "cancelled"
  | "in-progress"
  | "quoted"
  | "draft"
  | "inactive"
  | "archived"
  | "closed"
  | "voided";

const statusColorMap: Record<StatusType, { bg: string; fg: string; dot: string }> = {
  // OK (green)
  active: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-fg)" },
  approved: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-fg)" },
  paid: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-fg)" },
  completed: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-fg)" },
  converted: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-fg)" },

  // Info (blue)
  lead: { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-fg)" },
  new: { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-fg)" },
  sent: { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-fg)" },
  scheduled: { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-fg)" },

  // Warn (amber)
  contacted: { bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-fg)" },
  unscheduled: { bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-fg)" },
  "partially-paid": { bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-fg)" },
  expired: { bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-fg)" },

  // Bad (red)
  overdue: { bg: "var(--bad-bg)", fg: "var(--bad-fg)", dot: "var(--bad-fg)" },
  declined: { bg: "var(--bad-bg)", fg: "var(--bad-fg)", dot: "var(--bad-fg)" },
  cancelled: { bg: "var(--bad-bg)", fg: "var(--bad-fg)", dot: "var(--bad-fg)" },

  // Violet
  "in-progress": { bg: "var(--violet-bg)", fg: "var(--violet-fg)", dot: "var(--violet-fg)" },
  quoted: { bg: "var(--violet-bg)", fg: "var(--violet-fg)", dot: "var(--violet-fg)" },

  // Neutral (gray)
  draft: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-fg)" },
  inactive: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-fg)" },
  archived: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-fg)" },
  closed: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-fg)" },
  voided: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-fg)" },
};

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  showDot = true,
  className = "",
}: StatusBadgeProps) {
  const colors = statusColorMap[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colors.dot }}
        />
      )}
      {label}
    </span>
  );
}
