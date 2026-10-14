"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bug, CircleHelp, Lightbulb } from "lucide-react";
import { submitFeedback } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField, TextAreaField } from "@/components/forms";
import { ToastBanner, useToast } from "@/components/Toast";
import type { Feedback, FeedbackKind, FeedbackStatus } from "@/lib/supabase/types";

export const KIND_META: Record<FeedbackKind, { label: string; icon: typeof Bug; hint: string }> = {
  bug: { label: "Something's broken", icon: Bug, hint: "What did you do, what did you expect, and what happened instead?" },
  idea: { label: "Idea or improvement", icon: Lightbulb, hint: "What would make this easier or better for you?" },
  question: { label: "Question", icon: CircleHelp, hint: "What are you trying to do or understand?" },
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Received",
  in_progress: "In progress",
  done: "Done",
  wont_fix: "Won't fix",
};

export const STATUS_BADGE: Record<FeedbackStatus, "new" | "in-progress" | "completed" | "closed"> = {
  new: "new",
  in_progress: "in-progress",
  done: "completed",
  wont_fix: "closed",
};

export function FeedbackPageClient({ items, unavailable, isPlatformAdmin }: { items: Feedback[]; unavailable: boolean; isPlatformAdmin: boolean }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  // AppShell remembers the last real page you were on, so a bug report can say where it happened.
  const [page, setPage] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem("crew:lastPath") ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback({ kind, title, message, page, userAgent: navigator.userAgent });
      if (!result.ok) {
        setError(result.error ?? "Could not send feedback.");
        return;
      }
      setTitle("");
      setMessage("");
      showToast("Thanks, your feedback was sent");
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Feedback"
        subtitle="Found a bug, have an idea, or stuck on something? Tell us here."
        actions={
          isPlatformAdmin ? (
            <Link href="/admin/feedback">
              <Button variant="secondary" type="button">All feedback</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          {unavailable && (
            <div className="px-4 py-3 rounded-lg text-sm bg-warn-bg text-warn-fg border border-warn-fg/25">
              Feedback isn&rsquo;t switched on yet. Please check back soon.
            </div>
          )}

          <Card className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(KIND_META) as FeedbackKind[]).map((k) => {
                const Icon = KIND_META[k].icon;
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 px-3.5 py-3 rounded-lg border text-sm font-semibold text-left transition-colors ${
                      on ? "border-brand bg-ok-bg text-brand" : "border-line bg-card-bg text-ink-secondary hover:bg-page-bg"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {KIND_META[k].label}
                  </button>
                );
              })}
            </div>

            <TextField label="Title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short summary" />
            <TextAreaField label="Details" rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={KIND_META[kind].hint} />
            <TextField label="Page it happened on" value={page} onChange={(e) => setPage(e.target.value)} help="Filled in automatically from the last page you visited. Change it if it's wrong." />

            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end">
              <Button variant="primary" onClick={send} disabled={pending || unavailable || !title.trim()}>
                {pending ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          </Card>

          <div>
            <h2 className="text-lg font-bold text-ink-primary mb-3">Your feedback</h2>
            {items.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted text-sm">Nothing yet. Anything you send will show up here with its status.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {items.map((f) => {
                  const Icon = KIND_META[f.kind].icon;
                  return (
                    <div key={f.id} className="bg-card-bg border border-line rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Icon className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-ink-primary">{f.title}</div>
                            <div className="text-xs text-ink-muted mt-0.5">
                              {new Date(f.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                              {f.page ? ` · ${f.page}` : ""}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={STATUS_BADGE[f.status]} label={STATUS_LABEL[f.status]} showDot />
                      </div>
                      {f.message && <p className="text-sm text-ink-secondary mt-2.5 whitespace-pre-wrap">{f.message}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastBanner message={toast} />
    </div>
  );
}
