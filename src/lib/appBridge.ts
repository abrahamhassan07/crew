"use client";

import { useSyncExternalStore } from "react";

/**
 * Talking to the phone app from a page shown inside it. The app announces what it can do before the page loads
 * (window.__crewApp, set by its injected script); older app builds announce nothing, so features stay hidden there.
 */

type CrewAppInfo = { platform?: "ios" | "android"; apple?: boolean };
type NativeWindow = Window & { __crewApp?: CrewAppInfo; ReactNativeWebView?: { postMessage: (m: string) => void } };

const appInfo = (): CrewAppInfo | null => {
  if (typeof window === "undefined") return null;
  const w = window as NativeWindow;
  return w.ReactNativeWebView && w.__crewApp ? w.__crewApp : null;
};

/** True inside an app build that can do Sign in with Apple (iPhone only). */
export const appCanSignInWithApple = () => appInfo()?.apple === true;

export type AppleCredential =
  | { ok: true; identityToken: string; fullName: string }
  | { ok: false; cancelled: boolean };

/**
 * Asks the app to show Apple's sign-in sheet. `hashedNonce` is the SHA-256 of a one-time value the page keeps;
 * Apple puts it in the token so Supabase can check the token was made for this sign-in.
 */
export function requestAppleCredential(hashedNonce: string): Promise<AppleCredential> {
  const w = window as NativeWindow;
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const done = (value: AppleCredential) => {
      window.removeEventListener("crew:apple", onResult);
      clearTimeout(timer);
      resolve(value);
    };
    const onResult = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: string; identityToken?: unknown; fullName?: unknown; cancelled?: unknown } | null;
      if (!d || d.id !== id) return;
      if (typeof d.identityToken === "string" && d.identityToken) done({ ok: true, identityToken: d.identityToken, fullName: typeof d.fullName === "string" ? d.fullName : "" });
      else done({ ok: false, cancelled: d.cancelled === true });
    };
    const timer = setTimeout(() => done({ ok: false, cancelled: false }), 180_000);
    window.addEventListener("crew:apple", onResult);
    try {
      w.ReactNativeWebView!.postMessage(JSON.stringify({ type: "appleSignIn", id, nonce: hashedNonce }));
    } catch {
      done({ ok: false, cancelled: false });
    }
  });
}

const noSubscribe = () => () => {};

/** Whether this page can offer Apple sign-in: false on the server and first paint, then the real answer. */
export const useAppleSignInAvailable = () => useSyncExternalStore(noSubscribe, appCanSignInWithApple, () => false);

/** Inside the app but without any one-tap sign-in to show (Android, or an older iPhone build). */
export const useInAppWithoutOneTap = () =>
  useSyncExternalStore(noSubscribe, () => document.documentElement.hasAttribute("data-in-app") && !appCanSignInWithApple(), () => false);
