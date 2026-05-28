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
    "bg-[linear-gradient(180deg,rgba(12,20,16,0.96)_0%,rgba(18,34,25,0.96)_100%)] text-white shadow-[0_18px_42px_rgba(0,0,0,0.24)] border border-[#2BD36B]/28",
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
  swipe: "bg-[#2BD36B]/16 text-[#86F2AB]",
};

export default function AppToast({ message, variant = "success" }) {
  const Icon = VARIANT_ICON[variant] || Check;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className={`pointer-events-none fixed inset-x-4 z-[110] flex justify-center ${variant === "swipe" ? "top-[5.75rem]" : "top-24"}`}
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div
            className={`flex w-full items-center gap-3 rounded-[1.35rem] backdrop-blur-xl ${
              variant === "swipe" ? "max-w-[21rem] px-4 py-3" : "max-w-[22rem] px-4 py-3.5"
            } ${VARIANT_STYLES[variant] || VARIANT_STYLES.success}`}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-full ${
                variant === "swipe" ? "h-8 w-8" : "h-9 w-9"
              } ${VARIANT_ICON_STYLES[variant] || VARIANT_ICON_STYLES.success}`}
            >
              <Icon size={variant === "swipe" ? 16 : 17} strokeWidth={2.7} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className={`${variant === "swipe" ? "text-[0.98rem] font-semibold" : "text-[0.96rem] font-semibold"} leading-[1.15] tracking-[0.01em]`}>
                {message}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
