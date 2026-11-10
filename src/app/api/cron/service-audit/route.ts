import { NextResponse, type NextRequest } from "next/server";
import { runScheduledAudits } from "@/lib/audit/run";

// Weekly Client Service Auditor. Vercel Cron calls this on Saturday evening UTC (see vercel.json); the daily reminders
// job also calls it. It only does work from Sunday 7:00 am Melbourne time, and each business gets one report per week.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runScheduledAudits());
}
