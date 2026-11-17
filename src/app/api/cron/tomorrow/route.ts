import { NextResponse, type NextRequest } from "next/server";
import { sendTomorrowPushes } from "@/lib/tomorrowPush";

// Called every evening by Vercel Cron (see vercel.json; 08:00 UTC is 7 pm Melbourne summer time, 6 pm in winter).
// Vercel sends "Authorization: Bearer $CRON_SECRET"; without that secret configured the route stays closed.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sendTomorrowPushes(request.nextUrl.searchParams.get("dry") === "1"));
  } catch (e) {
    console.error("[cron] tomorrow pushes failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
