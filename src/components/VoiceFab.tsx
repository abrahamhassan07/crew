"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Loader2, Mic, Receipt, Square, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { stashVoiceDraft, useVoiceRecorder, type VoiceKind } from "@/lib/useVoiceRecorder";

/** Pages where the floating mic shows (phones only). Never on forms, where it would cover Save. */
export function voiceFabVisibleOn(pathname: string): boolean {
  return ["/dashboard", "/schedule", "/jobs", "/clients", "/quotes", "/invoices", "/drafts"].includes(pathname.replace(/\/$/, ""));
}

/**
 * Floating microphone (phones). Tap, choose quote or invoice, speak, and the normal editor opens with a DRAFT filled in
 * for review. Nothing is saved or sent automatically. Recording happens inside this sheet because phones only allow the
 * microphone when it starts from a tap.
 */
export function VoiceFab({ quote, invoice }: { quote: boolean; invoice: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VoiceKind | null>(null);
  const [opening, setOpening] = useState(false);
  const rec = useVoiceRecorder((draft, k) => {
    setOpening(true);
    stashVoiceDraft(k, draft);
    router.push(k === "quote" ? "/quotes/new?voice=1" : "/invoices/new?voice=1");
  });

  if ((!quote && !invoice) || !voiceFabVisibleOn(pathname)) return null;
  const only: VoiceKind | null = quote && !invoice ? "quote" : invoice && !quote ? "invoice" : null;
  const chosen = kind ?? only;

  const close = () => {
    rec.cancel();
    setOpen(false);
    setKind(null);
    setOpening(false);
  };

  return (
    <div className="md:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Dictate a quote or invoice"
          className="fixed right-4 z-40 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={rec.state === "idle" && !opening ? close : undefined} />
          <div
            role="dialog"
            aria-label="Dictate a draft"
            className="fixed inset-x-0 bottom-0 z-50 bg-card-bg rounded-t-2xl shadow-2xl px-5 pt-4"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-ink-primary">{chosen ? `Dictate ${chosen === "invoice" ? "an" : "a"} ${chosen}` : "What would you like to draft?"}</h2>
              <button type="button" onClick={close} aria-label="Close" className="p-1.5 -mr-1.5 rounded-md text-ink-muted hover:bg-line-soft">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!chosen && (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setKind("quote")} className="flex flex-col items-center gap-2 rounded-xl border border-line py-5 text-sm font-semibold text-ink-primary active:bg-line-soft">
                  <FileText className="w-6 h-6 text-brand" /> Quote
                </button>
                <button type="button" onClick={() => setKind("invoice")} className="flex flex-col items-center gap-2 rounded-xl border border-line py-5 text-sm font-semibold text-ink-primary active:bg-line-soft">
                  <Receipt className="w-6 h-6 text-brand" /> Invoice
                </button>
              </div>
            )}

            {chosen && (
              <div className="flex flex-col items-center text-center gap-3">
                {opening ? (
                  <p className="flex items-center gap-2 text-sm text-ink-secondary py-6">
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening your draft…
                  </p>
                ) : rec.state === "idle" ? (
                  <button type="button" onClick={() => void rec.start(chosen)} aria-label="Start recording" className="w-20 h-20 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform">
                    <Mic className="w-8 h-8" />
                  </button>
                ) : rec.state === "recording" ? (
                  <button type="button" onClick={rec.stop} aria-label="Stop recording" className="w-20 h-20 rounded-full bg-danger-red text-white shadow-lg flex flex-col items-center justify-center animate-pulse">
                    <Square className="w-7 h-7" />
                    <span className="text-xs font-bold mt-0.5">{rec.seconds}s</span>
                  </button>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-ink-secondary py-6">
                    <Loader2 className="w-4 h-4 animate-spin" /> Listening and drafting…
                  </p>
                )}
                {!opening && rec.state === "idle" && <p className="text-sm font-semibold text-ink-primary">Tap to start, tap again to stop</p>}
                {!opening && rec.state === "recording" && <p className="text-sm font-semibold text-ink-primary">Recording. Tap to stop.</p>}
                {rec.error && (
                  <p className="text-sm text-danger">
                    {rec.error.text} {rec.error.upgrade && <Link href="/subscription" onClick={close} className="underline font-semibold">See plans</Link>}
                  </p>
                )}
                <p className="text-xs text-ink-muted">
                  Say who it&apos;s for and what work was done, with quantities. The {chosen} editor opens with a draft for you to check. Nothing is sent automatically. The recording isn&apos;t kept. AI can mishear names and numbers.
                </p>
                {!only && rec.state === "idle" && !opening && (
                  <Button variant="secondary" size="sm" onClick={() => setKind(chosen === "quote" ? "invoice" : "quote")}>
                    Change to {chosen === "quote" ? "invoice" : "quote"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
