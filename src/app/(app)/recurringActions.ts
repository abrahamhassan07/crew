"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { dbError } from "@/lib/errors";
import { isIsoDate } from "@/lib/audit/engine";
import type { ServiceFrequency, Skill } from "@/lib/supabase/types";
import type { ActionResult } from "./actions";

export interface RecurringServiceInput {
  title: string;
  jobType: Skill;
  frequency: ServiceFrequency;
  intervalDays: number | null;
  anchorDate: string;
}

function validate(input: RecurringServiceInput): string | null {
  if (!["weekly", "fortnightly", "monthly", "custom"].includes(input.frequency)) return "Choose how often the service happens.";
  if (input.frequency === "custom" && !(Number.isInteger(input.intervalDays) && (input.intervalDays as number) >= 1 && (input.intervalDays as number) <= 365)) return "Enter a number of days between 1 and 365.";
  if (!isIsoDate(input.anchorDate)) return "Enter the date of the first visit.";
  if (input.title.length > 100) return "Keep the service name under 100 characters.";
  return null;
}

async function adminOrgId() {
  const viewer = await getViewer();
  return viewer.profile.role === "admin" ? viewer.orgId : null;
}

export async function addRecurringService(clientId: string, input: RecurringServiceInput): Promise<ActionResult> {
  const orgId = await adminOrgId();
  if (!orgId) return { ok: false, error: "Only owners and admins can do that." };
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_services").insert({
    org_id: orgId,
    client_id: clientId,
    title: input.title.trim() || "Regular service",
    job_type: input.jobType,
    frequency: input.frequency,
    interval_days: input.frequency === "custom" ? input.intervalDays : null,
    anchor_date: input.anchorDate,
  });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function updateRecurringService(id: string, patch: { active?: boolean; pausedUntil?: string | null }): Promise<ActionResult> {
  const orgId = await adminOrgId();
  if (!orgId) return { ok: false, error: "Only owners and admins can do that." };
  if (patch.pausedUntil && !isIsoDate(patch.pausedUntil)) return { ok: false, error: "Enter a valid date." };
  const update: { active?: boolean; paused_until?: string | null } = {};
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.pausedUntil !== undefined) update.paused_until = patch.pausedUntil;
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_services").update(update).eq("id", id).select("client_id").single();
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(`/clients/${data.client_id}`);
  return { ok: true };
}

export async function deleteRecurringService(id: string): Promise<ActionResult> {
  const orgId = await adminOrgId();
  if (!orgId) return { ok: false, error: "Only owners and admins can do that." };
  const supabase = await createClient();
  const { data } = await supabase.from("recurring_services").select("client_id").eq("id", id).single();
  const { error } = await supabase.from("recurring_services").delete().eq("id", id);
  if (error) return { ok: false, error: dbError(error) };
  if (data) revalidatePath(`/clients/${data.client_id}`);
  return { ok: true };
}
