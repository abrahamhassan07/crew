"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const DONE_KEY = "crew-tour-done";
export const START_TOUR_EVENT = "crew:start-tour";

interface Step {
  /** Matches a data-tour attribute; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { title: "Welcome to Crew & Grounds", body: "Here's a quick look around so you know where everything lives. It takes about a minute, and you can skip it any time." },
  { target: "/settings", title: "Start with Settings", body: "Add your business name, email and payment details. They appear on every quote and invoice, and your clients' replies come to your email." },
  { target: "/clients", title: "Your clients", body: "Keep everyone you work for in one place, with their addresses, jobs and notes. You can also add a client on the spot when you create a quote or job." },
  { target: "create", title: "Create anything from here", body: "Add a client, job, quote or invoice from this button, no matter which page you're on." },
  { target: "/quotes", title: "Send quotes", body: "Build a quote and email it to your client as a PDF. You can review and edit the email before it goes." },
  { target: "/schedule", title: "Plan your week", body: "See every job on the calendar. Drag a job to move it, and assign it to someone on your team." },
  { target: "/invoices", title: "Get paid", body: "Turn finished work into invoices, email them, and record payments as they come in." },
  { target: "/staff", title: "Add your team", body: "Invite staff so you can assign them jobs. Turn on staff notifications in Settings and they'll get an email when a job is assigned or changes." },
  { target: "/feedback", title: "Tell us what you think", body: "Found a bug or want something added? Send it here. We read every message." },
  { title: "You're all set", body: "You can replay this tour whenever you like with “Take the tour” in the sidebar. Good luck with your first quote!" },
];

const subscribeDone = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(START_TOUR_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(START_TOUR_EVENT, cb);
  };
};
const doneSnapshot = () => {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
};

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const CARD_W = 340;

/**
 * Guided tour: dims the page, spotlights the sidebar items (or the Create button) one at a time
 * and explains each. Starts by itself for brand-new businesses (`autoStart`), can be skipped
 * at any point, and can be replayed from the sidebar. "Done" is remembered per browser.
 */
export function ProductTour({ autoStart, openMobileNav }: { autoStart: boolean; openMobileNav: (open: boolean) => void }) {
  const done = useSyncExternalStore(subscribeDone, doneSnapshot, () => true);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);

  const step = STEPS[index];

  const finish = useCallback(() => {
    setActive(false);
    openMobileNav(false);
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {}
    window.dispatchEvent(new Event("storage"));
  }, [openMobileNav]);

  // Replay from the sidebar.
  useEffect(() => {
    const start = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  // First visit for a brand-new business.
  useEffect(() => {
    if (!autoStart || done) return;
    const t = window.setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const measure = useCallback(() => {
    if (!active || !step.target) {
      setBox(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    setBox(visible ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null);
  }, [active, step]);

  // On phones the sidebar is a drawer: open it for sidebar steps, close it for the rest.
  useEffect(() => {
    if (!active) return;
    if (window.innerWidth < 768) openMobileNav(!!step.target && step.target.startsWith("/"));
    const t = window.setTimeout(measure, 280);
    return () => window.clearTimeout(t);
  }, [active, index, step, measure, openMobileNav]);

  useLayoutEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, active]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, active]);

  const next = useCallback(() => (index === STEPS.length - 1 ? finish() : setIndex(index + 1)), [index, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, back, finish]);

  if (!active) return null;

  // Card position: beside the spotlight (right of sidebar items, below the top-bar button), else centred.
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const cardW = Math.min(CARD_W, vw - 24);
  let cardStyle: React.CSSProperties = { top: Math.max(12, vh / 2 - cardH / 2), left: Math.max(12, vw / 2 - cardW / 2) };
  if (box) {
    const sidebarStep = step.target?.startsWith("/");
    const left = sidebarStep && box.left + box.width + 16 + cardW < vw ? box.left + box.width + 16 : Math.min(Math.max(12, box.left + box.width - cardW), vw - cardW - 12);
    const top = sidebarStep && box.left + box.width + 16 + cardW < vw ? box.top + box.height / 2 - cardH / 2 : box.top + box.height + 14;
    cardStyle = { top: Math.min(Math.max(12, top), vh - cardH - 12), left };
  }

  return (
    <div className="fixed inset-0 z-200" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Click shield: the page underneath isn't usable while the tour runs. */}
      <div className="absolute inset-0" />
      {box ? (
        <div
          className="absolute rounded-xl pointer-events-none tour-spotlight"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(10, 30, 20, 0.62)", transition: "all 320ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(10,30,20,0.62)] pointer-events-none" />
      )}

      <div
        ref={cardRef}
        className="absolute bg-card-bg rounded-xl shadow-2xl p-5 z-201"
        style={{ width: cardW, transition: "top 320ms cubic-bezier(0.4, 0, 0.2, 1), left 320ms cubic-bezier(0.4, 0, 0.2, 1)", ...cardStyle }}
      >
        <button onClick={finish} aria-label="Skip the tour" className="absolute top-3 right-3 text-ink-muted hover:text-ink-primary">
          <X className="w-4 h-4" />
        </button>
        <div className="text-[11px] font-bold uppercase tracking-wide text-brand mb-1">
          Step {index + 1} of {STEPS.length}
        </div>
        <h2 className="text-base font-bold text-ink-primary mb-1.5 pr-5">{step.title}</h2>
        <p className="text-sm text-ink-secondary leading-relaxed">{step.body}</p>
        <div className="flex items-center gap-2 mt-4">
          {index < STEPS.length - 1 ? (
            <button onClick={finish} className="text-xs font-semibold text-ink-muted hover:text-ink-primary">
              Skip tour
            </button>
          ) : null}
          <div className="flex-1" />
          {index > 0 && (
            <button onClick={back} className="h-9 px-3 rounded-lg border border-line text-sm font-semibold text-ink-secondary flex items-center gap-1 hover:bg-page-bg">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button autoFocus onClick={next} className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-semibold flex items-center gap-1 hover:bg-brand-hover">
            {index === STEPS.length - 1 ? "Finish" : index === 0 ? "Start tour" : "Next"}
            {index < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1 justify-center mt-3.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-brand" : "w-1.5 bg-line"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
