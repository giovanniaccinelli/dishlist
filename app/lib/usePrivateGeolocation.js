"use client";

import { useEffect, useState } from "react";

const GEOLOCATION_CACHE_KEY = "dishlist:private-geolocation:v1";
const GEOLOCATION_LAST_REQUEST_KEY = "dishlist:private-geolocation:last-request:v1";
const GEOLOCATION_ENABLED_KEY = "dishlist:location-enabled";
const GEOLOCATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GEOLOCATION_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function getStorageValue(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageValue(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

function readCachedLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = getStorageValue(GEOLOCATION_CACHE_KEY);
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
  setStorageValue(GEOLOCATION_CACHE_KEY, JSON.stringify(location));
}

function readLastRequestAt() {
  const value = Number(getStorageValue(GEOLOCATION_LAST_REQUEST_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

function writeLastRequestAt() {
  setStorageValue(GEOLOCATION_LAST_REQUEST_KEY, String(Date.now()));
}

function wasRecentlyAsked() {
  const lastRequestAt = readLastRequestAt();
  return Boolean(lastRequestAt && Date.now() - lastRequestAt < GEOLOCATION_PROMPT_COOLDOWN_MS);
}

async function getGeolocationPermissionState() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result?.state || null;
  } catch {
    return null;
  }
}

export function usePrivateGeolocation({ enabled = false } = {}) {
  const cached = readCachedLocation();
  const [location, setLocation] = useState(cached);
  const [locationEnabled, setLocationEnabled] = useState(() => getStorageValue(GEOLOCATION_ENABLED_KEY) !== "0");
  const [status, setStatus] = useState(
    !enabled || !locationEnabled ? "idle" : cached ? "ready" : "loading"
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePreferenceChange = () => {
      setLocationEnabled(getStorageValue(GEOLOCATION_ENABLED_KEY) !== "0");
    };
    window.addEventListener("dishlist:location-setting-change", handlePreferenceChange);
    window.addEventListener("storage", handlePreferenceChange);
    return () => {
      window.removeEventListener("dishlist:location-setting-change", handlePreferenceChange);
      window.removeEventListener("storage", handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !locationEnabled) {
      setStatus("idle");
      return;
    }
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    const freshCache = readCachedLocation();
    if (freshCache) {
      setLocation(freshCache);
      setStatus("ready");
    }

    let cancelled = false;
    (async () => {
      const permissionState = await getGeolocationPermissionState();
      if (cancelled) return;

      if (permissionState === "denied") {
        setStatus(freshCache ? "ready" : "denied");
        return;
      }

      const canRefreshWithoutPrompt = permissionState === "granted";
      if (!canRefreshWithoutPrompt && wasRecentlyAsked()) {
        setStatus(freshCache ? "ready" : "idle");
        return;
      }

      writeLastRequestAt();
      setStatus(freshCache ? "ready" : "loading");
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
          setStatus(freshCache ? "ready" : "denied");
        },
        {
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: GEOLOCATION_CACHE_TTL_MS,
        }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, locationEnabled]);

  return { location, status };
}
