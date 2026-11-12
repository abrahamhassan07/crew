"use client";

import { useEffect, useRef, useState } from "react";
import type { VoiceDraft } from "@/lib/ai/voiceDraft";

export const VOICE_MAX_SECONDS = 90;
/** Where the floating mic hands a finished draft to the quote/invoice editor (this tab only, read once). */
export const VOICE_HANDOFF_KEY = "crew:voiceDraft";
const HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;

export type VoiceKind = "quote" | "invoice";
export type VoiceError = { text: string; upgrade?: boolean };

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

/** Store a draft for the editor page to pick up. Returns false if the browser blocks storage. */
export function stashVoiceDraft(kind: VoiceKind, draft: VoiceDraft): boolean {
  try {
    sessionStorage.setItem(VOICE_HANDOFF_KEY, JSON.stringify({ kind, draft, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Take (and remove) a stashed draft of this kind, if there is a recent one. */
export function takeVoiceDraft(kind: VoiceKind): VoiceDraft | null {
  try {
    const raw = sessionStorage.getItem(VOICE_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(VOICE_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as { kind?: string; draft?: VoiceDraft; at?: number };
    if (parsed.kind !== kind || !parsed.draft || !parsed.at || Date.now() - parsed.at > HANDOFF_MAX_AGE_MS) return null;
    return parsed.draft;
  } catch {
    return null;
  }
}

/**
 * Records a short clip and sends it to /api/ai/voice, which returns a DRAFT. Nothing is saved or sent anywhere else.
 * `start` must be called straight from a tap (iPhones only allow the microphone that way).
 */
export function useVoiceRecorder(onDraft: (draft: VoiceDraft, kind: VoiceKind) => void) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<VoiceError | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);
  const onDraftRef = useRef(onDraft);
  useEffect(() => {
    onDraftRef.current = onDraft;
  });

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopTracks();
    },
    []
  );

  const send = async (blob: Blob, secs: number, kind: VoiceKind) => {
    setState("working");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("seconds", String(secs));
      form.append("audio", blob, "recording");
      const res = await fetch("/api/ai/voice", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { draft?: VoiceDraft; error?: string; upgrade?: boolean };
      if (cancelled.current) return;
      if (!res.ok || !data.draft) setError({ text: data.error ?? "Something went wrong. You can still fill the form in by hand.", upgrade: data.upgrade });
      else onDraftRef.current(data.draft, kind);
    } catch {
      if (!cancelled.current) setError({ text: "Couldn't reach the server. Check your connection and try again." });
    }
    if (!cancelled.current) setState("idle");
  };

  const start = async (kind: VoiceKind) => {
    setError(null);
    cancelled.current = false;
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
      if (cancelled.current) return;
      void send(blob, secs, kind);
    };
    recorder.current = rec;
    started.current = Date.now();
    setSeconds(0);
    rec.start();
    setState("recording");
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= VOICE_MAX_SECONDS) rec.stop();
    }, 500);
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  /** Throw the recording away (or ignore a reply still on its way). */
  const cancel = () => {
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopTracks();
    setState("idle");
    setError(null);
  };

  return { state, seconds, error, start, stop, cancel };
}
