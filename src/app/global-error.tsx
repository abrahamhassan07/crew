"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#5b6b64", marginBottom: 20 }}>We&rsquo;ve been notified and will look into it. Reloading the page usually fixes it, especially if the app was just updated.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#1f6b3f", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
