"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { approveDocument } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";

export interface ApprovalInfo {
  status: "pending" | "approved" | null;
  /** Who prepared the draft (a staff member's name), if it wasn't the owner. */
  drafter: string | null;
  approver: string | null;
  approvedAt: string | null;
  aiGenerated: boolean;
}

/** Owner/admin view of a draft prepared by someone else: who made it, whether AI helped, and the Approve button. */
export function ApprovalBanner({ kind, id, info }: { kind: "quote" | "invoice"; id: string; info: ApprovalInfo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!info.status && !info.drafter && !info.aiGenerated) return null;

  const approve = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveDocument(kind, id);
      if (!res.ok) return setError(res.error ?? "Couldn't approve.");
      router.refresh();
    });
  };
  const by = info.drafter ? `Prepared by ${info.drafter}` : "Prepared by you";
  const ai = info.aiGenerated ? " using voice AI" : "";

  if (info.status === "pending") {
    return (
      <div className="max-w-[1400px] mx-auto mb-5 px-4 py-3 rounded-lg text-sm border bg-warn-bg text-warn-fg border-warn-fg/25 flex flex-wrap items-center gap-3">
        <ClipboardCheck className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-[220px]">
          <strong>{by}{ai}. Waiting for your approval.</strong> Check the client, items and prices, then approve it. It can&apos;t be sent until you do.
          {error && <span className="block text-danger mt-1">{error}</span>}
        </span>
        <Button variant="primary" size="sm" onClick={approve} disabled={pending}>Approve draft</Button>
      </div>
    );
  }
  return (
    <div className="max-w-[1400px] mx-auto mb-5 px-4 py-2.5 rounded-lg text-xs border bg-ok-bg text-ok-fg border-ok-fg/25 flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>
        {by}{ai}
        {info.status === "approved" && info.approver ? `. Approved by ${info.approver}${info.approvedAt ? ` on ${new Date(info.approvedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}.` : "."}
      </span>
    </div>
  );
}
