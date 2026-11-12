"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { VoiceDraft } from "@/lib/ai/voiceDraft";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";

/**
 * Record a short description of the job, get a DRAFT back, and have it filled into the editor below for review.
 * Nothing is saved or sent from here. The recording is sent for transcription and is not kept.
 * `initialDraft` is a draft already made with the floating mic button, shown here so its warnings aren't lost.
 */
export function VoiceDraftPanel({ kind, onDraft, initialDraft = null }: { kind: "quote" | "invoice"; onDraft: (draft: VoiceDraft) => void; initialDraft?: VoiceDraft | null }) {
  const [last, setLast] = useState<VoiceDraft | null>(null);
  const shown = last ?? initialDraft;
  const rec = useVoiceRecorder((draft) => {
    setLast(draft);
    onDraft(draft);
  });
  const start = () => {
    setLast(null);
    void rec.start(kind);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {rec.state === "idle" && (
          <Button variant="secondary" size="sm" onClick={start}>
            <Mic className="w-4 h-4" /> Dictate {kind}
          </Button>
        )}
        {rec.state === "recording" && (
          <Button variant="primary" size="sm" onClick={rec.stop}>
            <Square className="w-3.5 h-3.5" /> Stop ({rec.seconds}s)
          </Button>
        )}
        {rec.state === "working" && (
          <span className="flex items-center gap-2 text-sm text-ink-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Listening and drafting…
          </span>
        )}
        <p className="text-xs text-ink-muted flex-1 min-w-[220px]">
          Say who it&apos;s for and what work was done, with quantities. English or Filipino. You review everything before saving, and nothing is sent automatically. The recording isn&apos;t kept. AI can mishear names and numbers.
        </p>
      </div>
      {rec.error && (
        <p className="text-sm text-danger mt-3">
          {rec.error.text} {rec.error.upgrade && <Link href="/subscription" className="underline font-semibold">See plans</Link>}
        </p>
      )}
      {shown && !rec.error && rec.state === "idle" && (
        <div className="mt-3 text-sm space-y-1.5">
          <p className="font-semibold text-ink-primary">Draft filled in below. Please check it.</p>
          {shown.warnings.map((w, i) => (
            <p key={i} className="text-warn-fg">• {w}</p>
          ))}
          {shown.lines.filter((l) => l.warning).map((l, i) => (
            <p key={`l${i}`} className="text-warn-fg">• {l.serviceName}: {l.warning}</p>
          ))}
          <details className="text-ink-muted">
            <summary className="cursor-pointer text-xs">What I heard ({shown.language})</summary>
            <p className="mt-1 text-xs whitespace-pre-wrap">{shown.transcript}</p>
          </details>
        </div>
      )}
    </Card>
  );
}
