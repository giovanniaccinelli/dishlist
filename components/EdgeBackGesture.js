"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const EDGE_WIDTH = 26;
const TRIGGER_DISTANCE = 86;
const MAX_VERTICAL_DRIFT = 70;

export default function EdgeBackGesture() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isNative = window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === "ios";
    if (!isNative) return;
    if (pathname === "/" || pathname === "/feed" || pathname === "/onboarding") return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let triggered = false;

    const isInteractiveTarget = (target) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "button,a,input,textarea,select,[role='button'],[data-no-drag='true'],[data-no-edge-back='true']"
        )
      );
    };

    const touchStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_WIDTH) return;
      if (isInteractiveTarget(event.target)) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      triggered = false;
    };

    const touchMove = (event) => {
      if (!tracking || triggered || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dy > MAX_VERTICAL_DRIFT) {
        tracking = false;
        return;
      }
      if (dx > TRIGGER_DISTANCE && dx > dy * 1.45) {
        triggered = true;
        tracking = false;
        event.preventDefault();
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }
    };

    const touchEnd = () => {
      tracking = false;
      triggered = false;
    };

    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
    };
  }, [pathname, router]);

  return null;
}
