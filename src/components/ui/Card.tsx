import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-card-bg border border-line rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  delta?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
  };
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  delta,
  subtitle,
  onClick,
  className = "",
}: StatCardProps) {
  const trendColors = {
    up: "bg-ok-bg text-ok-fg",
    down: "bg-bad-bg text-bad-fg",
    neutral: "bg-neutral-bg text-neutral-fg",
  };

  return (
    <button
      onClick={onClick}
      className={`text-left bg-card-bg border border-line rounded-lg p-3 hover:border-line hover:shadow-md transition-all ${className}`}
      style={{ minHeight: "104px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-brand text-sm">{icon}</span>}
        <span className="text-xs font-semibold text-ink-muted truncate">{label}</span>
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-2xl font-bold text-ink-primary">{value}</span>
        {delta && (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${trendColors[delta.trend]} inline-flex items-center gap-1`}>
            <span>{delta.trend === "up" ? "↑" : delta.trend === "down" ? "↓" : "→"}</span>
            {delta.value}
          </span>
        )}
      </div>

      {subtitle && <span className="text-[11px] text-ink-muted mt-1 truncate">{subtitle}</span>}
    </button>
  );
}
