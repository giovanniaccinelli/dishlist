"use client";

import { useEffect, useState } from "react";

const GEOLOCATION_CACHE_KEY = "dishlist:private-geolocation:v1";
const GEOLOCATION_CACHE_TTL_MS = 20 * 60 * 1000;

function readCachedLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GEOLOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    const accuracy = Number(parsed?.accuracy || 0);
    const timestamp = Number(parsed?.timestamp || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) return null;
    if (Date.now() - timestamp > GEOLOCATION_CACHE_TTL_MS) return null;
    return { lat, lng, accuracy, timestamp };
  } catch {
    return null;
  }
}

function writeCachedLocation(location) {
  if (typeof window === "undefined" || !location) return;
  try {
    window.sessionStorage.setItem(GEOLOCATION_CACHE_KEY, JSON.stringify(location));
  } catch {}
}

export function usePrivateGeolocation({ enabled = false } = {}) {
  const cached = readCachedLocation();
  const [location, setLocation] = useState(cached);
  const [status, setStatus] = useState(
    !enabled ? "idle" : cached ? "ready" : "loading"
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    if (typeof window === "undefined" || !navigator?.geolocation) {
      setStatus("unsupported");
      return;
    }

    const freshCache = readCachedLocation();
    if (freshCache) {
      setLocation(freshCache);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const nextLocation = {
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
          accuracy: Number(position.coords.accuracy || 0),
          timestamp: Number(position.timestamp || Date.now()),
        };
        setLocation(nextLocation);
        setStatus("ready");
        writeCachedLocation(nextLocation);
      },
      () => {
        if (cancelled) return;
        setStatus("denied");
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: GEOLOCATION_CACHE_TTL_MS,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { location, status };
}
