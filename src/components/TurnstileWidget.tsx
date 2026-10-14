"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const el = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error("Could not load the security check.")));
    if (!existing) document.head.appendChild(el);
  });
}

/**
 * Cloudflare Turnstile. It stays invisible unless Cloudflare needs more proof, and puts its
 * token into a hidden `cf-turnstile-response` field of the surrounding form. Tokens are single-use,
 * so change `resetKey` after every submit to get a fresh one.
 */
export function TurnstileWidget({ resetKey }: { resetKey?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holder = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (token: string) => {
            if (input.current) input.current.value = token;
          },
          "expired-callback": () => {
            if (input.current) input.current.value = "";
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === undefined || !widgetId.current) return;
    if (input.current) input.current.value = "";
    window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <>
      <input ref={input} type="hidden" name="cf-turnstile-response" />
      <div ref={holder} />
    </>
  );
}
