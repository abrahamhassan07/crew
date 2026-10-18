import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Sites the app legitimately loads from: Supabase (API + realtime), Google Sign-In and Maps (address
// autocomplete), Cloudflare Turnstile (sign-up check) and Sentry (error reports). Fonts are self-hosted by next/font.
const SENTRY = "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io";
const GOOGLE_MAPS = "https://maps.googleapis.com https://maps.gstatic.com";

// Enforced now: rules that can't break a page that works today.
const CSP_ENFORCED = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"].join("; ");

// Report-only for now: the full script/style/connect allow-list. Browsers log violations to the console
// without blocking anything, so it can be checked on real pages before it is switched to enforcing.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com https://challenges.cloudflare.com ${GOOGLE_MAPS}`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com",
  `img-src 'self' data: blob: https://*.googleusercontent.com https://*.supabase.co ${GOOGLE_MAPS} https://*.ggpht.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://maps.googleapis.com ${SENTRY}`,
  "frame-src https://accounts.google.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Logo uploads (up to 1 MB) go through a Server Action; leave room for the form overhead.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Google Identity Services' Sign In With Google popup needs to
          // postMessage the credential back to this window on completion —
          // the stricter default COOP blocks that, silently failing every
          // Google sign-in with no usable error.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: CSP_ENFORCED },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

// Source-map upload only happens when SENTRY_AUTH_TOKEN is set (Vercel env); otherwise this is a no-op wrapper.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
});
