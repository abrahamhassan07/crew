"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { dbError } from "@/lib/errors";
import { aiAllowed } from "@/lib/billing";
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
