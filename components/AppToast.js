"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert, Info } from "lucide-react";

const VARIANT_STYLES = {
  success:
    "bg-[linear-gradient(180deg,rgba(15,24,20,0.94)_0%,rgba(22,37,30,0.94)_100%)] text-white shadow-[0_24px_54px_rgba(0,0,0,0.28)]",
  error:
    "bg-[linear-gradient(180deg,rgba(33,20,20,0.95)_0%,rgba(53,26,26,0.95)_100%)] text-white shadow-[0_24px_54px_rgba(0,0,0,0.28)]",
  neutral:
    "bg-[linear-gradient(180deg,rgba(255,252,246,0.96)_0%,rgba(247,241,232,0.96)_100%)] text-black shadow-[0_22px_48px_rgba(0,0,0,0.14)]",
  swipe:
    "bg-[linear-gradient(135deg,rgba(18,53,31,0.98)_0%,rgba(31,164,99,0.98)_58%,rgba(43,211,107,0.98)_100%)] text-white shadow-[0_28px_70px_rgba(43,211,107,0.34)] ring-2 ring-[#7CF0A5]/45",
};

const VARIANT_ICON = {
  success: Check,
  error: CircleAlert,
  neutral: Info,
  swipe: Check,
};

const VARIANT_ICON_STYLES = {
  success: "bg-[#2BD36B]/18 text-[#7CF0A5]",
  error: "bg-[#FF8F8F]/14 text-[#FF9D9D]",
  neutral: "bg-black/8 text-black/68",
  swipe: "bg-black/18 text-white",
};

export default function AppToast({ message, variant = "success" }) {
  const Icon = VARIANT_ICON[variant] || Check;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className={`pointer-events-none fixed inset-x-4 z-[110] flex justify-center ${variant === "swipe" ? "top-20" : "top-24"}`}
          initial={{ opacity: 0, y: variant === "swipe" ? -28 : -18, scale: variant === "swipe" ? 0.84 : 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: variant === "swipe" ? -24 : -16, scale: 0.98 }}
          transition={variant === "swipe" ? { type: "spring", stiffness: 520, damping: 24 } : { duration: 0.2, ease: "easeOut" }}
        >
          <div
            className={`flex w-full items-center gap-3 rounded-[1.35rem] backdrop-blur-xl ${
              variant === "swipe" ? "max-w-[25rem] px-5 py-[1.125rem]" : "max-w-[22rem] px-4 py-3.5"
            } ${VARIANT_STYLES[variant] || VARIANT_STYLES.success}`}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-full ${
                variant === "swipe" ? "h-11 w-11" : "h-9 w-9"
              } ${VARIANT_ICON_STYLES[variant] || VARIANT_ICON_STYLES.success}`}
            >
              <Icon size={variant === "swipe" ? 21 : 17} strokeWidth={2.7} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className={`${variant === "swipe" ? "text-[1.18rem] font-black" : "text-[0.96rem] font-semibold"} leading-[1.15] tracking-[0.01em]`}>
                {message}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
