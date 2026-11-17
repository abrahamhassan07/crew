/**
 * The parts of sending phone pushes that don't touch the database or the network (unit-tested).
 * Pushes go through Expo's push service (free), which passes them on to Apple and Google.
 */

/** What a tap on the notification opens in the app. */
export type PushTarget =
  | { kind: "job"; jobId: string }
  | { kind: "today"; date: string }
  | { kind: "web"; path: string };

export interface PushNote {
  title: string;
  body: string;
  target: PushTarget;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: PushTarget;
  sound: "default";
  priority: "high";
}

export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Expo accepts up to 100 messages per request. */
export const EXPO_BATCH = 100;

const TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
export const isExpoToken = (t: unknown): t is string => typeof t === "string" && t.length <= 255 && TOKEN_RE.test(t);

/** Lock screens show the text, so keep it short and never include prices for staff (callers decide the text). */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Only paths on our own site may be opened from a notification. */
export function safeTarget(t: PushTarget): PushTarget | null {
  if (t.kind === "job") return /^[0-9a-f-]{36}$/i.test(t.jobId) ? t : null;
  if (t.kind === "today") return /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t : null;
  return /^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/.test(t.path) ? t : null;
}

export function buildMessages(tokens: string[], note: PushNote): ExpoMessage[] {
  const target = safeTarget(note.target);
  if (!target) return [];
  const unique = [...new Set(tokens.filter(isExpoToken))];
  return unique.map((to) => ({ to, title: clip(note.title, 80), body: clip(note.body, 180), data: target, sound: "default", priority: "high" }));
}

export function chunk<T>(items: T[], size = EXPO_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Tokens Expo says are no longer valid (app deleted or notifications reset), which should be forgotten. Tickets come back in message order. */
export function deadTokens(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t?.status === "error" && t.details?.error === "DeviceNotRegistered" && messages[i]) dead.push(messages[i].to);
  });
  return dead;
}

/** "8:00 AM" from "08:00:00". */
export function time12(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The evening "tomorrow" push for one person. `jobs` are that person's jobs for the day, any order. */
export function tomorrowNote(date: string, jobs: { start_time: string | null; client_name: string }[]): PushNote | null {
  if (!jobs.length) return null;
  const sorted = [...jobs].sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  const first = sorted[0];
  const n = jobs.length;
  const at = time12(first.start_time);
  return {
    title: n === 1 ? "1 job tomorrow" : `${n} jobs tomorrow`,
    body: at ? `First at ${at}: ${first.client_name}` : `First: ${first.client_name}`,
    target: { kind: "today", date },
  };
}
