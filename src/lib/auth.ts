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
 * Loads the signed-in user's profile (and staff row, if any). Wrapped in
 * React's cache() so the layout, a page, and requireAdmin() can all call
 * this within the same request and only hit Supabase once instead of
 * once each — each call was a real network round trip.
 *
 * Middleware already guarantees a session exists on every non-public
 * route, so the only way this fails is a profile row not existing yet
 * (trigger lag) — treat that as "not signed in" and bounce to login.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  let staff: Staff | null = null;
  if (profile.staff_id) {
    const { data } = await supabase.from("staff").select("*").eq("id", profile.staff_id).single();
    staff = data ?? null;
  }

  return { userId: user.id, email: user.email ?? "", profile, staff };
});

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") {
    redirect("/dashboard");
  }
  return viewer;
}
