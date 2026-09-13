import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Staff } from "@/lib/supabase/types";

export interface Viewer {
  userId: string;
  email: string;
  profile: Profile;
  staff: Staff | null;
}

/**
 * Loads the signed-in user's profile and staff row (if any) in a single
 * round trip via an embedded select, joining on the profiles -> staff FK
 * (previously two sequential queries). Wrapped in React's cache() so the
 * layout, a page, and requireAdmin() can all call this within the same
 * request and only hit Supabase once instead of once each.
 *
 * Deliberately still uses getUser() rather than getSession(), even though
 * middleware already validated the token for this request: getSession()
 * only decodes the local cookie and won't catch a token that's since been
 * revoked (e.g. a removed staff member's existing session) — getUser()'s
 * round trip to the auth server is what actually re-checks that.
 *
 * Middleware guarantees a session exists on every non-public route, so
 * the only way this fails is a profile row not existing yet (trigger
 * lag) — treat that as "not signed in" and bounce to login.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileWithStaff } = await supabase
    .from("profiles")
    .select("*, staff(*)")
    .eq("user_id", user.id)
    .single<Profile & { staff: Staff | null }>();

  if (!profileWithStaff) {
    redirect("/login");
  }

  const { staff, ...profile } = profileWithStaff;

  return { userId: user.id, email: user.email ?? "", profile, staff: staff ?? null };
});

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") {
    redirect("/dashboard");
  }
  return viewer;
}
