"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { billingEnforced, emailLimit, getBillingState, seatLimit } from "@/lib/billing";
import { formatAbn, isValidAbn, isValidEmail } from "@/lib/validate";
import { isPlatformAdmin, platformAdminEmails } from "@/lib/platform";
import { loadInvoiceDoc, loadQuoteDoc, type LoadedDoc } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";
import { after } from "next/server";
import { JOB_SNAPSHOT_COLUMNS, notifyJobChange, type JobSnapshot } from "@/lib/staffNotify";
import { DEFAULT_TEMPLATES, MAX_BODY, MAX_SUBJECT, renderTemplate, templateFor, type EmailDraft, type EmailKind } from "@/lib/emailTemplates";
import { addDays, fmtISO, parseISO, STAFF_HUES, todayISO } from "@/lib/design";
import { calcTotals } from "@/lib/gst";
import type { FeedbackKind, FeedbackStatus, CareProvider, ClientStatus, EquipmentStatus, GstMode, InvoiceStatus, JobRole, JobStatus, PricingType, QuoteStatus, Recurrence, RequestStatus, ServiceCategory, Skill } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateResult extends ActionResult {
  id?: string;
}

export interface JobInput {
  client: string;
  address: string;
  type: Skill;
  status: JobStatus;
  date: string | null;
  startTime: string | null;
  duration: number;
  price: number | null;
  staffId: string | null;
  notes: string;
  repeat: Recurrence;
  clientId?: string | null;
  /** Set when the job is for someone not in the client list yet: they're created as a Lead from client + address. */
  newClient?: { email: string; phone: string } | null;
}

function validateJobInput(input: JobInput): string | null {
  if (!input.client.trim()) return "Client name is required.";
  if (!input.address.trim()) return "Address is required.";
  if (Boolean(input.date) !== Boolean(input.startTime)) return "Set both a date and a start time, or leave the job unscheduled.";
  if (input.repeat !== "none" && !input.date) return "A date is required to repeat a job.";
  return null;
}

async function nextJobNum(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("jobs").select("num");
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 999);
  return `J-${max + 1}`;
}

export async function createJob(input: JobInput): Promise<ActionResult> {
  const err = validateJobInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const viewer = await getViewer();
  const seriesId = input.repeat !== "none" ? randomUUID() : null;

  let clientId = input.clientId ?? null;
  let createdClientId: string | null = null;
  if (!clientId && input.newClient) {
    const created = await createLeadClient(
      supabase,
      viewer.orgId,
      { name: input.client, address: input.address, email: input.newClient.email, phone: input.newClient.phone },
      "Job"
    );
    if ("error" in created) return { ok: false, error: created.error };
    clientId = created.id;
    createdClientId = created.id;
  }

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
    client_id: clientId,
    org_id: viewer.orgId,
  };

  const firstNum = await nextJobNum(supabase);
  const rows = [{ ...base, job_date: input.date, num: firstNum }];
  if (input.repeat !== "none" && input.date) {
    const stepDays = input.repeat === "weekly" ? 7 : input.repeat === "fortnightly" ? 14 : 30;
    let d = parseISO(input.date);
    const startNum = parseInt(firstNum.replace(/\D/g, ""), 10);
    for (let i = 1; i <= 6; i++) {
      d = addDays(d, stepDays);
      rows.push({ ...base, job_date: fmtISO(d), status: "scheduled", num: `J-${startNum + i}` });
    }
  }

  const { data: inserted, error } = await supabase.from("jobs").insert(rows).select(JOB_SNAPSHOT_COLUMNS);
  if (error) {
    if (createdClientId) await supabase.from("clients").delete().eq("id", createdClientId);
    return { ok: false, error: error.message };
  }
  // One email for the first job; a repeating job is described rather than sending seven emails.
  const first = (inserted as JobSnapshot[] | null)?.find((j) => j.num === firstNum);
  if (first) {
    const orgId = viewer.orgId;
    const staffId = viewer.staff?.id ?? null;
    const note = input.repeat !== "none" ? `repeats ${input.repeat}` : undefined;
    after(() => notifyJobChange(orgId, null, first, staffId, note));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJob(id: string, input: JobInput): Promise<ActionResult> {
  const err = validateJobInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: before } = await supabase.from("jobs").select(JOB_SNAPSHOT_COLUMNS).eq("id", id).single();
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
      client_id: input.clientId ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  if (before) {
    const snapshot: JobSnapshot = {
      ...(before as JobSnapshot),
      client_name: input.client.trim(),
      address: input.address.trim(),
      job_date: input.date,
      start_time: input.startTime,
      duration_minutes: input.duration,
      assigned_staff_id: input.staffId,
      status: input.status,
      notes: input.notes,
    };
    const orgId = viewer.orgId;
    const staffId = viewer.staff?.id ?? null;
    after(() => notifyJobChange(orgId, before as JobSnapshot, snapshot, staffId));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteJob(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: before } = await supabase.from("jobs").select(JOB_SNAPSHOT_COLUMNS).eq("id", id).single();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (before) {
    const orgId = viewer.orgId;
    const staffId = viewer.staff?.id ?? null;
    after(() => notifyJobChange(orgId, before as JobSnapshot, null, staffId));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: before } = status === "cancelled" ? await supabase.from("jobs").select(JOB_SNAPSHOT_COLUMNS).eq("id", id).single() : { data: null };
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (before) {
    const orgId = viewer.orgId;
    const staffId = viewer.staff?.id ?? null;
    after(() => notifyJobChange(orgId, before as JobSnapshot, { ...(before as JobSnapshot), status }, staffId));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJobChecklist(id: string, checklist: { t: string; done: boolean }[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ checklist }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJobNotes(id: string, notes: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ notes }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rescheduleJob(id: string, date: string, startTime?: string): Promise<ActionResult> {
  if (startTime !== undefined && !/^\d{2}:\d{2}$/.test(startTime)) return { ok: false, error: "Invalid start time." };
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: before } = await supabase.from("jobs").select(JOB_SNAPSHOT_COLUMNS).eq("id", id).single();
  const { error } = await supabase
    .from("jobs")
    .update(startTime ? { job_date: date, start_time: startTime } : { job_date: date })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (before) {
    const orgId = viewer.orgId;
    const staffId = viewer.staff?.id ?? null;
    const moved = { ...(before as JobSnapshot), job_date: date, ...(startTime ? { start_time: startTime } : {}) };
    after(() => notifyJobChange(orgId, before as JobSnapshot, moved, staffId));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface StaffInput {
  name: string;
  phone: string;
  email: string;
  skill: Skill;
  crewId: string | null;
  jobRole: JobRole;
}

/**
 * Seat limit for the business's plan (only applied once billing is enforced, so a
 * free pilot isn't capped). Returns an error message if adding another active user
 * would go over; `excludeStaffId` ignores a person who is already counted.
 */
async function seatError(supabase: Db, orgId: string, excludeStaffId?: string): Promise<string | null> {
  if (!billingEnforced()) return null;
  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  const limit = seatLimit(org);
  if (limit === null) return null;
  let q = supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true);
  if (excludeStaffId) q = q.neq("id", excludeStaffId);
  const { count } = await q;
  if ((count ?? 0) >= limit) return `Your plan covers ${limit} user${limit === 1 ? "" : "s"}. Change your team size under Subscription to add more.`;
  return null;
}

export async function inviteStaff(input: StaffInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!input.email.trim()) return { ok: false, error: "Email is required." };

  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const limitMessage = await seatError(supabase, viewer.orgId);
  if (limitMessage) return { ok: false, error: limitMessage };
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
      crew_id: input.crewId,
      job_role: input.jobRole,
      org_id: viewer.orgId,
    })
    .select("id")
    .single();

  if (error || !staffRow) return { ok: false, error: error?.message ?? "Could not create staff record." };

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), {
    data: { app_role: "staff", staff_id: staffRow.id, org_id: viewer.orgId },
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
  crewId: string | null;
  jobRole: JobRole;
  usualHours: string;
  availability: boolean[];
}

/** Seat check for switching someone from inactive to active (people who are already active are never blocked). */
async function reactivationError(supabase: Db, id: string, makeActive: boolean): Promise<string | null> {
  if (!makeActive) return null;
  const { data: current } = await supabase.from("staff").select("active, org_id").eq("id", id).single();
  if (!current || current.active) return null;
  return seatError(supabase, current.org_id, id);
}

export async function updateStaff(id: string, input: StaffUpdateInput): Promise<ActionResult> {
  const supabase = await createClient();
  const limitMessage = await reactivationError(supabase, id, input.active);
  if (limitMessage) return { ok: false, error: limitMessage };
  const { error } = await supabase
    .from("staff")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim(),
      skill: input.skill,
      active: input.active,
      crew_id: input.crewId,
      job_role: input.jobRole,
      usual_hours: input.usualHours.trim(),
      availability: input.availability,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface CrewInput {
  name: string;
  colorHex: string;
  tintHex: string;
  leadStaffId: string | null;
}

export async function addCrew(input: CrewInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Crew name is required." };
  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("crews").insert({
    name: input.name.trim(),
    color_hex: input.colorHex,
    tint_hex: input.tintHex,
    lead_staff_id: input.leadStaffId,
    org_id: viewer.orgId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCrew(id: string, input: CrewInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Crew name is required." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crews")
    .update({ name: input.name.trim(), color_hex: input.colorHex, tint_hex: input.tintHex, lead_staff_id: input.leadStaffId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCrew(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const limitMessage = await reactivationError(supabase, id, active);
  if (limitMessage) return { ok: false, error: limitMessage };
  const { error } = await supabase.from("staff").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: staffRow } = await supabase.from("staff").select("user_id").eq("id", id).single();

  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Revoke their login too — a staff member without a staff row otherwise
  // keeps an active account with no way to be assigned jobs again.
  if (staffRow?.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(staffRow.user_id);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface ClientInput {
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  jobType: Skill;
  careProvider: CareProvider | null;
  caseManager: string;
  hoursAllocated: number | null;
  status: ClientStatus;
  tags: string[];
  leadSource: string;
}

export interface PropertyInput {
  street: string;
  line2: string;
  suburb: string;
  state: string;
  postcode: string;
}

function validateClientInput(input: ClientInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  return null;
}

export async function addClient(input: ClientInput, properties: PropertyInput[]): Promise<CreateResult> {
  const err = validateClientInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: input.name.trim(),
      company: input.company.trim() || null,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      job_type: input.jobType,
      care_provider: input.careProvider,
      case_manager: input.caseManager.trim() || null,
      hours_allocated: input.hoursAllocated,
      status: input.status,
      tags: input.tags,
      lead_source: input.leadSource.trim() || null,
      org_id: viewer.orgId,
    })
    .select("id")
    .single();

  if (error || !client) return { ok: false, error: error?.message ?? "Could not create client." };

  const propRows = properties
    .filter((p) => p.street.trim() || p.suburb.trim())
    .map((p) => ({
      client_id: client.id,
      street: p.street.trim(),
      line2: p.line2.trim(),
      suburb: p.suburb.trim(),
      state: p.state,
      postcode: p.postcode.trim(),
      org_id: viewer.orgId,
    }));

  if (propRows.length) {
    const { error: propError } = await supabase.from("properties").insert(propRows);
    if (propError) return { ok: false, error: propError.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, id: client.id };
}

export interface ClientImportRow {
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  status: ClientStatus;
  tags: string[];
}

export interface ImportResult extends ActionResult {
  count?: number;
}

export async function importClients(rows: ClientImportRow[]): Promise<ImportResult> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Not authorized." };

  const valid = rows.filter((r) => r.name.trim());
  if (!valid.length) return { ok: false, error: "No valid rows to import — every row needs a Name." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(
    valid.map((r) => ({
      name: r.name.trim(),
      company: r.company.trim() || null,
      phone: r.phone.trim() || null,
      email: r.email.trim() || null,
      address: r.address.trim() || null,
      status: r.status,
      tags: r.tags,
      org_id: viewer.orgId,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, count: valid.length };
}

export async function bulkUpdateClientStatus(ids: string[], status: ClientStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ status }).in("id", ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkAddClientTag(ids: string[], tag: string): Promise<ActionResult> {
  const cleanTag = tag.trim();
  if (!cleanTag) return { ok: false, error: "Tag can't be empty." };

  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase.from("clients").select("id, tags").in("id", ids);
  if (fetchError) return { ok: false, error: fetchError.message };

  const updates = (rows ?? [])
    .filter((r) => !(r.tags ?? []).includes(cleanTag))
    .map((r) => supabase.from("clients").update({ tags: [...(r.tags ?? []), cleanTag] }).eq("id", r.id));

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkRemoveClientTag(ids: string[], tag: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase.from("clients").select("id, tags").in("id", ids);
  if (fetchError) return { ok: false, error: fetchError.message };

  const updates = (rows ?? [])
    .filter((r) => (r.tags ?? []).includes(tag))
    .map((r) => supabase.from("clients").update({ tags: (r.tags ?? []).filter((t: string) => t !== tag) }).eq("id", r.id));

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateClient(id: string, input: ClientInput): Promise<ActionResult> {
  const err = validateClientInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name.trim(),
      company: input.company.trim() || null,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      job_type: input.jobType,
      care_provider: input.careProvider,
      case_manager: input.caseManager.trim() || null,
      hours_allocated: input.hoursAllocated,
      status: input.status,
      tags: input.tags,
      lead_source: input.leadSource.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addProperty(clientId: string, input: PropertyInput): Promise<ActionResult> {
  if (!input.street.trim() || !input.suburb.trim()) return { ok: false, error: "Street and suburb are required." };
  if (!/^\d{4}$/.test(input.postcode.trim())) return { ok: false, error: "Postcode must be 4 digits." };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("properties").insert({
    client_id: clientId,
    street: input.street.trim(),
    line2: input.line2.trim(),
    suburb: input.suburb.trim(),
    state: input.state,
    postcode: input.postcode.trim(),
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeProperty(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface ClientContactInput {
  name: string;
  phone: string;
  email: string;
  role: string;
}

export async function addClientContact(clientId: string, input: ClientContactInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("client_contacts").insert({
    client_id: clientId,
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    role: input.role,
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeClientContact(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addClientNote(clientId: string, text: string): Promise<ActionResult> {
  if (!text.trim()) return { ok: false, error: "Note text is required." };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("client_notes").insert({
    client_id: clientId,
    text: text.trim(),
    staff_id: viewer.staff?.id ?? null,
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface ServiceInput {
  name: string;
  description: string;
  price: number;
  pricingType: PricingType;
  durationMinutes: number;
  defaultCrewId: string | null;
  category: ServiceCategory | null;
  active: boolean;
}

function validateServiceInput(input: ServiceInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!(input.price > 0)) return "Price must be greater than $0.";
  if (!(input.durationMinutes > 0)) return "Duration is required.";
  return null;
}

export async function addService(input: ServiceInput): Promise<ActionResult> {
  const err = validateServiceInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("services").insert({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    pricing_type: input.pricingType,
    duration_minutes: input.durationMinutes,
    default_crew_id: input.defaultCrewId,
    category: input.category,
    active: input.active,
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateService(id: string, input: ServiceInput): Promise<ActionResult> {
  const err = validateServiceInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      pricing_type: input.pricingType,
      duration_minutes: input.durationMinutes,
      default_crew_id: input.defaultCrewId,
      category: input.category,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface EquipmentInput {
  name: string;
  model: string;
  serial: string;
  crewId: string | null;
  status: EquipmentStatus;
  nextServiceDate: string | null;
}

function validateEquipmentInput(input: EquipmentInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  return null;
}

export async function addEquipment(input: EquipmentInput): Promise<ActionResult> {
  const err = validateEquipmentInput(input);
  if (err) return { ok: false, error: err };

  const viewer = await getViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").insert({
    name: input.name.trim(),
    model: input.model.trim(),
    serial: input.serial.trim(),
    crew_id: input.crewId,
    status: input.status,
    next_service_date: input.nextServiceDate,
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateEquipment(id: string, input: EquipmentInput): Promise<ActionResult> {
  const err = validateEquipmentInput(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment")
    .update({
      name: input.name.trim(),
      model: input.model.trim(),
      serial: input.serial.trim(),
      crew_id: input.crewId,
      status: input.status,
      next_service_date: input.nextServiceDate,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteEquipment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

async function nextRequestNum(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("requests").select("num");
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 500);
  return `R-${max + 1}`;
}

export interface RequestInput {
  clientId: string | null;
  name: string;
  phone: string;
  email: string;
  serviceId: string | null;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  preferredDate: string | null;
  description: string;
  source: string;
}

export async function addRequest(input: RequestInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Customer name is required." };
  if (!input.clientId && !input.street.trim()) return { ok: false, error: "Street address is required." };

  const supabase = await createClient();
  const viewer = await getViewer();
  const num = await nextRequestNum(supabase);
  const { error } = await supabase.from("requests").insert({
    num,
    client_id: input.clientId,
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    service_id: input.serviceId,
    street: input.street.trim(),
    suburb: input.suburb.trim(),
    state: input.state,
    postcode: input.postcode.trim(),
    preferred_date: input.preferredDate,
    description: input.description.trim() || "No description provided.",
    source: input.source,
    status: "New",
    org_id: viewer.orgId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("requests").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function convertRequestToJob(requestId: string, date: string, startTime: string): Promise<CreateResult> {
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: req, error: reqError } = await supabase.from("requests").select("*").eq("id", requestId).single();
  if (reqError || !req) return { ok: false, error: reqError?.message ?? "Request not found." };

  let clientId = req.client_id;
  let clientName = req.name;
  let address = [req.street, req.suburb, req.state, req.postcode].filter(Boolean).join(", ");

  if (!clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({ name: req.name, phone: req.phone, email: req.email, address, status: "Lead", lead_source: req.source, org_id: viewer.orgId })
      .select("id, name, address")
      .single();
    if (clientError || !client) return { ok: false, error: clientError?.message ?? "Could not create client." };
    clientId = client.id;
    clientName = client.name;
    address = client.address ?? address;
    await supabase.from("requests").update({ client_id: clientId }).eq("id", requestId);
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      client_name: clientName,
      address,
      job_date: date,
      start_time: startTime,
      client_id: clientId,
      status: "scheduled",
      org_id: viewer.orgId,
    })
    .select("id")
    .single();

  if (jobError || !job) return { ok: false, error: jobError?.message ?? "Could not create job." };

  await supabase.from("requests").update({ status: "Converted" }).eq("id", requestId);

  revalidatePath("/", "layout");
  return { ok: true, id: job.id };
}

async function nextQuoteNum(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("quotes").select("num");
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 1000);
  return `Q-${max + 1}`;
}

export interface QuoteLineInput {
  serviceId: string | null;
  serviceName: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface NewClientInput {
  name: string;
  email: string;
  phone: string;
  address: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Creates a Lead for someone typed in on a quote/invoice/job who isn't in the client list yet. */
async function createLeadClient(supabase: Db, orgId: string, nc: NewClientInput, source: string): Promise<{ id: string } | { error: string }> {
  const name = nc.name.trim();
  const email = nc.email.trim();
  if (!name) return { error: "Enter the new client's name." };
  if (email && !isValidEmail(email)) return { error: "That email address doesn't look right." };

  // Avoid accidental duplicates: if they're already in the list, make the user pick them.
  const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: existing } = await supabase.from("clients").select("id").ilike("name", escaped).limit(1);
  if (existing?.length) return { error: `A client named "${name}" already exists. Choose them from the client list.` };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      email: email || null,
      phone: nc.phone.trim() || null,
      address: nc.address.trim() || null,
      status: "Lead",
      lead_source: source,
      org_id: orgId,
    })
    .select("id")
    .single();
  if (error || !client) return { error: error?.message ?? "Could not create the client." };
  return { id: client.id };
}

export interface QuoteInput {
  clientId: string;
  /** Used when the quote is for someone not in the client list yet: they're created as a Lead. */
  newClient?: NewClientInput | null;
  propertyId: string | null;
  quoteDate: string;
  expiryDate: string;
  mode: GstMode;
  message: string;
  requestId: string | null;
  items: QuoteLineInput[];
}

export async function saveQuote(id: string | null, rawInput: QuoteInput, status: QuoteStatus): Promise<CreateResult> {
  if (!rawInput.clientId && !rawInput.newClient) return { ok: false, error: "Choose a client, or enter the new client's name." };
  if (!rawInput.items.length || rawInput.items.some((i) => !i.serviceName.trim())) return { ok: false, error: "Every line item needs a name." };

  const supabase = await createClient();
  const viewer = await getViewer();
  let quoteId = id;
  let input = rawInput;
  let createdClientId: string | null = null;

  if (!input.clientId && input.newClient) {
    const created = await createLeadClient(supabase, viewer.orgId, input.newClient, "Quote");
    if ("error" in created) return { ok: false, error: created.error };
    createdClientId = created.id;
    input = { ...input, clientId: created.id, propertyId: null };
  }

  if (quoteId) {
    const { error } = await supabase
      .from("quotes")
      .update({
        client_id: input.clientId,
        property_id: input.propertyId,
        quote_date: input.quoteDate,
        expiry_date: input.expiryDate,
        mode: input.mode,
        message: input.message,
        status,
      })
      .eq("id", quoteId);
    if (error) {
      if (createdClientId) await supabase.from("clients").delete().eq("id", createdClientId);
      return { ok: false, error: error.message };
    }
    await supabase.from("quote_items").delete().eq("quote_id", quoteId);
  } else {
    const num = await nextQuoteNum(supabase);
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        num,
        client_id: input.clientId,
        property_id: input.propertyId,
        quote_date: input.quoteDate,
        expiry_date: input.expiryDate,
        mode: input.mode,
        message: input.message,
        request_id: input.requestId,
        status,
        org_id: viewer.orgId,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (createdClientId) await supabase.from("clients").delete().eq("id", createdClientId);
      return { ok: false, error: error?.message ?? "Could not create quote." };
    }
    quoteId = data.id;
  }

  const rows = input.items.map((i, k) => ({
    quote_id: quoteId!,
    service_id: i.serviceId,
    service_name: i.serviceName.trim(),
    description: i.description.trim(),
    qty: i.qty,
    unit_price: i.unitPrice,
    sort_order: k,
    org_id: viewer.orgId,
  }));
  const { error: itemsError } = await supabase.from("quote_items").insert(rows);
  if (itemsError) return { ok: false, error: itemsError.message };

  if (input.requestId && status === "Sent") {
    await supabase.from("requests").update({ status: "Quoted" }).eq("id", input.requestId);
  }

  revalidatePath("/", "layout");
  return { ok: true, id: quoteId };
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (status === "Sent") {
    const { data: quote } = await supabase.from("quotes").select("request_id").eq("id", id).single();
    if (quote?.request_id) await supabase.from("requests").update({ status: "Quoted" }).eq("id", quote.request_id);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function convertQuoteToJob(quoteId: string): Promise<CreateResult> {
  const supabase = await createClient();
  const viewer = await getViewer();
  const [{ data: quote }, { data: items }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).single(),
    supabase.from("quote_items").select("*").eq("quote_id", quoteId),
  ]);
  if (!quote) return { ok: false, error: "Quote not found." };

  const { data: client } = await supabase.from("clients").select("name, address").eq("id", quote.client_id).single();
  let address = client?.address ?? "";
  if (quote.property_id) {
    const { data: prop } = await supabase.from("properties").select("*").eq("id", quote.property_id).single();
    if (prop) address = [prop.street, prop.line2, prop.suburb, prop.state, prop.postcode].filter(Boolean).join(", ");
  }

  const price = (items ?? []).reduce((s, i) => s + i.qty * i.unit_price, 0);
  const title = (items ?? []).map((i) => i.service_name).join(" + ");

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      client_name: client?.name ?? "Client",
      address,
      job_date: todayISO(),
      start_time: "09:00:00",
      client_id: quote.client_id,
      property_id: quote.property_id,
      quote_id: quote.id,
      title,
      price,
      status: "scheduled",
      notes: `Created from ${quote.num}`,
      org_id: viewer.orgId,
    })
    .select("id")
    .single();

  if (error || !job) return { ok: false, error: error?.message ?? "Could not create job." };

  await supabase.from("quotes").update({ job_id: job.id }).eq("id", quoteId);

  revalidatePath("/", "layout");
  return { ok: true, id: job.id };
}

async function nextInvoiceNum(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("invoices").select("num");
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 1000);
  return `INV-${max + 1}`;
}

export interface InvoiceLineInput {
  serviceId: string | null;
  serviceName: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceInput {
  clientId: string;
  /** Used when the invoice is for someone not in the client list yet: they're created as a Lead. */
  newClient?: NewClientInput | null;
  propertyId: string | null;
  jobId: string | null;
  issueDate: string;
  dueDate: string;
  mode: GstMode;
  notes: string;
  items: InvoiceLineInput[];
}

export async function saveInvoice(id: string | null, rawInput: InvoiceInput, status: InvoiceStatus): Promise<CreateResult> {
  if (!rawInput.clientId && !rawInput.newClient) return { ok: false, error: "Choose a client, or enter the new client's name." };
  if (!rawInput.items.length || rawInput.items.some((i) => !i.serviceName.trim())) return { ok: false, error: "Every line item needs a name." };

  const supabase = await createClient();
  const viewer = await getViewer();
  let invoiceId = id;
  let input = rawInput;
  let createdClientId: string | null = null;

  if (!input.clientId && input.newClient) {
    const created = await createLeadClient(supabase, viewer.orgId, input.newClient, "Invoice");
    if ("error" in created) return { ok: false, error: created.error };
    createdClientId = created.id;
    input = { ...input, clientId: created.id, propertyId: null, jobId: null };
  }

  if (invoiceId) {
    const { error } = await supabase
      .from("invoices")
      .update({
        client_id: input.clientId,
        property_id: input.propertyId,
        job_id: input.jobId,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        mode: input.mode,
        notes: input.notes,
        status,
      })
      .eq("id", invoiceId);
    if (error) {
      if (createdClientId) await supabase.from("clients").delete().eq("id", createdClientId);
      return { ok: false, error: error.message };
    }
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  } else {
    const num = await nextInvoiceNum(supabase);
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        num,
        client_id: input.clientId,
        property_id: input.propertyId,
        job_id: input.jobId,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        mode: input.mode,
        notes: input.notes,
        status,
        org_id: viewer.orgId,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (createdClientId) await supabase.from("clients").delete().eq("id", createdClientId);
      return { ok: false, error: error?.message ?? "Could not create invoice." };
    }
    invoiceId = data.id;
  }

  const rows = input.items.map((i, k) => ({
    invoice_id: invoiceId!,
    service_id: i.serviceId,
    service_name: i.serviceName.trim(),
    description: i.description.trim(),
    qty: i.qty,
    unit_price: i.unitPrice,
    sort_order: k,
    org_id: viewer.orgId,
  }));
  const { error: itemsError } = await supabase.from("invoice_items").insert(rows);
  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/", "layout");
  return { ok: true, id: invoiceId };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface OrganizationInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  abn: string;
  gstRegistered: boolean;
  paymentDetails: string;
  quoteEmailSubject: string;
  quoteEmailBody: string;
  invoiceEmailSubject: string;
  invoiceEmailBody: string;
  remindersEnabled: boolean;
  reminderEmailSubject: string;
  reminderEmailBody: string;
  staffNotificationsEnabled: boolean;
}

export async function updateOrganization(input: OrganizationInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Business name is required." };
  if (input.paymentDetails.length > 1000) return { ok: false, error: "Keep payment details under 1000 characters." };
  for (const [label, subject, body] of [["quote", input.quoteEmailSubject, input.quoteEmailBody], ["invoice", input.invoiceEmailSubject, input.invoiceEmailBody], ["reminder", input.reminderEmailSubject, input.reminderEmailBody]] as const) {
    if (subject.length > MAX_SUBJECT) return { ok: false, error: `Keep the ${label} email subject under ${MAX_SUBJECT} characters.` };
    if (body.length > MAX_BODY) return { ok: false, error: `Keep the ${label} email message under ${MAX_BODY} characters.` };
  }
  // A template left identical to the built-in wording is stored as NULL so future default improvements reach it.
  const custom = (text: string, fallback: string) => (text.trim() && text.trim() !== fallback.trim() ? text.trim() : null);
  const abn = input.abn.trim();
  if (abn && !isValidAbn(abn)) return { ok: false, error: "That ABN doesn't look right. An ABN has 11 digits (you can look yours up at abr.business.gov.au)." };

  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      abn: abn ? formatAbn(abn) : null,
      gst_registered: input.gstRegistered,
      payment_details: input.paymentDetails.trim() || null,
      quote_email_subject: custom(input.quoteEmailSubject, DEFAULT_TEMPLATES.quote.subject),
      quote_email_body: custom(input.quoteEmailBody, DEFAULT_TEMPLATES.quote.body),
      invoice_email_subject: custom(input.invoiceEmailSubject, DEFAULT_TEMPLATES.invoice.subject),
      invoice_email_body: custom(input.invoiceEmailBody, DEFAULT_TEMPLATES.invoice.body),
      reminders_enabled: input.remindersEnabled,
      staff_notifications_enabled: input.staffNotificationsEnabled,
      reminder_email_subject: custom(input.reminderEmailSubject, DEFAULT_TEMPLATES.reminder.subject),
      reminder_email_body: custom(input.reminderEmailBody, DEFAULT_TEMPLATES.reminder.body),
    })
    .eq("id", viewer.orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface PaymentInput {
  amount: number;
  paidDate: string;
  method: string;
  reference: string;
}

export async function recordPayment(invoiceId: string, input: PaymentInput): Promise<ActionResult> {
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than $0." };

  const supabase = await createClient();
  const viewer = await getViewer();
  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount: input.amount,
    paid_date: input.paidDate,
    method: input.method,
    reference: input.reference.trim() || "—",
    org_id: viewer.orgId,
  });
  if (error) return { ok: false, error: error.message };

  const [{ data: invoice }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("mode").eq("id", invoiceId).single(),
    supabase.from("invoice_items").select("qty, unit_price").eq("invoice_id", invoiceId),
    supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
  ]);

  if (invoice) {
    const total = calcTotals(items ?? [], invoice.mode).total;
    const paid = (payments ?? []).reduce((s, p) => s + p.amount, 0);
    const status: InvoiceStatus = paid >= total - 0.01 ? "Paid" : "Partially Paid";
    await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Emailing quotes and invoices to the client as a PDF attachment
// ---------------------------------------------------------------------------
function buildEmail(loaded: LoadedDoc, kind: EmailKind) {
  const { doc, total } = loaded;
  const org = doc.org;
  const gstNote = doc.mode === "none" ? "" : " (inc. GST)";
  const documentName = kind === "quote" ? "quote" : doc.kind === "Tax Invoice" ? "tax invoice" : "invoice";
  const values: Record<string, string> = {
    first_name: (doc.client?.name ?? "").split(" ")[0] || "there",
    number: doc.num,
    document: documentName,
    total: `$${total.toFixed(2)}${gstNote}`,
    valid_until: kind === "quote" ? doc.dates[1]?.value ?? "" : "",
    due_date: kind === "invoice" ? doc.dates[1]?.value ?? "" : "",
    message: kind === "quote" ? doc.note ?? "" : "",
    business: org?.name ?? "",
    signature: [org?.name, org?.phone, org?.email].filter(Boolean).join("\n"),
  };
  const template = templateFor(org, kind);
  const subject = renderTemplate(template.subject, values);
  return {
    to: doc.client?.email?.trim() ?? "",
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    body: renderTemplate(template.body, values),
  };
}

/** What the "Review email" step shows before a quote or invoice is sent. */
export async function getEmailDraft(kind: EmailKind, id: string): Promise<ActionResult & { draft?: EmailDraft }> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Only admins can send documents." };
  const loaded = kind === "quote" ? await loadQuoteDoc(id) : await loadInvoiceDoc(id);
  if (!loaded) return { ok: false, error: `${kind === "quote" ? "Quote" : "Invoice"} not found.` };
  const email = buildEmail(loaded, kind);
  if (!email.to) return { ok: false, error: `${loaded.doc.client?.name ?? "This client"} has no email address on file.` };
  return { ok: true, draft: { ...email, clientName: loaded.doc.client?.name ?? "", attachmentName: loaded.filename } };
}

export interface EmailOverride {
  subject: string;
  body: string;
}

async function emailDocument(loaded: LoadedDoc | null, kind: EmailKind, override?: EmailOverride): Promise<ActionResult & { sentTo?: string }> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Only admins can send documents." };
  if (!loaded) return { ok: false, error: `${kind === "quote" ? "Quote" : "Invoice"} not found.` };

  const { doc } = loaded;
  const built = buildEmail(loaded, kind);
  const to = built.to;
  if (!to) return { ok: false, error: `${doc.client?.name ?? "This client"} has no email address on file.` };

  const subject = (override?.subject ?? built.subject).trim();
  const body = (override?.body ?? built.body).trim();
  if (!subject) return { ok: false, error: "The email needs a subject." };
  if (!body) return { ok: false, error: "The email needs a message." };
  if (subject.length > MAX_SUBJECT || body.length > MAX_BODY) return { ok: false, error: "That email is too long." };

  const org = doc.org;
  if (!org?.email?.trim()) {
    return { ok: false, error: "Add your business email under Settings > Business Information first, so your client's replies reach you." };
  }
  // Monthly cap on emailed quotes/invoices (fails open if the log table isn't available).
  const admin = createAdminClient();
  const cap = emailLimit(org);
  if (cap !== null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count, error: countError } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("org_id", org.id).in("kind", ["quote", "invoice"]).gte("created_at", monthStart);
    if (!countError && (count ?? 0) >= cap) {
      const onTrial = getBillingState(org).kind !== "active" && billingEnforced();
      return {
        ok: false,
        error: onTrial
          ? `You've emailed ${cap} quotes and invoices this month, which is the limit on the free trial. Subscribe to send more.`
          : `You've reached this month's limit of ${cap} emailed quotes and invoices. Contact support if you need more.`,
      };
    }
  }

  const pdf = await renderDocumentPdf(doc);
  const result = await sendEmail({
    to,
    subject,
    text: `${body}\n`,
    fromName: org.name,
    replyTo: org.email,
    attachments: [{ filename: loaded.filename, content: pdf }],
  });
  if (!result.ok) return { ok: false, error: result.error };
  await admin.from("email_log").insert({ org_id: org.id, user_id: viewer.userId, kind });
  return { ok: true, sentTo: to };
}

export async function emailQuote(id: string, override?: EmailOverride) {
  return emailDocument(await loadQuoteDoc(id), "quote", override);
}

export async function emailInvoice(id: string, override?: EmailOverride) {
  return emailDocument(await loadInvoiceDoc(id), "invoice", override);
}

// ---------------------------------------------------------------------------
// Tester feedback
// ---------------------------------------------------------------------------
export interface FeedbackInput {
  kind: FeedbackKind;
  title: string;
  message: string;
  page: string;
  userAgent: string;
}

const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "idea", "question"];
const FEEDBACK_STATUSES: FeedbackStatus[] = ["new", "in_progress", "done", "wont_fix"];

export async function submitFeedback(input: FeedbackInput): Promise<ActionResult> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!FEEDBACK_KINDS.includes(input.kind)) return { ok: false, error: "Choose a type of feedback." };
  if (!title) return { ok: false, error: "Add a short title." };
  if (title.length > 200) return { ok: false, error: "Keep the title under 200 characters." };
  if (message.length > 5000) return { ok: false, error: "Keep the details under 5000 characters." };

  const viewer = await getViewer();
  const supabase = await createClient();

  // Light spam guard: a handful per hour is plenty for real feedback.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", viewer.userId).gte("created_at", since);
  if ((count ?? 0) >= 15) return { ok: false, error: "That's a lot of feedback in a short time. Please try again in a bit." };

  const userName = viewer.staff?.name || viewer.name || "";
  const { error } = await supabase.from("feedback").insert({
    org_id: viewer.orgId,
    user_id: viewer.userId,
    user_email: viewer.email,
    user_name: userName,
    kind: input.kind,
    title,
    message,
    page: input.page.trim().slice(0, 500),
    user_agent: input.userAgent.slice(0, 500),
  });
  if (error) {
    const missing = /relation .*feedback.* does not exist|schema cache/i.test(error.message);
    return { ok: false, error: missing ? "Feedback isn't switched on yet. Please try again later." : error.message };
  }

  // Best-effort heads-up to the platform owner; never fails the submission.
  const to = process.env.FEEDBACK_NOTIFY_EMAIL?.trim() || platformAdminEmails()[0];
  if (to) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", viewer.orgId).single();
    await sendEmail({
      to,
      subject: `[Crew feedback] ${input.kind}: ${title}`,
      text: `${title}\n\nType: ${input.kind}\nFrom: ${userName || "(no name)"} <${viewer.email}>\nBusiness: ${org?.name ?? "?"}\nPage: ${input.page || "(not given)"}\n\n${message || "(no details)"}\n`,
      fromName: "Crew & Grounds Feedback",
      replyTo: viewer.email,
    }).catch(() => null);
  }

  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  return { ok: true };
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!isPlatformAdmin(viewer.email)) return { ok: false, error: "Not authorized." };
  if (!FEEDBACK_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

  const { error } = await createAdminClient().from("feedback").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  return { ok: true };
}

/** Called before marking a quote/invoice as sent, so nothing is marked Sent when it can't be emailed. */
export async function checkCanSendDocuments(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return { ok: false, error: "Only admins can send documents." };
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("email").eq("id", viewer.orgId).single();
  if (!org?.email?.trim()) {
    return { ok: false, error: "Add your business email under Settings > Business Information first, so your client's replies reach you." };
  }
  return { ok: true };
}
