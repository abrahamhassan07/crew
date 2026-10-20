import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/marketing/", "/sitemap.xml", "/robots.txt", "/auth/confirm", "/terms", "/privacy", "/api/stripe/webhook", "/api/xero/webhook", "/api/health", "/api/cron", "/api/csp-report"];

// Signed-in sessions end after this long without a visit. Supabase can only do this on its paid plan,
// so the site tracks the last visit itself. The cookie is only a timestamp; the login stays with Supabase.
// SESSION_IDLE_HOURS overrides the default of 7 days (168 hours).
const IDLE_MS = (Number(process.env.SESSION_IDLE_HOURS) || 168) * 60 * 60 * 1000;
const SEEN_COOKIE = "crew-last-seen";
const SEEN_REFRESH_MS = 5 * 60 * 1000;

export async function updateSession(request: NextRequest) {
  // Lets server components (e.g. the billing gate in the app layout) know the current path.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server Action invocations POST back to the current page URL and expect
  // a normal action response, not an HTTP redirect — redirecting one here
  // corrupts the client's fetch-based RPC (manifests as bogus, rapid-fire
  // redirect loops). Each action already enforces its own auth via
  // getViewer()/requireAdmin(), so it's safe to just let these through.
  const isServerAction = request.headers.has("next-action");

  const path = request.nextUrl.pathname;
  // "/" is the public marketing page; matched exactly so it doesn't make every path public.
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));

  const now = Date.now();
  const lastSeen = Number(request.cookies.get(SEEN_COOKIE)?.value) || 0;

  // Idle too long: end the session and send them to sign in again.
  if (user && lastSeen && now - lastSeen > IDLE_MS && !isServerAction) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    url.searchParams.set("reason", "idle");
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.cookies.delete(SEEN_COOKIE);
    return redirect;
  }

  // Keep the timestamp fresh while they're active (not on every request); clear it once signed out so
  // the next sign-in starts a fresh clock.
  if (user && now - lastSeen > SEEN_REFRESH_MS) {
    response.cookies.set(SEEN_COOKIE, String(now), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  } else if (!user && lastSeen) {
    response.cookies.delete(SEEN_COOKIE);
  }

  if (!isServerAction) {
    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    // Signed-in people skip the marketing page and the sign-in screens and go straight to the app.
    if (user && (path === "/" || path === "/login" || path === "/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
