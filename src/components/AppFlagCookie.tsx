"use client";

import { useEffect } from "react";
import { APP_COOKIE } from "@/lib/appFlag";

/**
 * Inside the phone app, remember it in a cookie. The app's user agent doesn't reach every request (form posts and
 * server actions arrive without it), but cookies do, so the server can still keep plan prompts out of the app.
 */
export function AppFlagCookie() {
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-in-app")) return;
    if (document.cookie.split("; ").includes(`${APP_COOKIE}=1`)) return;
    document.cookie = `${APP_COOKIE}=1; path=/; max-age=31536000; samesite=lax; secure`;
  }, []);
  return null;
}
