import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/stripe";
import { xeroAuthorizeUrl, xeroConfigured } from "@/lib/xero";

// Starts "Connect Xero": admins only. The random state is kept in a short-lived cookie and checked on the way back.
export async function GET() {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return NextResponse.redirect(`${siteUrl()}/settings`);
  if (!xeroConfigured()) return NextResponse.redirect(`${siteUrl()}/settings?xero=unavailable`);

  const state = randomBytes(24).toString("hex");
  (await cookies()).set("xero_oauth_state", state, {
    httpOnly: true,
    secure: siteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/api/xero",
    maxAge: 600,
  });
  return NextResponse.redirect(xeroAuthorizeUrl(state));
}
