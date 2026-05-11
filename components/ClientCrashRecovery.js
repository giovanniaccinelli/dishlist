"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "dishlist:client-crash-recovered";

async function clearBrowserAppCache() {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((registration) => registration.unregister()));
    }
  } catch (err) {
    console.error("Failed to unregister service workers during recovery:", err);
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.error("Failed to clear browser caches during recovery:", err);
  }
}

export default function ClientCrashRecovery() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const recover = async () => {
      if (sessionStorage.getItem(RECOVERY_KEY) === "1") return;
      sessionStorage.setItem(RECOVERY_KEY, "1");
      await clearBrowserAppCache();
      const url = new URL(window.location.href);
      url.searchParams.set("recovered", String(Date.now()));
      window.location.replace(url.toString());
    };

    const onError = () => {
      recover();
    };
    const onUnhandledRejection = () => {
      recover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    clearBrowserAppCache();

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
