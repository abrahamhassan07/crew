import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiAllowed, aiMonthlyLimit, getBillingState } from "@/lib/billing";
import { monthStartISO } from "@/lib/usage";
import { estimateCostUsd } from "@/lib/ai/providers";
import type { AiFeature, Organization } from "@/lib/supabase/types";

// One place that decides whether an AI request may run: the plan, the business's own switch, the monthly ceiling and a
// rate limit. Every AI route and scheduled job calls this on the server; the interface hiding a button is not security.

const FLAG: Record<AiFeature, keyof Pick<Organization, "ai_auditor_enabled" | "ai_voice_quote_enabled" | "ai_voice_invoice_enabled">> = {
  auditor_summary: "ai_auditor_enabled",
  voice_quote: "ai_voice_quote_enabled",
  voice_invoice: "ai_voice_invoice_enabled",
};

export const FEATURE_LABEL: Record<AiFeature, string> = {
  auditor_summary: "Client Service Auditor",
  voice_quote: "Voice-to-Quote",
  voice_invoice: "Voice-to-Invoice",
};

// Per-person and per-business bursts, to stop a stuck button or a loop from running up a bill.
const RATE_PER_USER_PER_MINUTE = 5;
const RATE_PER_ORG_PER_HOUR = 60;

export type AiAccess =
  | { ok: true; org: Organization }
  | { ok: false; code: "plan" | "disabled" | "limit" | "rate"; message: string; upgrade: boolean };

export async function aiUsageThisMonth(orgId: string): Promise<number> {
  const { count } = await createAdminClient().from("ai_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "ok").gte("created_at", monthStartISO());
  return count ?? 0;
}

/**
 * Checks plan, switch, monthly ceiling and rate limit for one AI request. `skipSwitch` is for the owner's own
 * settings screen; `skipRate` for scheduled jobs.
 */
export async function checkAiAccess(orgId: string, userId: string | null, feature: AiFeature, opts: { skipRate?: boolean } = {}): Promise<AiAccess> {
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (!org) return { ok: false, code: "plan", message: "Business not found.", upgrade: false };

  if (!aiAllowed(org)) {
    return { ok: false, code: "plan", message: "AI features are included with the Team and Business plans. Upgrade under Subscription to use them.", upgrade: true };
  }
  if (!org[FLAG[feature]]) {
    return { ok: false, code: "disabled", message: `${FEATURE_LABEL[feature]} is switched off. An owner can turn it on under Settings > AI Features.`, upgrade: false };
  }
  const ceiling = aiMonthlyLimit(org);
  if (ceiling !== null) {
    const used = await aiUsageThisMonth(orgId);
    if (used >= ceiling) {
      const onTrial = getBillingState(org).kind === "trial";
      return {
        ok: false,
        code: "limit",
        message: onTrial
          ? `You've used your ${ceiling} free AI uses this month. Upgrade to the Team plan to keep using AI features.`
          : `You've reached this month's AI limit (${ceiling}). Contact support if you need more.`,
        upgrade: onTrial,
      };
    }
  }
  if (!opts.skipRate) {
    const now = Date.now();
    const [{ count: perUser }, { count: perOrg }] = await Promise.all([
      userId
        ? admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("user_id", userId).neq("status", "blocked").gte("created_at", new Date(now - 60_000).toISOString())
        : Promise.resolve({ count: 0 }),
      admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "blocked").gte("created_at", new Date(now - 3_600_000).toISOString()),
    ]);
    if ((perUser ?? 0) >= RATE_PER_USER_PER_MINUTE || (perOrg ?? 0) >= RATE_PER_ORG_PER_HOUR) {
      return { ok: false, code: "rate", message: "That's a lot of requests in a short time. Please wait a minute and try again.", upgrade: false };
    }
  }
  return { ok: true, org };
}

/** Records an AI call (or a refused one) in the usage log. Never throws: logging must not break the feature. */
export async function logAiRequest(entry: {
  orgId: string;
  userId: string | null;
  feature: AiFeature;
  status: "ok" | "error" | "blocked";
  provider?: string;
  model?: string;
  audioSeconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  detail?: string;
}): Promise<void> {
  try {
    await createAdminClient().from("ai_requests").insert({
      org_id: entry.orgId,
      user_id: entry.userId,
      feature: entry.feature,
      status: entry.status,
      provider: entry.provider ?? "",
      model: entry.model ?? "",
      audio_seconds: entry.audioSeconds ?? null,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      cost_usd_est: entry.status === "ok" ? estimateCostUsd({ audioSeconds: entry.audioSeconds, inputTokens: entry.inputTokens, outputTokens: entry.outputTokens }) : null,
      detail: entry.detail?.slice(0, 200) ?? null,
    });
  } catch (e) {
    console.error("[ai] couldn't log request", e instanceof Error ? e.message : e);
  }
}
