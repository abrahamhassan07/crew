"use client";

import { useInAppWithoutOneTap } from "@/lib/appBridge";

/**
 * The "or" line between the one-tap sign-in buttons and the email form. Inside the phone app Google is hidden, so the
 * line only shows there when the Apple button does (an "or" with nothing above it would look broken).
 */
export function OrDivider() {
  if (useInAppWithoutOneTap()) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-ink-muted">
      <div className="flex-1 h-px bg-line" />
      or
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}
