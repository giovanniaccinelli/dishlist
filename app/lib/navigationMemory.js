"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function buildPageMemoryKey(namespace, pathname, searchParams) {
  const query = searchParams?.toString?.() || "";
  return `${namespace}:${pathname}${query ? `?${query}` : ""}`;
}

export function usePageScrollMemory(namespace, ready = true) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef(null);
  const restoredKeyRef = useRef("");

  const storageKey = useMemo(
    () => buildPageMemoryKey(namespace, pathname, searchParams),
    [namespace, pathname, searchParams]
  );

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
    restoredKeyRef.current = storageKey;

    const restore = () => {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored == null) return;
        node.scrollTop = Number(stored) || 0;
      } catch {}
    };

    const rafOne = window.requestAnimationFrame(() => {
      const rafTwo = window.requestAnimationFrame(restore);
      return () => window.cancelAnimationFrame(rafTwo);
    });

    return () => window.cancelAnimationFrame(rafOne);
  }, [ready, storageKey]);

  return containerRef;
}

