"use client";

import { useEffect } from "react";

const ENABLE_SW = process.env.NEXT_PUBLIC_ENABLE_SW === "1";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const setupServiceWorker = async () => {
      try {
        if (!ENABLE_SW) {
          // Recovery mode: remove buggy workers and stale caches.
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          return;
        }

        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.error("Service worker registration failed:", err);
      }
    };
    setupServiceWorker();
  }, []);

  return null;
}
