import "server-only";
import { STAFF_HUES } from "@/lib/design";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * A new business's owner is also a person jobs can be assigned to, so they get
 * a staff row (role Owner) at signup, like every business that was set up by hand.
 */
export async function createOwnerStaff(admin: Admin, orgId: string, name: string, email: string, userId?: string): Promise<string | null> {
  const { data, error } = await admin
    .from("staff")
    .insert({
      name: name || email.split("@")[0],
      email,
      skill: "both",
      color_hue: STAFF_HUES[0],
      active: true,
      job_role: "Owner",
      org_id: orgId,
      ...(userId ? { user_id: userId } : {}),
    })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}
