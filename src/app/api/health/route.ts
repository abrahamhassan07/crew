import { createClient } from "@supabase/supabase-js";

// Point an uptime monitor (e.g. UptimeRobot, BetterStack) at /api/health.
// Returns 503 if the database can't be reached.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await db.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
  if (error) return Response.json({ status: "degraded" }, { status: 503 });
  return Response.json({ status: "ok" });
}
