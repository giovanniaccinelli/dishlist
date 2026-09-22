"use client";

let hapticsModulePromise = null;
const HAPTICS_ENABLED_KEY = "dishlist:haptics-enabled";

function hapticsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HAPTICS_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

function canVibrate() {
  return typeof window !== "undefined" && typeof window.navigator?.vibrate === "function";
}

function vibrate(pattern) {
  if (!canVibrate()) return;
  try {
    window.navigator.vibrate(pattern);
  } catch {}
}

async function getHapticsModule() {
  if (typeof window === "undefined") return null;
  if (!hapticsModulePromise) {
    hapticsModulePromise = import("@capacitor/haptics").catch(() => null);
  }
  return hapticsModulePromise;
}

export async function hapticSelection() {
  if (!hapticsEnabled()) return;
  const hapticsBundle = await getHapticsModule();
  try {
    if (hapticsBundle?.Haptics?.selectionChanged) {
      await hapticsBundle.Haptics.selectionChanged();
      return;
    }
  } catch {}
  vibrate(8);
}

export async function hapticImpact(style = "light") {
  if (!hapticsEnabled()) return;
  const hapticsBundle = await getHapticsModule();
  const impactStyle = {
    light: hapticsBundle?.ImpactStyle?.Light,
    medium: hapticsBundle?.ImpactStyle?.Medium,
    heavy: hapticsBundle?.ImpactStyle?.Heavy,
  }[style] || hapticsBundle?.ImpactStyle?.Light;
  try {
    if (hapticsBundle?.Haptics?.impact && impactStyle) {
      await hapticsBundle.Haptics.impact({ style: impactStyle });
      return;
    }
  } catch {}
  vibrate(style === "heavy" ? 22 : style === "medium" ? 16 : 10);
}

export async function hapticSuccess() {
  if (!hapticsEnabled()) return;
  const hapticsBundle = await getHapticsModule();
  try {
    if (hapticsBundle?.Haptics?.notification && hapticsBundle?.NotificationType?.Success) {
      await hapticsBundle.Haptics.notification({ type: hapticsBundle.NotificationType.Success });
      return;
    }
  } catch {}
  vibrate([10, 30, 14]);
}

export async function hapticError() {
  if (!hapticsEnabled()) return;
  const hapticsBundle = await getHapticsModule();
  try {
    if (hapticsBundle?.Haptics?.notification && hapticsBundle?.NotificationType?.Error) {
      await hapticsBundle.Haptics.notification({ type: hapticsBundle.NotificationType.Error });
      return;
    }
  } catch {}
  vibrate([18, 35, 18]);
}
