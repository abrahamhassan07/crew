import * as Sentry from "@sentry/nextjs";

// Receives Content-Security-Policy violation reports from browsers (see next.config.ts), so the
// report-only policy can be checked against real traffic before it is switched to enforcing.
// Public on purpose (browsers send these without cookies), so it only reads a small body and
// reports each distinct violation once per server instance.
const seen = new Set<string>();
const MAX_DISTINCT = 50;

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > 10_000) return new Response(null, { status: 413 });

  let report: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(text);
    report = (parsed["csp-report"] ?? parsed[0]?.body ?? parsed) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }

  const directive = String(report["violated-directive"] ?? report["effectiveDirective"] ?? "unknown");
  const blocked = String(report["blocked-uri"] ?? report["blockedURL"] ?? "");
  const page = String(report["document-uri"] ?? report["documentURL"] ?? "");

  // Browser extensions inject their own scripts and trip the policy; that's noise.
  if (/^(chrome|moz|safari|edge)-extension|^(chrome|moz)-extension:/.test(blocked)) return new Response(null, { status: 204 });

  const key = `${directive}|${blocked}`;
  if (!seen.has(key) && seen.size < MAX_DISTINCT) {
    seen.add(key);
    console.warn(`[csp] ${directive} blocked ${blocked || "(inline)"} on ${page}`);
    Sentry.captureMessage(`CSP report-only: ${directive} would block ${blocked || "inline"}`, { level: "info", fingerprint: ["csp", directive, blocked], extra: { page } });
  }
  return new Response(null, { status: 204 });
}
