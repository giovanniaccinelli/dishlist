"use client";

let hapticsModulePromise = null;

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
  const hapticsBundle = await getHapticsModule();
  try {
    if (hapticsBundle?.Haptics?.notification && hapticsBundle?.NotificationType?.Error) {
      await hapticsBundle.Haptics.notification({ type: hapticsBundle.NotificationType.Error });
      return;
    }
  } catch {}
  vibrate([18, 35, 18]);
}
