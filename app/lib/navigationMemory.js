"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

function buildPageMemoryKey(namespace, pathname, query = "") {
  return `${namespace}:${pathname}${query ? `?${query}` : ""}`;
}

function readScrollPayload(storageKey) {
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored == null) return null;
    const parsed = JSON.parse(stored);
    if (typeof parsed === "number") {
      return { container: parsed, window: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return {
        container: Math.max(0, Number(parsed.container) || 0),
        window: Math.max(0, Number(parsed.window) || 0),
      };
    }
    const numeric = Math.max(0, Number(stored) || 0);
    return { container: numeric, window: numeric };
  } catch {
    const numeric = Math.max(0, Number(sessionStorage.getItem(storageKey)) || 0);
    return { container: numeric, window: numeric };
  }
}

function writeScrollPayload(storageKey, node) {
  try {
    const payload = {
      container: Math.max(0, Number(node?.scrollTop) || 0),
      window: Math.max(
        0,
        Number(window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0) || 0
      ),
    };
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {}
}

export function persistCurrentPageScroll(namespace) {
  if (typeof window === "undefined") return;
  const query = new URLSearchParams(window.location.search || "").toString();
  const storageKey = buildPageMemoryKey(namespace, window.location.pathname, query);
  const node = document.querySelector(`[data-page-scroll-memory="${namespace}"]`);
  writeScrollPayload(storageKey, node);
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
    node.dataset.pageScrollMemory = namespace;

    const persist = () => {
      writeScrollPayload(storageKey, node);
    };

    const persistOnDocumentInteraction = () => {
      persist();
    };

    const persistOnVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    node.addEventListener("scroll", persist, { passive: true });
    window.addEventListener("scroll", persist, { passive: true });
    document.addEventListener("pointerdown", persistOnDocumentInteraction, true);
    document.addEventListener("click", persistOnDocumentInteraction, true);
    document.addEventListener("visibilitychange", persistOnVisibilityChange);
    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      node.removeEventListener("scroll", persist);
      window.removeEventListener("scroll", persist);
      document.removeEventListener("pointerdown", persistOnDocumentInteraction, true);
      document.removeEventListener("click", persistOnDocumentInteraction, true);
      document.removeEventListener("visibilitychange", persistOnVisibilityChange);
      window.removeEventListener("pagehide", persist);
    };
  }, [namespace, storageKey]);

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
      const payload = readScrollPayload(storageKey);
      if (!payload) return;
      const target = Math.max(payload.container, payload.window);
      lastAppliedScrollRef.current = target;
      if (payload.container > 0 || target === 0) {
        node.scrollTop = payload.container;
      }
      if (payload.window > 0 || target === 0) {
        window.scrollTo(0, payload.window);
      }
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
