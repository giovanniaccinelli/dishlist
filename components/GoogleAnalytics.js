"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const GA_ID = "G-RK0GKK67BN";

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("config", GA_ID, { page_path: pathname });
  }, [pathname]);

  return null;
}
