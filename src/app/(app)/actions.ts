"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth";
import { addDays, fmtISO, parseISO, STAFF_HUES } from "@/lib/design";
import { calcTotals } from "@/lib/gst";
import type { CareProvider, ClientStatus, GstMode, InvoiceStatus, JobRole, JobStatus, PricingType, QuoteStatus, Recurrence, RequestStatus, ServiceCategory, Skill } from "@/lib/supabase/types";

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
    client_id: input.clientId ?? null,
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
      client_id: input.clientId ?? null,
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

export async function rescheduleJob(id: string, date: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ job_date: date }).eq("id", id);
  if (error) return { ok: false, error: error.message };

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
  const { error } = await supabase.from("staff").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

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
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 2040);
  return `Q-${max + 1}`;
}

export interface QuoteLineInput {
  serviceId: string | null;
  serviceName: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface QuoteInput {
  clientId: string;
  propertyId: string | null;
  quoteDate: string;
  expiryDate: string;
  mode: GstMode;
  message: string;
  requestId: string | null;
  items: QuoteLineInput[];
}

export async function saveQuote(id: string | null, input: QuoteInput, status: QuoteStatus): Promise<CreateResult> {
  if (!input.clientId) return { ok: false, error: "Choose a client." };
  if (!input.items.length || input.items.some((i) => !i.serviceName.trim())) return { ok: false, error: "Every line item needs a name." };

  const supabase = await createClient();
  const viewer = await getViewer();
  let quoteId = id;

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
    if (error) return { ok: false, error: error.message };
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
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create quote." };
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
      job_date: new Date().toISOString().slice(0, 10),
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
  const max = (data ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 3140);
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
  propertyId: string | null;
  jobId: string | null;
  issueDate: string;
  dueDate: string;
  mode: GstMode;
  notes: string;
  items: InvoiceLineInput[];
}

export async function saveInvoice(id: string | null, input: InvoiceInput, status: InvoiceStatus): Promise<CreateResult> {
  if (!input.clientId) return { ok: false, error: "Choose a client." };
  if (!input.items.length || input.items.some((i) => !i.serviceName.trim())) return { ok: false, error: "Every line item needs a name." };

  const supabase = await createClient();
  const viewer = await getViewer();
  let invoiceId = id;

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
    if (error) return { ok: false, error: error.message };
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
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create invoice." };
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
}

export async function updateOrganization(input: OrganizationInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Business name is required." };

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
      abn: input.abn.trim() || null,
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
