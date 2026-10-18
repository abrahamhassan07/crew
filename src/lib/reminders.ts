import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getBillingState, NOTIFICATION_KINDS, reminderLimit } from "@/lib/billing";
import { daysFromToday, fmtTime12, parseISO } from "@/lib/design";
import { dateLabel } from "@/lib/staffNotify";
import { renderTemplate, templateFor } from "@/lib/emailTemplates";
import type { Organization } from "@/lib/supabase/types";

export interface ReminderSummary {
  date: string;
  businesses: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  details: string[];
}

const SERVICE_LABEL: Record<string, string> = { cleaning: "Cleaning", gardening: "Gardening", both: "Cleaning and gardening" };

/**
 * Emails customers about jobs scheduled for tomorrow (in the business timezone), for every
 * business that has reminders switched on. Safe to run repeatedly: a job is only reminded once
 * per scheduled date. With dryRun, nothing is sent or recorded.
 */
export async function sendDueReminders(dryRun = false): Promise<ReminderSummary> {
  const admin = createAdminClient();
  const date = daysFromToday(1);
  const summary: ReminderSummary = { date, businesses: 0, sent: 0, skipped: 0, failed: 0, dryRun, details: [] };

  const { data: orgs } = await admin.from("organizations").select("*").or("reminders_enabled.eq.true,staff_notifications_enabled.eq.true,review_requests_enabled.eq.true");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  for (const org of (orgs ?? []) as Organization[]) {
    summary.businesses++;
    if (!org.email?.trim()) {
      summary.details.push(`${org.name}: no business email set, skipped`);
      continue;
    }
    if (getBillingState(org).kind === "expired") {
      summary.details.push(`${org.name}: subscription expired, skipped`);
      continue;
    }
    if (org.reminders_enabled) await remindCustomers(admin, org, date, monthStart, dryRun, summary);
    if (org.staff_notifications_enabled) await sendStaffDigests(admin, org, date, monthStart, dryRun, summary);
    if (org.review_requests_enabled && org.review_link?.trim()) await requestReviews(admin, org, monthStart, dryRun, summary);
  }
  return summary;
}

type Admin = ReturnType<typeof createAdminClient>;

/** How long to wait before asking the same client for another review. */
const REVIEW_COOLDOWN_DAYS = 90;
/** Completed jobs this many days back are still picked up (covers a missed or late run). */
const REVIEW_LOOKBACK_DAYS = 3;

/**
 * Asks clients for a Google review after a job is marked completed. Runs with the morning job, so the
 * email arrives the morning after the visit. One email per client per run, never twice for the same
 * job, and not again for that client within REVIEW_COOLDOWN_DAYS.
 */
async function requestReviews(admin: Admin, org: Organization, monthStart: string, dryRun: boolean, summary: ReminderSummary) {
  const today = daysFromToday(0);
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, job_type, job_date, client_id")
    .eq("org_id", org.id)
    .eq("status", "completed")
    .is("review_requested_at", null)
    .not("client_id", "is", null)
    .gte("job_date", daysFromToday(-REVIEW_LOOKBACK_DAYS))
    .lte("job_date", today);
  if (!jobs?.length) return;

  const clientIds = [...new Set(jobs.map((j) => j.client_id as string))];
  const { data: clients } = await admin.from("clients").select("id, name, email, review_requested_at").in("id", clientIds);

  const cap = reminderLimit(org);
  let used = 0;
  if (cap !== null) {
    const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("kind", NOTIFICATION_KINDS).gte("created_at", monthStart);
    used = count ?? 0;
  }

  const template = templateFor(org, "review");
  const signature = [org.name, org.phone, org.email].filter(Boolean).join("\n");
  const cooldownStart = Date.now() - REVIEW_COOLDOWN_DAYS * 864e5;

  for (const client of clients ?? []) {
    const to = client.email?.trim();
    if (!to) {
      summary.skipped++;
      continue;
    }
    if (client.review_requested_at && new Date(client.review_requested_at).getTime() > cooldownStart) {
      summary.skipped++;
      summary.details.push(`${org.name}: ${client.name} was asked for a review recently, skipped`);
      continue;
    }
    if (cap !== null && used >= cap) {
      summary.skipped++;
      summary.details.push(`${org.name}: monthly notification limit (${cap}) reached`);
      break;
    }
    const theirJobs = jobs.filter((j) => j.client_id === client.id);
    if (dryRun) {
      summary.sent++;
      summary.details.push(`${org.name}: would ask ${client.name} <${to}> for a review`);
      continue;
    }
    const job = theirJobs[0];
    const values: Record<string, string> = {
      first_name: client.name.split(" ")[0] || "there",
      business: org.name,
      review_link: org.review_link!.trim(),
      service: job.title || SERVICE_LABEL[job.job_type] || "",
      signature,
    };
    const subject = renderTemplate(template.subject, values);
    const result = await sendEmail({
      to,
      subject: subject.charAt(0).toUpperCase() + subject.slice(1),
      text: `${renderTemplate(template.body, values)}\n`,
      fromName: org.name,
      replyTo: org.email,
    });
    if (!result.ok) {
      summary.failed++;
      summary.details.push(`${org.name}: ${result.error}`);
      continue;
    }
    const at = new Date().toISOString();
    await admin.from("jobs").update({ review_requested_at: at }).in("id", theirJobs.map((j) => j.id));
    await admin.from("clients").update({ review_requested_at: at }).eq("id", client.id);
    await admin.from("email_log").insert({ org_id: org.id, user_id: null, kind: "review" });
    used++;
    summary.sent++;
  }
}

async function remindCustomers(admin: Admin, org: Organization, date: string, monthStart: string, dryRun: boolean, summary: ReminderSummary) {
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, job_type, address, start_time, job_date, client_id, reminder_sent_for")
    .eq("org_id", org.id)
    .eq("job_date", date)
    .eq("status", "scheduled")
    .not("client_id", "is", null);
  const due = (jobs ?? []).filter((j) => j.reminder_sent_for !== date);
  if (!due.length) return;

  const { data: clients } = await admin.from("clients").select("id, name, email").in("id", [...new Set(due.map((j) => j.client_id as string))]);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  const cap = reminderLimit(org);
  let used = 0;
  if (cap !== null) {
    const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("kind", NOTIFICATION_KINDS).gte("created_at", monthStart);
    used = count ?? 0;
  }

  const template = templateFor(org, "reminder");
  const when = parseISO(date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const signature = [org.name, org.phone, org.email].filter(Boolean).join("\n");

  for (const job of due) {
    const client = clientById.get(job.client_id as string);
    const to = client?.email?.trim();
    if (!client || !to) {
      summary.skipped++;
      continue;
    }
    if (cap !== null && used >= cap) {
      summary.skipped++;
      summary.details.push(`${org.name}: monthly reminder limit (${cap}) reached`);
      break;
    }
    if (dryRun) {
      summary.sent++;
      summary.details.push(`${org.name}: would remind ${client.name} <${to}>`);
      continue;
    }

    const values: Record<string, string> = {
      first_name: client.name.split(" ")[0] || "there",
      date: when,
      time: job.start_time ? fmtTime12(job.start_time.slice(0, 5)) : "your scheduled time",
      address: job.address,
      service: job.title || SERVICE_LABEL[job.job_type] || "",
      business: org.name,
      signature,
    };
    const subject = renderTemplate(template.subject, values);
    const result = await sendEmail({
      to,
      subject: subject.charAt(0).toUpperCase() + subject.slice(1),
      text: `${renderTemplate(template.body, values)}\n`,
      fromName: org.name,
      replyTo: org.email,
    });
    if (!result.ok) {
      summary.failed++;
      summary.details.push(`${org.name}: ${result.error}`);
      continue;
    }
    await admin.from("jobs").update({ reminder_sent_for: date }).eq("id", job.id);
    await admin.from("email_log").insert({ org_id: org.id, user_id: null, kind: "reminder" });
    used++;
    summary.sent++;
  }
}

async function sendStaffDigests(admin: Admin, org: Organization, date: string, monthStart: string, dryRun: boolean, summary: ReminderSummary) {
  const { data: jobs } = await admin
    .from("jobs")
    .select("num, client_name, address, start_time, duration_minutes, notes, assigned_staff_id")
    .eq("org_id", org.id)
    .eq("job_date", date)
    .eq("status", "scheduled")
    .not("assigned_staff_id", "is", null)
    .order("start_time");
  if (!jobs?.length) return;

  const { data: staff } = await admin.from("staff").select("id, name, email, active, digest_sent_for").in("id", [...new Set(jobs.map((j) => j.assigned_staff_id as string))]);

  const cap = reminderLimit(org);
  let used = 0;
  if (cap !== null) {
    const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("kind", NOTIFICATION_KINDS).gte("created_at", monthStart);
    used = count ?? 0;
  }

  for (const person of staff ?? []) {
    const to = person.email?.trim();
    if (!person.active || !to || person.digest_sent_for === date) continue;
    if (cap !== null && used >= cap) {
      summary.skipped++;
      summary.details.push(`${org.name}: monthly notification limit (${cap}) reached`);
      break;
    }
    const mine = jobs.filter((j) => j.assigned_staff_id === person.id);
    if (dryRun) {
      summary.sent++;
      summary.details.push(`${org.name}: would send ${person.name} their ${mine.length} job(s) for tomorrow`);
      continue;
    }
    const lines = mine.map((j) => {
      const mins = j.duration_minutes;
      const length = mins % 60 === 0 ? `${mins / 60}h` : `${(mins / 60).toFixed(1)}h`;
      return `${j.start_time ? fmtTime12(j.start_time.slice(0, 5)) : "Time TBC"} (${length})  ${j.client_name}\n${j.address}${j.notes.trim() ? `\nNotes: ${j.notes.trim()}` : ""}`;
    });
    const result = await sendEmail({
      to,
      subject: `Your schedule for ${dateLabel(date)}: ${mine.length} job${mine.length === 1 ? "" : "s"}`,
      text: `Hi ${person.name.split(" ")[0] || "there"},\n\nHere's what you have on tomorrow, ${dateLabel(date)}:\n\n${lines.join("\n\n")}\n\n${org.name}\n`,
      fromName: org.name,
      replyTo: org.email,
    });
    if (!result.ok) {
      summary.failed++;
      summary.details.push(`${org.name}: ${result.error}`);
      continue;
    }
    await admin.from("staff").update({ digest_sent_for: date }).eq("id", person.id);
    await admin.from("email_log").insert({ org_id: org.id, user_id: null, kind: "staff" });
    used++;
    summary.sent++;
  }
}
