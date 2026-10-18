"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Shown right after a job is marked completed: offer to start an invoice prefilled from the job. */
export function CreateInvoicePrompt({ jobLabel, onCreate, onSkip }: { jobLabel: string; onCreate: () => void; onSkip: () => void }) {
  return (
    <>
      <div onClick={onSkip} className="fixed inset-0 bg-black/45 z-[110]" />
      <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-labelledby="create-invoice-title" className="bg-card-bg rounded-xl w-full max-w-sm p-6 pointer-events-auto shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-ok-bg text-ok-fg flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5" />
          </div>
          <h2 id="create-invoice-title" className="text-lg font-bold text-ink-primary">Job completed. Create the invoice?</h2>
          <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
            We&rsquo;ll start a new invoice for {jobLabel} with the client, address and job details filled in. You can check it before saving or sending.
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={onSkip}>Not now</Button>
            <Button variant="primary" onClick={onCreate} autoFocus>Create invoice</Button>
          </div>
        </div>
      </div>
    </>
  );
}
