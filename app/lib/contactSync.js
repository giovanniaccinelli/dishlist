"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

export const NativeContactsBridgePlugin = registerPlugin("NativeContactsBridge");

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const normalizePhone = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
};

async function sha256Hex(input) {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createContactHash(type, value) {
  const normalized = type === "phone" ? normalizePhone(value) : normalizeEmail(value);
  if (!normalized) return "";
  const digest = await sha256Hex(`${type}:${normalized}`);
  return digest ? `${type}:${digest}` : "";
}

export async function getIdentityContactHashes({ email = "", phone = "" } = {}) {
  const hashes = await Promise.all([
    email ? createContactHash("email", email) : "",
    phone ? createContactHash("phone", phone) : "",
  ]);
  return Array.from(new Set(hashes.filter(Boolean)));
}

export function isNativeContactsAvailable() {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function getNativeContactsPlugin() {
  return window.Capacitor?.Plugins?.NativeContactsBridge || Capacitor?.Plugins?.NativeContactsBridge || NativeContactsBridgePlugin || null;
}

export async function getNativeContactHashes() {
  if (!isNativeContactsAvailable()) {
    throw new Error("Contact sync needs the next iPhone app build.");
  }
  const plugin = getNativeContactsPlugin();
  if (!plugin?.getContacts) {
    throw new Error("Contact sync is not available in this app build yet.");
  }
  const result = await plugin.getContacts();
  const contacts = Array.isArray(result?.contacts) ? result.contacts : [];
  const values = [];
  contacts.forEach((contact) => {
    (Array.isArray(contact.emails) ? contact.emails : []).forEach((email) => values.push(["email", email]));
    (Array.isArray(contact.phones) ? contact.phones : []).forEach((phone) => values.push(["phone", phone]));
  });
  const hashes = await Promise.all(values.map(([type, value]) => createContactHash(type, value)));
  return Array.from(new Set(hashes.filter(Boolean)));
}
