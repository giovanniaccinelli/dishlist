"use client";

import { Capacitor } from "@capacitor/core";
import { auth, db } from "./firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

function getNativePushPlugin() {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.NativePushBridge || Capacitor?.Plugins?.NativePushBridge || null;
}

function makeTokenDocId(token) {
  return String(token || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 180);
}

export function isNativePushSupported() {
  return Capacitor.isNativePlatform() && Boolean(getNativePushPlugin());
}

export async function getNativePushPermissionState() {
  if (!isNativePushSupported()) return "unsupported";
  const plugin = getNativePushPlugin();
  const result = await plugin.getPermissionStatus();
  return result?.receive || "prompt";
}

export async function requestNativePushPermission() {
  if (!isNativePushSupported()) return "unsupported";
  const plugin = getNativePushPlugin();
  const result = await plugin.requestPermissions();
  return result?.receive || "denied";
}

export async function registerForNativePush() {
  if (!isNativePushSupported()) return;
  const plugin = getNativePushPlugin();
  await plugin.register();
}

export async function saveNativePushToken(userId, token) {
  if (!userId || !token) return;
  const docId = makeTokenDocId(token);
  await setDoc(
    doc(db, "users", userId, "pushTokens", docId),
    {
      token,
      enabled: true,
      platform: Capacitor.getPlatform(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function disableNativePushToken(userId, token) {
  if (!userId || !token) return;
  const docId = makeTokenDocId(token);
  await setDoc(
    doc(db, "users", userId, "pushTokens", docId),
    {
      token,
      enabled: false,
      platform: Capacitor.getPlatform(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function dispatchPushEvent(type, payload) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/notifications/dispatch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ ...payload, type }),
  });
  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {}
    console.warn("Push dispatch request failed:", response.status, details);
    return null;
  }
  return response.json().catch(() => null);
}

export async function addNativePushListeners(handlers = {}) {
  if (!isNativePushSupported()) return () => {};
  const plugin = getNativePushPlugin();
  const subscriptions = [];

  subscriptions.push(
    await plugin.addListener("registration", (event) => handlers.onRegistration?.(event))
  );
  subscriptions.push(
    await plugin.addListener("registrationError", (event) => handlers.onRegistrationError?.(event))
  );
  subscriptions.push(
    await plugin.addListener("pushNotificationReceived", (event) => handlers.onNotificationReceived?.(event))
  );
  subscriptions.push(
    await plugin.addListener("pushNotificationActionPerformed", (event) => handlers.onNotificationActionPerformed?.(event))
  );

  return () => {
    subscriptions.forEach((subscription) => subscription?.remove?.());
  };
}
