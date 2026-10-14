import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getBillingState, reminderLimit } from "@/lib/billing";
import { daysFromToday, fmtTime12, parseISO } from "@/lib/design";
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

  const { data: orgs } = await admin.from("organizations").select("*").eq("reminders_enabled", true);
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

    const { data: jobs } = await admin
      .from("jobs")
      .select("id, title, job_type, address, start_time, job_date, client_id, reminder_sent_for")
      .eq("org_id", org.id)
      .eq("job_date", date)
      .eq("status", "scheduled")
      .not("client_id", "is", null);
    const due = (jobs ?? []).filter((j) => j.reminder_sent_for !== date);
    if (!due.length) continue;

    const { data: clients } = await admin.from("clients").select("id, name, email").in("id", [...new Set(due.map((j) => j.client_id as string))]);
    const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

    const cap = reminderLimit(org);
    let used = 0;
    if (cap !== null) {
      const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("kind", "reminder").gte("created_at", monthStart);
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
  return summary;
}
