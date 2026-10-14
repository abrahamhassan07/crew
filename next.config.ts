import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Google Identity Services' Sign In With Google popup needs to
        // postMessage the credential back to this window on completion —
        // the stricter default COOP blocks that, silently failing every
        // Google sign-in with no usable error.
        source: "/:path*",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
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
