"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

function buildPageMemoryKey(namespace, pathname, query = "") {
  return `${namespace}:${pathname}${query ? `?${query}` : ""}`;
}

export function usePageScrollMemory(namespace, ready = true) {
  const pathname = usePathname();
  const containerRef = useRef(null);
  const restoredKeyRef = useRef("");
  const lastAppliedScrollRef = useRef(null);

  const query =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search || "").toString();

  const storageKey = useMemo(() => buildPageMemoryKey(namespace, pathname, query), [namespace, pathname, query]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const persist = () => {
      try {
        sessionStorage.setItem(storageKey, String(node.scrollTop || 0));
      } catch {}
    };

    node.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      node.removeEventListener("scroll", persist);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    const node = containerRef.current;
    if (!node) return;
    if (restoredKeyRef.current === storageKey) return;
    let cancelled = false;
    let timeoutId = null;
    let observer = null;

    const restore = () => {
      if (cancelled) return;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored == null) return;
        const target = Math.max(0, Number(stored) || 0);
        lastAppliedScrollRef.current = target;
        node.scrollTop = target;
      } catch {}
    };

    const scheduleRestore = (attempt = 0) => {
      if (cancelled) return;
      restore();
      if (attempt >= 18) return;
      timeoutId = window.setTimeout(() => {
        scheduleRestore(attempt + 1);
      }, 120);
    };

    restoredKeyRef.current = storageKey;

    const startRestore = () => {
      scheduleRestore(0);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          if (cancelled || lastAppliedScrollRef.current == null) return;
          node.scrollTop = lastAppliedScrollRef.current;
        });
        observer.observe(node);
      }
    };

    const rafOne = window.requestAnimationFrame(() => {
      const rafTwo = window.requestAnimationFrame(startRestore);
      return () => window.cancelAnimationFrame(rafTwo);
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (observer) observer.disconnect();
      window.cancelAnimationFrame(rafOne);
    };
  }, [ready, storageKey]);

  return containerRef;
}
