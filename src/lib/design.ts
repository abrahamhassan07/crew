import type { Job, JobStatus, Skill, Staff } from "@/lib/supabase/types";

// Colors reuse the same info/violet/ok/bad families as ui/StatusBadge.tsx
// (via the bare CSS var aliases in globals.css) so Schedule/Jobs chips match
// the status pills used everywhere else in the app.
export const STATUS_META: Record<JobStatus, { label: string; hex: string; tint: string }> = {
  scheduled: { label: "Scheduled", hex: "var(--info-fg)", tint: "var(--info-bg)" },
  in_progress: { label: "In Progress", hex: "var(--violet-fg)", tint: "var(--violet-bg)" },
  completed: { label: "Completed", hex: "var(--ok-fg)", tint: "var(--ok-bg)" },
  cancelled: { label: "Cancelled", hex: "var(--bad-fg)", tint: "var(--bad-bg)" },
};

export const TYPE_META: Record<Skill, { label: string; hex: string; tint: string }> = {
  cleaning: { label: "Cleaning", hex: "var(--info-fg)", tint: "var(--info-bg)" },
  gardening: { label: "Gardening", hex: "var(--ok-fg)", tint: "var(--ok-bg)" },
  both: { label: "Cleaning + Gardening", hex: "var(--violet-fg)", tint: "var(--violet-bg)" },
};

export const STAFF_HUES = [15, 190, 280, 330, 100, 250, 40, 210, 300, 130];

export function staffColorHex(hue: number) {
  return `oklch(52% 0.13 ${hue})`;
}
export function staffTintHex(hue: number) {
  return `oklch(95% 0.04 ${hue})`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function pad2(n: number) {
  return n < 10 ? "0" + n : "" + n;
}
export function fmtISO(d: Date) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
export function parseISO(s: string) {
  const p = s.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}
export function fmtTime12(t: string | null | undefined) {
  if (!t) return "";
  const p = t.split(":").map(Number);
  const ampm = p[0] >= 12 ? "PM" : "AM";
  let h = p[0] % 12;
  if (h === 0) h = 12;
  return h + ":" + pad2(p[1]) + " " + ampm;
}
export function durationLabel(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + "h " + r + "m" : h + "h";
}
export function fmtDateLabel(iso: string | null | undefined) {
  if (!iso) return "Not scheduled";
  const d = parseISO(iso);
  return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
}
export function fmtMonthDay(d: Date) {
  return MONTHS[d.getMonth()] + " " + d.getDate();
}
export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
export function todayISO() {
  return fmtISO(new Date());
}
export { DAYS, MONTHS };

export interface EnrichedJob extends Job {
  staffName: string;
  staffColorHex: string;
  typeLabel: string;
  typeColorHex: string;
  typeTintHex: string;
  statusLabel: string;
  statusColorHex: string;
  statusTintHex: string;
  timeLabel: string;
  durationLabel: string;
  dateLabel: string;
  priceLabel: string;
}

const UNSCHEDULED_META = { label: "Unscheduled", hex: "var(--warn-fg)", tint: "var(--warn-bg)" };

export function enrichJob(job: Job, staffById: Map<string, Staff>): EnrichedJob {
  const staff = job.assigned_staff_id ? staffById.get(job.assigned_staff_id) : undefined;
  const typeMeta = TYPE_META[job.job_type] ?? TYPE_META.cleaning;
  const unscheduled = !job.job_date && job.status === "scheduled";
  const statusMeta = unscheduled ? UNSCHEDULED_META : (STATUS_META[job.status] ?? STATUS_META.scheduled);

  return {
    ...job,
    staffName: staff ? staff.name : "Unassigned",
    staffColorHex: staff ? staffColorHex(staff.color_hue) : "var(--color-ink-faintest)",
    typeLabel: typeMeta.label,
    typeColorHex: typeMeta.hex,
    typeTintHex: typeMeta.tint,
    statusLabel: statusMeta.label,
    statusColorHex: statusMeta.hex,
    statusTintHex: statusMeta.tint,
    timeLabel: job.start_time ? fmtTime12(job.start_time.slice(0, 5)) : "",
    durationLabel: durationLabel(job.duration_minutes),
    dateLabel: fmtDateLabel(job.job_date),
    priceLabel: job.price != null ? "$" + job.price : "—",
  };
}

export function buildStaffMap(staffList: Staff[]): Map<string, Staff> {
  return new Map(staffList.map((s) => [s.id, s]));
}
