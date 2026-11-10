import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiAllowed, getBillingState } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { checkAiAccess, logAiRequest } from "@/lib/ai/access";
import { AiProviderError, aiConfigured, writeText } from "@/lib/ai/providers";
import { addDaysIso, auditServices, localParts, scheduledAuditDue, type AuditJob, type AuditService, type AuditTotals } from "./engine.ts";
import { acceptAiSummary, aiFacts, plainSummary } from "./summary.ts";
import type { Organization } from "@/lib/supabase/types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.crewandgrounds.com").replace(/\/$/, "");

export type AuditRun = { ok: true; auditId: string; created: boolean; totals: AuditTotals } | { ok: false; error: string };

/** The summary text: AI-written when allowed and its numbers check out, otherwise the plain deterministic one. */
async function buildSummary(org: Organization, userId: string | null, totals: AuditTotals, items: Parameters<typeof aiFacts>[1], allowAi: boolean): Promise<{ text: string; source: "ai" | "plain" }> {
  const plain = { text: plainSummary(totals), source: "plain" as const };
  if (!allowAi || !aiConfigured().llm || totals.recurringClients === 0) return plain;
  const access = await checkAiAccess(org.id, userId, "auditor_summary", { skipRate: true });
  if (!access.ok) return plain;
  const { facts, allowedNumbers } = aiFacts(totals, items);
  try {
    const out = await writeText({
      system:
        "You write a short weekly summary of a small business's recurring-client service audit, for its owner. Use ONLY the facts provided. Never mention client names, never invent numbers, dates or history, and give no advice or promises. Plain Australian English, 2 to 4 short sentences, no lists, no markdown.",
      user: `Verified audit facts (JSON):\n${JSON.stringify(facts)}`,
      maxTokens: 300,
    });
    await logAiRequest({ orgId: org.id, userId, feature: "auditor_summary", status: "ok", provider: "anthropic", model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens });
    const accepted = acceptAiSummary(out.data, allowedNumbers);
    return accepted ? { text: accepted, source: "ai" } : plain;
  } catch (e) {
    await logAiRequest({ orgId: org.id, userId, feature: "auditor_summary", status: "error", provider: "anthropic", detail: e instanceof AiProviderError ? e.code : "unexpected" });
    return plain;
  }
}

async function loadInputs(orgId: string, today: string): Promise<{ services: AuditService[]; jobs: AuditJob[] }> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("recurring_services").select("*").eq("org_id", orgId).eq("active", true);
  const services = rows ?? [];
  const clientIds = [...new Set(services.map((s) => s.client_id))];
  const clients = new Map<string, { name: string; status: string }>();
  const jobs: AuditJob[] = [];
  for (let i = 0; i < clientIds.length; i += 25) {
    const chunk = clientIds.slice(i, i + 25);
    const [{ data: cs }, { data: js }] = await Promise.all([
      admin.from("clients").select("id, name, status").eq("org_id", orgId).in("id", chunk),
      admin.from("jobs").select("id, client_id, job_date, status, job_type, series_id").eq("org_id", orgId).in("client_id", chunk).gte("job_date", addDaysIso(today, -200)).lte("job_date", addDaysIso(today, 120)).limit(5000),
    ]);
    for (const c of cs ?? []) clients.set(c.id, { name: c.name, status: c.status });
    for (const j of js ?? []) jobs.push({ id: j.id, clientId: j.client_id, jobDate: j.job_date, status: j.status, jobType: j.job_type, seriesId: j.series_id });
  }
  return {
    jobs,
    services: services.flatMap((s) => {
      const c = clients.get(s.client_id);
      if (!c) return [];
      return [{ id: s.id, clientId: s.client_id, clientName: c.name, clientStatus: c.status, title: s.title, jobType: s.job_type, frequency: s.frequency, intervalDays: s.interval_days, anchorDate: s.anchor_date, pausedUntil: s.paused_until, active: s.active, seriesId: s.series_id }];
    }),
  };
}

/**
 * Runs the audit for one business and stores the report. Safe to retry: a scheduled run is keyed by the Melbourne
 * Sunday date, and the database allows only one report per business per period, so a duplicate call returns the
 * existing report and does nothing else (no second AI call, no second email).
 */
export async function runAuditForOrg(orgId: string, opts: { trigger: "scheduled" | "manual"; periodKey?: string; today?: string; userId?: string | null; allowAi: boolean; now?: Date }): Promise<AuditRun> {
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (!org) return { ok: false, error: "Business not found." };
  const today = opts.today ?? localParts(opts.now ?? new Date()).date;
  const periodKey = opts.trigger === "scheduled" ? (opts.periodKey ?? today) : null;

  const { services, jobs } = await loadInputs(orgId, today);
  const result = auditServices(services, jobs, today);

  const { data: audit, error } = await admin
    .from("service_audits")
    .insert({ org_id: orgId, period_key: periodKey, trigger: opts.trigger, as_of: today, totals: result.totals as unknown as Record<string, number>, created_by: opts.userId ?? null })
    .select("id")
    .single();
  if (error || !audit) {
    if (error?.code === "23505" && periodKey) {
      const { data: existing } = await admin.from("service_audits").select("id, totals").eq("org_id", orgId).eq("period_key", periodKey).single();
      if (existing) return { ok: true, auditId: existing.id, created: false, totals: existing.totals as unknown as AuditTotals };
    }
    console.error("[audit] couldn't save report", error?.code);
    return { ok: false, error: "Couldn't save the audit. Please try again." };
  }

  if (result.items.length) {
    const rows = result.items.map((i) => ({
      audit_id: audit.id, org_id: orgId, client_id: i.clientId, client_name: i.clientName, service_title: i.serviceTitle, frequency: i.frequency, interval_days: i.intervalDays,
      last_completed: i.lastCompleted, next_expected: i.nextExpected, next_scheduled: i.nextScheduled, days_overdue: i.daysOverdue, status: i.status, reason: i.reason,
    }));
    for (let i = 0; i < rows.length; i += 400) {
      const { error: itemsError } = await admin.from("service_audit_items").insert(rows.slice(i, i + 400));
      if (itemsError) {
        // Leave nothing half-saved: remove the report so the retry can run cleanly.
        await admin.from("service_audits").delete().eq("id", audit.id);
        console.error("[audit] couldn't save report rows", itemsError.code);
        return { ok: false, error: "Couldn't save the audit. Please try again." };
      }
    }
  }

  const summary = await buildSummary(org, opts.userId ?? null, result.totals, result.items, opts.allowAi);
  await admin.from("service_audits").update({ summary: summary.text, summary_source: summary.source }).eq("id", audit.id);

  if (opts.trigger === "scheduled" && org.email?.trim()) {
    const t = result.totals;
    const sent = await sendEmail({
      to: org.email.trim(),
      subject: `Your weekly client service report: ${t.overdue} overdue, ${t.notScheduled} to schedule`,
      text: `${summary.text}\n\nOverdue: ${t.overdue}\nNot scheduled: ${t.notScheduled}\nUpcoming: ${t.upcoming}\nOn track: ${t.onTrack}\nNeeds review: ${t.needsReview}\n\nSee the full report: ${SITE}/reports/service-health?audit=${audit.id}\n\nThis report is created automatically every Sunday morning. You can switch it off under Settings > AI features.\n`,
      fromName: "Crew & Grounds",
    });
    if (sent.ok) await admin.from("email_log").insert({ org_id: orgId, user_id: null, kind: "audit" });
  }
  return { ok: true, auditId: audit.id, created: true, totals: result.totals };
}

/**
 * Called by the scheduler (Vercel cron) on Saturday evening UTC and by the daily job. Does nothing unless it is
 * Sunday 7:00 am or later in Melbourne, then audits every eligible business once. Safe to call repeatedly.
 */
export async function runScheduledAudits(now: Date = new Date()): Promise<{ due: boolean; periodKey: string; businesses: number; created: number; skipped: number; failed: number }> {
  const slot = scheduledAuditDue(now);
  const summary = { due: slot.due, periodKey: slot.periodKey, businesses: 0, created: 0, skipped: 0, failed: 0 };
  if (!slot.due) return summary;
  const admin = createAdminClient();
  const { data: orgs } = await admin.from("organizations").select("*").eq("ai_auditor_enabled", true);
  for (const org of orgs ?? []) {
    summary.businesses++;
    if (!aiAllowed(org)) {
      summary.skipped++;
      continue;
    }
    try {
      // The trial gets the report without an AI-written summary (so it doesn't use up its small AI allowance).
      const allowAi = getBillingState(org).kind !== "trial";
      const r = await runAuditForOrg(org.id, { trigger: "scheduled", periodKey: slot.periodKey, today: slot.today, allowAi, now });
      if (!r.ok) summary.failed++;
      else if (r.created) summary.created++;
      else summary.skipped++;
    } catch (e) {
      summary.failed++;
      console.error("[audit] scheduled run failed", org.id, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}
