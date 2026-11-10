"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { dbError } from "@/lib/errors";
import { aiAllowed } from "@/lib/billing";
import { checkAiAccess } from "@/lib/ai/access";
import { runAuditForOrg } from "@/lib/audit/run";
import type { ActionResult } from "./actions";

/** Owner/admin switches for the AI features. Allowed only when the plan includes them (checked again on every AI request). */
export async function saveAiSettings(input: { auditor: boolean; voiceQuote: boolean; voiceInvoice: boolean }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Only owners and admins can change AI settings." };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();
  if (!aiAllowed(org)) return { ok: false, error: "AI features are included with the Team and Business plans. Upgrade under Subscription to use them." };
  const { error } = await supabase
    .from("organizations")
    .update({ ai_auditor_enabled: input.auditor, ai_voice_quote_enabled: input.voiceQuote, ai_voice_invoice_enabled: input.voiceInvoice })
    .eq("id", viewer.orgId);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Run Audit Now": owners/admins only. The report itself needs no AI; the AI summary is added when the allowance lets it. */
export async function runAuditNow(): Promise<ActionResult & { auditId?: string }> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Only owners and admins can run an audit." };
  const access = await checkAiAccess(viewer.orgId, viewer.userId, "auditor_summary", { skipRate: true });
  if (!access.ok && (access.code === "plan" || access.code === "disabled")) return { ok: false, error: access.message };
  // Over the monthly allowance: the report still runs, with the plain summary and no AI call.
  const res = await runAuditForOrg(viewer.orgId, { trigger: "manual", userId: viewer.userId, allowAi: access.ok });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/reports/service-health");
  revalidatePath("/dashboard");
  return { ok: true, auditId: res.auditId };
}
