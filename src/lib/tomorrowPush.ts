import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, fmtISO, parseISO, todayISO } from "@/lib/design";
import { pushToUsers } from "@/lib/push";
import { tomorrowNote } from "@/lib/pushCore";

/**
 * The evening push: everyone with jobs tomorrow gets one notification ("3 jobs tomorrow, first at 8:00 AM: Smith").
 * Only people signed in to the app with notifications allowed receive it; nothing goes to clients.
 */
export async function sendTomorrowPushes(dryRun = false): Promise<{ date: string; people: number; sent: number }> {
  const date = fmtISO(addDays(parseISO(todayISO()), 1));
  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("jobs")
    .select("org_id, assigned_staff_id, start_time, client_name")
    .eq("job_date", date)
    .in("status", ["scheduled", "in_progress"])
    .not("assigned_staff_id", "is", null)
    .limit(20000);
  if (error) throw new Error(error.message);

  // Only staff who are active and signed in somewhere (through their profile) can get a push.
  const staffIds = [...new Set((jobs ?? []).map((j) => j.assigned_staff_id as string))];
  const people = new Map<string, { orgId: string; userId: string }>();
  for (let i = 0; i < staffIds.length; i += 500) {
    const ids = staffIds.slice(i, i + 500);
    const [{ data: staff }, { data: profiles }] = await Promise.all([
      admin.from("staff").select("id, org_id, active").in("id", ids),
      admin.from("profiles").select("user_id, staff_id, org_id").in("staff_id", ids),
    ]);
    const activeStaff = new Map((staff ?? []).filter((s) => s.active).map((s) => [s.id, s.org_id]));
    for (const p of profiles ?? []) {
      // The profile must be in the same business as the staff record.
      if (p.staff_id && activeStaff.get(p.staff_id) === p.org_id) people.set(p.staff_id, { orgId: p.org_id, userId: p.user_id });
    }
  }

  const byStaff = new Map<string, { start_time: string | null; client_name: string }[]>();
  for (const j of jobs ?? []) {
    const person = people.get(j.assigned_staff_id as string);
    if (!person || person.orgId !== j.org_id) continue;
    const list = byStaff.get(j.assigned_staff_id as string) ?? [];
    list.push({ start_time: j.start_time, client_name: j.client_name });
    byStaff.set(j.assigned_staff_id as string, list);
  }

  let sent = 0;
  for (const [staffId, list] of byStaff) {
    const note = tomorrowNote(date, list);
    const person = people.get(staffId)!;
    if (!note || dryRun) continue;
    sent += await pushToUsers(person.orgId, [person.userId], note);
  }
  return { date, people: byStaff.size, sent };
}
