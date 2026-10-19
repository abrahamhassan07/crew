import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { exchangeCode, fetchTenants, saveConnection, xeroConfigured } from "@/lib/xero";

// Xero sends the user back here after they approve (or refuse) access.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (result: string) => {
    const res = NextResponse.redirect(`${origin}/settings?xero=${result}`);
    res.cookies.delete({ name: "xero_oauth_state", path: "/api/xero" });
    return res;
  };

  const viewer = await getViewer();
  if (viewer.profile.role !== "admin" || !xeroConfigured()) return back("error");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("declined");

  const expected = (await cookies()).get("xero_oauth_state")?.value ?? "";
  const given = params.get("state") ?? "";
  const same = expected.length > 0 && expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  const code = params.get("code");
  if (!same || !code) return back("error");

  try {
    const tokens = await exchangeCode(code, origin);
    const tenants = await fetchTenants(tokens.access_token);
    if (!tenants.length) return back("error");
    await saveConnection(viewer.orgId, viewer.userId, tokens, tenants[0]);
  } catch (e) {
    console.error("[xero connect]", e instanceof Error ? e.message : e);
    return back("error");
  }
  return back("connected");
}
