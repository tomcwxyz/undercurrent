"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; theme?: string; callback?: (token: string) => void }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

/**
 * Renders a Cloudflare Turnstile widget inside the enclosing <form>. On
 * success Turnstile writes the token into a hidden `cf-turnstile-response`
 * input within its container, so it rides along with the form's normal
 * FormData — no extra wiring needed in the parent form.
 */
export function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const elementId = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current) return;
    if (!window.turnstile) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
    });
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onReady={() => {
          if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: "dark",
          });
        }}
      />
      <div id={elementId} ref={containerRef} className="cf-turnstile" />
    </>
  );
}
