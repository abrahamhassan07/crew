import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { NOTIFICATION_KINDS, reminderLimit } from "@/lib/billing";
import { fmtTime12, parseISO, todayISO } from "@/lib/design";
import type { Organization } from "@/lib/supabase/types";

export interface JobSnapshot {
  id: string;
  num: string;
  client_name: string;
  address: string;
  job_date: string | null;
  start_time: string | null;
  duration_minutes: number;
  assigned_staff_id: string | null;
  status: string;
  notes: string;
}

export const JOB_SNAPSHOT_COLUMNS = "id, num, client_name, address, job_date, start_time, duration_minutes, assigned_staff_id, status, notes";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.crewandgrounds.com";

export const dateLabel = (iso: string) => parseISO(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
const timeLabel = (t: string | null) => (t ? fmtTime12(t.slice(0, 5)) : "time to be confirmed");
const active = (j: JobSnapshot | null): j is JobSnapshot =>
  !!j && !!j.job_date && j.job_date >= todayISO() && !["cancelled", "completed"].includes(j.status);

function jobLines(j: JobSnapshot): string {
  const mins = j.duration_minutes;
  const length = mins % 60 === 0 ? `${mins / 60}h` : `${(mins / 60).toFixed(1)}h`;
  return [
    `Job: ${j.num}`,
    `Client: ${j.client_name}`,
    `Address: ${j.address}`,
    `When: ${j.job_date ? `${dateLabel(j.job_date)}, ${timeLabel(j.start_time)}` : "not scheduled yet"} (${length})`,
    ...(j.notes.trim() ? [`Notes: ${j.notes.trim()}`] : []),
  ].join("\n");
}

/** Sends one email to a staff member, honouring the monthly notification cap. Returns true if sent. */
async function sendToStaff(org: Organization, staff: { name: string; email: string }, subject: string, text: string): Promise<boolean> {
  const to = staff.email?.trim();
  if (!to || !org.email?.trim()) return false;
  const admin = createAdminClient();

  const cap = reminderLimit(org);
  if (cap !== null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("kind", NOTIFICATION_KINDS).gte("created_at", monthStart);
    if ((count ?? 0) >= cap) return false;
  }

  const first = staff.name.split(" ")[0] || "there";
  const result = await sendEmail({
    to,
    subject,
    text: `Hi ${first},\n\n${text}\n\n${org.name}\n`,
    fromName: org.name,
    replyTo: org.email,
  });
  if (!result.ok) return false;
  await admin.from("email_log").insert({ org_id: org.id, user_id: null, kind: "staff" });
  return true;
}

/**
 * Tells the affected staff when a job is assigned to them, moved, cancelled or taken off them.
 * `before` is null for a new job, `after` is null for a deleted one. Never throws: a failed
 * notification must not undo or fail the change that triggered it.
 */
export async function notifyJobChange(orgId: string, before: JobSnapshot | null, after: JobSnapshot | null, actorStaffId: string | null, note?: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
    if (!org?.staff_notifications_enabled) return;

    const staffIds = [before?.assigned_staff_id, after?.assigned_staff_id].filter((x): x is string => !!x);
    if (!staffIds.length) return;
    const { data: staff } = await admin.from("staff").select("id, name, email, active").in("id", staffIds);
    const byId = new Map((staff ?? []).map((s) => [s.id, s]));
    const link = (j: JobSnapshot) => `\nOpen it: ${SITE}/jobs/${j.id}`;

    // Newly assigned to this person (new job, or reassigned to them).
    if (active(after) && after.assigned_staff_id && after.assigned_staff_id !== before?.assigned_staff_id) {
      const person = byId.get(after.assigned_staff_id);
      if (person?.active && person.id !== actorStaffId) {
        await sendToStaff(org, person, `New job assigned: ${dateLabel(after.job_date!)}, ${timeLabel(after.start_time)}`, `You've been assigned a job${note ? ` (${note})` : ""}.\n\n${jobLines(after)}\n${link(after)}`);
      }
    }

    // Taken off this person (reassigned away, deleted, or cancelled).
    const prev = before?.assigned_staff_id ? byId.get(before.assigned_staff_id) : undefined;
    if (active(before) && prev?.active && prev.id !== actorStaffId) {
      const reassigned = !!after && after.assigned_staff_id !== before.assigned_staff_id;
      const cancelled = !!after && after.assigned_staff_id === before.assigned_staff_id && after.status === "cancelled";
      if (!after || reassigned) {
        await sendToStaff(org, prev, `Job removed: ${dateLabel(before.job_date!)}`, `You're no longer assigned to this job.\n\n${jobLines(before)}`);
      } else if (cancelled) {
        await sendToStaff(org, prev, `Job cancelled: ${dateLabel(before.job_date!)}`, `This job has been cancelled.\n\n${jobLines(before)}`);
      } else if (active(after) && (after.job_date !== before.job_date || after.start_time !== before.start_time)) {
        await sendToStaff(org, prev, `Job rescheduled: now ${dateLabel(after.job_date!)}, ${timeLabel(after.start_time)}`, `A job you're assigned to has moved.\n\nWas: ${dateLabel(before.job_date!)}, ${timeLabel(before.start_time)}\n\n${jobLines(after)}\n${link(after)}`);
      }
    }
  } catch (e) {
    console.error("Staff notification failed", e);
  }
}
