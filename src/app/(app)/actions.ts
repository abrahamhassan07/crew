"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth";
import { addDays, fmtISO, parseISO, STAFF_HUES } from "@/lib/design";
import type { JobStatus, Recurrence, Skill } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface JobInput {
  client: string;
  address: string;
  type: Skill;
  status: JobStatus;
  date: string;
  startTime: string;
  duration: number;
  price: number | null;
  staffId: string | null;
  notes: string;
  repeat: Recurrence;
}

function validateJobInput(input: JobInput): string | null {
  if (!input.client.trim()) return "Client name is required.";
  if (!input.address.trim()) return "Address is required.";
  if (!input.date) return "Date is required.";
  if (!input.startTime) return "Start time is required.";
  return null;
}

export async function createJob(input: JobInput): Promise<ActionResult> {
  const err = validateJobInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const seriesId = input.repeat !== "none" ? randomUUID() : null;

  const base = {
    client_name: input.client.trim(),
    address: input.address.trim(),
    job_type: input.type,
    status: input.status,
    start_time: input.startTime,
    duration_minutes: input.duration,
    price: input.price,
    assigned_staff_id: input.staffId,
    notes: input.notes,
    recurrence: input.repeat,
    series_id: seriesId,
  };

  const rows = [{ ...base, job_date: input.date }];
  if (input.repeat !== "none") {
    const stepDays = input.repeat === "weekly" ? 7 : input.repeat === "fortnightly" ? 14 : 30;
    let d = parseISO(input.date);
    for (let i = 1; i <= 6; i++) {
      d = addDays(d, stepDays);
      rows.push({ ...base, job_date: fmtISO(d), status: "scheduled" });
    }
  }

  const { error } = await supabase.from("jobs").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJob(id: string, input: JobInput): Promise<ActionResult> {
  const err = validateJobInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      client_name: input.client.trim(),
      address: input.address.trim(),
      job_type: input.type,
      status: input.status,
      job_date: input.date,
      start_time: input.startTime,
      duration_minutes: input.duration,
      price: input.price,
      assigned_staff_id: input.staffId,
      notes: input.notes,
      recurrence: input.repeat,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteJob(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface StaffInput {
  name: string;
  phone: string;
  email: string;
  skill: Skill;
}

export async function inviteStaff(input: StaffInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!input.email.trim()) return { ok: false, error: "Email is required." };

  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true });
  const colorHue = STAFF_HUES[(count ?? 0) % STAFF_HUES.length];

  const { data: staffRow, error } = await supabase
    .from("staff")
    .insert({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim(),
      skill: input.skill,
      color_hue: colorHue,
      active: true,
    })
    .select("id")
    .single();

  if (error || !staffRow) return { ok: false, error: error?.message ?? "Could not create staff record." };

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), {
    data: { app_role: "staff", staff_id: staffRow.id },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/set-password`,
  });

  if (inviteError) {
    return { ok: false, error: `Staff record created, but the invite email failed: ${inviteError.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface StaffUpdateInput {
  name: string;
  phone: string;
  email: string;
  skill: Skill;
  active: boolean;
}

export async function updateStaff(id: string, input: StaffUpdateInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim(),
      skill: input.skill,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
