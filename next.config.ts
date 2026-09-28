import type { NextConfig } from "next";

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

export default nextConfig;
