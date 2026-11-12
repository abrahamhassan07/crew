import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TYPE_META, durationLabel, fmtTime12 } from "@/lib/design";
import type { Database, Job } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

/** What the phone app's job screens get. Only what's needed on the job, nothing financial. */
export interface AppJob {
  id: string;
  num: string;
  title: string;
  jobType: Job["job_type"];
  typeLabel: string;
  status: Job["status"];
  date: string | null;
  startTime: string | null;
  timeLabel: string;
  durationMinutes: number;
  durationLabel: string;
  clientName: string;
  address: string;
  staffName: string | null;
  crewName: string | null;
  checklist: { t: string; done: boolean }[];
  notes: string;
}

export interface AppJobDetail extends AppJob {
  /** Owners only (staff can't read client records). */
  clientPhone: string | null;
  clientEmail: string | null;
  /** Site page with the full job, owners only. */
  webPath: string | null;
}

/** Names of staff and crews the person may see (row rules apply: staff only see themselves). */
async function nameMaps(db: Db) {
  const [{ data: staff }, { data: crews }] = await Promise.all([db.from("staff").select("id, name"), db.from("crews").select("id, name")]);
  return { staff: new Map((staff ?? []).map((s) => [s.id, s.name])), crews: new Map((crews ?? []).map((c) => [c.id, c.name])) };
}

function toAppJob(job: Job, names: Awaited<ReturnType<typeof nameMaps>>): AppJob {
  return {
    id: job.id,
    num: job.num,
    title: job.title,
    jobType: job.job_type,
    typeLabel: (TYPE_META[job.job_type] ?? TYPE_META.cleaning).label,
    status: job.status,
    date: job.job_date,
    startTime: job.start_time ? job.start_time.slice(0, 5) : null,
    timeLabel: job.start_time ? fmtTime12(job.start_time.slice(0, 5)) : "Any time",
    durationMinutes: job.duration_minutes,
    durationLabel: durationLabel(job.duration_minutes),
    clientName: job.client_name,
    address: job.address,
    staffName: job.assigned_staff_id ? (names.staff.get(job.assigned_staff_id) ?? null) : null,
    crewName: job.crew_id ? (names.crews.get(job.crew_id) ?? null) : null,
    checklist: Array.isArray(job.checklist) ? job.checklist : [],
    notes: job.notes ?? "",
  };
}

/** Jobs on one day, in time order (row rules: staff get only their own). */
export async function jobsOnDate(db: Db, date: string): Promise<AppJob[] | null> {
  const [{ data, error }, names] = await Promise.all([db.from("jobs").select("*").eq("job_date", date).order("start_time", { ascending: true, nullsFirst: false }).limit(300), nameMaps(db)]);
  if (error) return null;
  return (data ?? []).map((j) => toAppJob(j, names));
}

export async function jobDetail(db: Db, id: string, isAdmin: boolean): Promise<AppJobDetail | null> {
  const [{ data: job }, names] = await Promise.all([db.from("jobs").select("*").eq("id", id).maybeSingle(), nameMaps(db)]);
  if (!job) return null;
  let clientPhone: string | null = null;
  let clientEmail: string | null = null;
  if (isAdmin && job.client_id) {
    const { data: client } = await db.from("clients").select("phone, email").eq("id", job.client_id).maybeSingle();
    clientPhone = client?.phone?.trim() || null;
    clientEmail = client?.email?.trim() || null;
  }
  return { ...toAppJob(job, names), clientPhone, clientEmail, webPath: isAdmin ? `/jobs/${job.id}` : null };
}
