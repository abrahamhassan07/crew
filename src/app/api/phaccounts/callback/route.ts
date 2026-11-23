import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { getConnection as getXeroConnection } from "@/lib/xero";
import { exchangeCode, fetchConnectionInfo, orgMayUsePhAccounts, phConfigured, saveConnection } from "@/lib/phAccounts";

// PH Accounts sends the user back here after they approve (or refuse) access.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (result: string) => {
    const res = NextResponse.redirect(`${origin}/settings?phaccounts=${result}`);
    res.cookies.delete({ name: "phaccounts_oauth", path: "/api/phaccounts" });
    return res;
  };

  const viewer = await getViewer();
  if (viewer.profile.role !== "admin" || !phConfigured()) return back("error");
  if (!(await orgMayUsePhAccounts(viewer.orgId))) return back("plan");
  if (await getXeroConnection(viewer.orgId)) return back("xero");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("declined");

  const [expected = "", verifier = ""] = ((await cookies()).get("phaccounts_oauth")?.value ?? "").split(".");
  const given = params.get("state") ?? "";
  const same = expected.length > 0 && expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  const code = params.get("code");
  if (!same || !code || !verifier) return back("error");

  try {
    const tokens = await exchangeCode(code, origin, verifier);
    const info = await fetchConnectionInfo(tokens.access_token);
    await saveConnection(viewer.orgId, viewer.userId, tokens, info.canIssueInvoices);
  } catch (e) {
    console.error("[phaccounts connect]", e instanceof Error ? e.message : e);
    return back("error");
  }
  return back("connected");
}
