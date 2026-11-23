import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { getConnection as getXeroConnection } from "@/lib/xero";
import { orgMayUsePhAccounts, phConfigured } from "@/lib/phAccounts";
import { newPkce, phAuthorizeUrl, phBaseUrl } from "@/lib/phAccountsCore";

// Starts "Connect to PH Accounts": admins only, Team plan and above, and only when Xero isn't connected (one set
// of books at a time). The random state and the PKCE verifier are kept in a short-lived cookie for the callback.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (result: string) => NextResponse.redirect(`${origin}/settings?phaccounts=${result}`);
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return NextResponse.redirect(`${origin}/settings`);
  if (!(await orgMayUsePhAccounts(viewer.orgId))) return back("plan");
  if (!phConfigured()) return back("unavailable");
  if (await getXeroConnection(viewer.orgId)) return back("xero");

  const state = randomBytes(24).toString("hex");
  const { verifier, challenge } = newPkce();
  (await cookies()).set("phaccounts_oauth", `${state}.${verifier}`, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/phaccounts",
    maxAge: 600,
  });
  return NextResponse.redirect(phAuthorizeUrl({ baseUrl: phBaseUrl(), clientId: process.env.PH_ACCOUNTS_CLIENT_ID!, origin, state, challenge }));
}
