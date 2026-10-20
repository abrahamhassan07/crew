import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/reminders";
import { syncAllXeroPayments } from "@/lib/xero";

// Called once a day by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; without that secret configured the route stays closed.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const reminders = await sendDueReminders(dryRun);
  // Once a day, also catch any Xero payments the webhook missed.
  let xeroPayments: unknown = "skipped (dry run)";
  if (!dryRun) {
    try {
      xeroPayments = await syncAllXeroPayments();
    } catch (e) {
      xeroPayments = { error: e instanceof Error ? e.message : "failed" };
    }
  }
  return NextResponse.json({ ...reminders, xeroPayments });
}
