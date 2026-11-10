"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Button } from "@/components/ui/Button";
import { saveAiSettings } from "@/app/(app)/aiActions";

export interface AiSettingsView {
  /** The plan includes AI features (Team and Business, a taste on the trial). */
  allowed: boolean;
  /** AI uses per month on this plan; null = no ceiling. */
  monthlyLimit: number | null;
  usedThisMonth: number;
  onTrial: boolean;
  auditor: boolean;
  voiceQuote: boolean;
  voiceInvoice: boolean;
  staffDrafts: boolean;
}

const FEATURES = [
  { key: "auditor", label: "Client Service Auditor", help: "Every Sunday morning, checks that each recurring client received their regular service, saves a report under Reports and emails you a summary." },
  { key: "voiceQuote", label: "Voice-to-Quote", help: "Speak a quote and get a draft. A Dictate button appears on the New quote page." },
  { key: "voiceInvoice", label: "Voice-to-Invoice", help: "Speak an invoice and get a draft. A Dictate button appears on the New invoice page." },
  { key: "staffDrafts", label: "Staff drafts", help: "Let staff prepare draft quotes and invoices (by typing or by voice) for the clients on jobs assigned to them. Staff can never send, approve or void anything, and see only their own drafts. You review each draft and approve it before it can be sent." },
] as const;

/** Settings card for the AI features: three independent switches. Drafts are never sent automatically. */
export function AiFeaturesCard({ ai }: { ai: AiSettingsView }) {
  const [on, setOn] = useState({ auditor: ai.auditor, voiceQuote: ai.voiceQuote, voiceInvoice: ai.voiceInvoice, staffDrafts: ai.staffDrafts });
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: keyof typeof on, value: boolean) => {
    const previous = on;
    const next = { ...on, [key]: value };
    setOn(next);
    setMessage(null);
    startTransition(async () => {
      const res = await saveAiSettings(next);
      if (!res.ok) {
        setOn(previous);
        setMessage({ text: res.error ?? "Couldn't save that.", ok: false });
        return;
      }
      setMessage({ text: "Saved.", ok: true });
    });
  };

  const enabledCount = Object.values(on).filter(Boolean).length;
  return (
    <CollapsibleCard
      className="xl:col-span-2"
      title="AI features"
      summary={!ai.allowed ? "Included with the Team plan and above" : enabledCount ? `${enabledCount} of 4 switched on` : "All switched off"}
    >
      <div className="pt-3 space-y-4">
        <p className="text-sm text-ink-muted">
          AI helps with paperwork but never sends anything on its own: voice drafts always wait for a person to review them, and reports only appear in your account.
        </p>

        {!ai.allowed ? (
          <>
            <p className="text-sm text-ink-secondary">Voice-to-Quote, Voice-to-Invoice and the Client Service Auditor are included with the Team and Business plans.</p>
            <Link href="/subscription">
              <Button variant="primary" type="button">See plans</Button>
            </Link>
          </>
        ) : (
          <>
            {ai.onTrial && ai.monthlyLimit !== null && (
              <p className="text-sm rounded-lg bg-info-bg text-info-fg px-3 py-2.5">
                On your free trial you get {ai.monthlyLimit} AI uses a month ({ai.usedThisMonth} used so far). <Link href="/subscription" className="font-semibold underline">Upgrade to Team</Link> for much more.
              </p>
            )}
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <label key={f.key} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={on[f.key]} disabled={pending} onChange={(e) => toggle(f.key, e.target.checked)} />
                  <span>
                    <span className="block text-sm font-semibold text-ink-primary">Enable {f.label}</span>
                    <span className="block text-xs text-ink-muted">{f.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {!ai.onTrial && ai.monthlyLimit !== null && (
              <p className="text-xs text-ink-muted">
                {ai.usedThisMonth} of {ai.monthlyLimit} AI uses this month. The limit is a safety ceiling and resets on the 1st.
              </p>
            )}
            {message && <p className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</p>}
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}
