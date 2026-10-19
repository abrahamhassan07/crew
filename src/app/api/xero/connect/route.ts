import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { orgMayUseXero, xeroAuthorizeUrl, xeroConfigured } from "@/lib/xero";

// Starts "Connect Xero": admins only. The random state is kept in a short-lived cookie and checked on the way back.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return NextResponse.redirect(`${origin}/settings`);
  if (!(await orgMayUseXero(viewer.orgId))) return NextResponse.redirect(`${origin}/settings?xero=plan`);
  if (!xeroConfigured()) return NextResponse.redirect(`${origin}/settings?xero=unavailable`);

  const state = randomBytes(24).toString("hex");
  (await cookies()).set("xero_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/xero",
    maxAge: 600,
  });
  return NextResponse.redirect(xeroAuthorizeUrl(state, origin));
}
