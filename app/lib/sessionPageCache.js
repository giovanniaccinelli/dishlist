"use client";

const pageCache = new Map();

export function getSessionPageCache(key) {
  if (!key) return null;
  return pageCache.get(key) || null;
}

export function setSessionPageCache(key, value) {
  if (!key) return;
  pageCache.set(key, { value, cachedAt: Date.now() });
}

export function deleteSessionPageCache(key) {
  if (!key) return;
  pageCache.delete(key);
}

export function clearSessionPageCache(prefix = "") {
  if (!prefix) {
    pageCache.clear();
    return;
  }
  Array.from(pageCache.keys()).forEach((key) => {
    if (String(key).startsWith(prefix)) pageCache.delete(key);
  });
}
