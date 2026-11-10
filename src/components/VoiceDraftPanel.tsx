"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { VoiceDraft } from "@/lib/ai/voiceDraft";

const MAX_SECONDS = 90;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

/**
 * Record a short description of the job, get a DRAFT back, and have it filled into the editor below for review.
 * Nothing is saved or sent from here. The recording is sent for transcription and is not kept.
 */
export function VoiceDraftPanel({ kind, onDraft }: { kind: "quote" | "invoice"; onDraft: (draft: VoiceDraft) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [last, setLast] = useState<VoiceDraft | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const stream = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTracks, []);

  const send = async (blob: Blob, secs: number) => {
    setState("working");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("seconds", String(secs));
      form.append("audio", blob, "recording");
      const res = await fetch("/api/ai/voice", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { draft?: VoiceDraft; error?: string; upgrade?: boolean };
      if (!res.ok || !data.draft) {
        setError({ text: data.error ?? "Something went wrong. You can still fill the form in by hand.", upgrade: data.upgrade });
      } else {
        setLast(data.draft);
        onDraft(data.draft);
      }
    } catch {
      setError({ text: "Couldn't reach the server. Check your connection and try again." });
    }
    setState("idle");
  };

  const start = async () => {
    setError(null);
    setLast(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError({ text: "This browser can't record audio. Try Chrome or Safari, or fill the form in by hand." });
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError({ text: "Microphone access was blocked. Allow the microphone for this site and try again." });
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const secs = Math.round((Date.now() - started.current) / 1000);
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
      stopTracks();
      void send(blob, secs);
    };
    recorder.current = rec;
    started.current = Date.now();
    setSeconds(0);
    rec.start();
    setState("recording");
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.stop();
    }, 500);
  };

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" && (
          <Button variant="secondary" size="sm" onClick={start}>
            <Mic className="w-4 h-4" /> Dictate {kind}
          </Button>
        )}
        {state === "recording" && (
          <Button variant="primary" size="sm" onClick={stop}>
            <Square className="w-3.5 h-3.5" /> Stop ({seconds}s)
          </Button>
        )}
        {state === "working" && (
          <span className="flex items-center gap-2 text-sm text-ink-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Listening and drafting…
          </span>
        )}
        <p className="text-xs text-ink-muted flex-1 min-w-[220px]">
          Say who it&apos;s for and what work was done, with quantities. English or Filipino. You review everything before saving, and nothing is sent automatically. The recording isn&apos;t kept. AI can mishear names and numbers.
        </p>
      </div>
      {error && (
        <p className="text-sm text-danger mt-3">
          {error.text} {error.upgrade && <Link href="/subscription" className="underline font-semibold">See plans</Link>}
        </p>
      )}
      {last && (
        <div className="mt-3 text-sm space-y-1.5">
          <p className="font-semibold text-ink-primary">Draft filled in below. Please check it.</p>
          {last.warnings.map((w, i) => (
            <p key={i} className="text-warn-fg">• {w}</p>
          ))}
          {last.lines.filter((l) => l.warning).map((l, i) => (
            <p key={`l${i}`} className="text-warn-fg">• {l.serviceName}: {l.warning}</p>
          ))}
          <details className="text-ink-muted">
            <summary className="cursor-pointer text-xs">What I heard ({last.language})</summary>
            <p className="mt-1 text-xs whitespace-pre-wrap">{last.transcript}</p>
          </details>
        </div>
      )}
    </Card>
  );
}
