"use client";

import { useEffect } from "react";

/**
 * Registers the service worker silently. Mount once in the root layout.
 * No UI — just infra.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — could show a toast here
              console.log("[PWA] New version available. Refresh to update.");
            }
          });
        });
      } catch (err) {
        console.warn("[PWA] Service worker registration failed:", err);
      }
    };

    // Register after page load to not block LCP
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
