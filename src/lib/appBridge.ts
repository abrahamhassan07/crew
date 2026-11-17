"use client";

import { useSyncExternalStore } from "react";

/**
 * Talking to the phone app from a page shown inside it. The app announces what it can do before the page loads
 * (window.__crewApp, set by its injected script); older app builds announce nothing, so features stay hidden there.
 */

type CrewAppInfo = { platform?: "ios" | "android"; apple?: boolean; google?: boolean };
export type NativeProvider = "apple" | "google";
type NativeWindow = Window & { __crewApp?: CrewAppInfo; ReactNativeWebView?: { postMessage: (m: string) => void } };

const appInfo = (): CrewAppInfo | null => {
  if (typeof window === "undefined") return null;
  const w = window as NativeWindow;
  return w.ReactNativeWebView && w.__crewApp ? w.__crewApp : null;
};

/** True inside an app build that can show this provider's native sign-in (Apple: iPhone; Google: newer iPhone builds). */
export const appCanSignInWith = (provider: NativeProvider) => appInfo()?.[provider] === true;

export type NativeCredential =
  | { ok: true; identityToken: string; fullName: string }
  | { ok: false; cancelled: boolean };

/**
 * Asks the app to show Apple's or Google's sign-in sheet. `hashedNonce` is the SHA-256 of a one-time value the page
 * keeps; the provider puts it in the token so Supabase can check the token was made for this sign-in.
 */
export function requestNativeCredential(provider: NativeProvider, hashedNonce: string): Promise<NativeCredential> {
  const w = window as NativeWindow;
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const done = (value: NativeCredential) => {
      window.removeEventListener(`crew:${provider}`, onResult);
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
    window.addEventListener(`crew:${provider}`, onResult);
    try {
      w.ReactNativeWebView!.postMessage(JSON.stringify({ type: `${provider}SignIn`, id, nonce: hashedNonce }));
    } catch {
      done({ ok: false, cancelled: false });
    }
  });
}

const noSubscribe = () => () => {};

/** Whether this page can offer the provider's native sign-in: false on the server and first paint, then the real answer. */
export const useNativeSignInAvailable = (provider: NativeProvider) => useSyncExternalStore(noSubscribe, () => appCanSignInWith(provider), () => false);

/** Inside the app but without any one-tap sign-in to show (Android, or an older iPhone build). */
export const useInAppWithoutOneTap = () =>
  useSyncExternalStore(noSubscribe, () => document.documentElement.hasAttribute("data-in-app") && !appCanSignInWith("apple") && !appCanSignInWith("google"), () => false);
