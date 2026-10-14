"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** A Card whose body can be folded away; `summary` stays visible in the header so a closed card still says something. */
export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  className = "",
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={className}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-ink-primary">{title}</h2>
          {summary && <div className="text-xs text-ink-muted mt-0.5 truncate">{summary}</div>}
        </div>
        <ChevronDown className={`w-4 h-4 text-ink-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-line-soft">{children}</div>}
    </Card>
  );
}
