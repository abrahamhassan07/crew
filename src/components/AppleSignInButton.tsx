"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { sha256Hex } from "@/lib/googleIdentity";
import { finishIdTokenSignIn } from "@/lib/idTokenSignIn";
import { requestAppleCredential, useAppleSignInAvailable } from "@/lib/appBridge";

/**
 * "Continue with Apple", shown only inside the iPhone app (which shows Apple's native sign-in sheet and hands the
 * token back). Apple requires it next to any other third-party sign-in in an iPhone app. On the website nothing
 * renders. On the signup page, businessName gates the button like Google's.
 */
export function AppleSignInButton({
  next,
  businessName,
  onError,
  onNeedsCode,
}: {
  next: string;
  businessName?: string;
  onError: (code: string) => void;
  onNeedsCode?: () => void;
}) {
  const available = useAppleSignInAvailable();
  const [pending, setPending] = useState(false);
  const isSignup = businessName !== undefined;
  const gated = isSignup && !businessName.trim();

  if (!available) return null;

  const start = async () => {
    if (pending || gated) return;
    setPending(true);
    try {
      const rawNonce = crypto.randomUUID();
      const credential = await requestAppleCredential(await sha256Hex(rawNonce));
      if (!credential.ok) {
        setPending(false);
        if (!credential.cancelled) onError("apple-failed");
        return;
      }
      const result = await finishIdTokenSignIn({ provider: "apple", token: credential.identityToken, rawNonce, businessName, displayName: credential.fullName });
      if (!result.ok) {
        setPending(false);
        onError(result.error === "no-account" ? "no-account-apple" : result.error === "oauth-failed" ? "apple-failed" : result.error);
        return;
      }
      if (result.needsCode && onNeedsCode) {
        setPending(false);
        onNeedsCode();
        return;
      }
      window.location.assign(next);
    } catch {
      setPending(false);
      onError("apple-failed");
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending || gated}
      className="w-full h-11 rounded-lg bg-black text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing in…
        </>
      ) : gated ? (
        "Enter your business name to continue with Apple"
      ) : (
        <>
          <svg aria-hidden viewBox="0 0 384 512" className="w-4 h-4 -mt-0.5" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
          </svg>
          {isSignup ? "Sign up with Apple" : "Continue with Apple"}
        </>
      )}
    </button>
  );
}
