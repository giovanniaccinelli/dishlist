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
};

const VARIANT_ICON = {
  success: Check,
  error: CircleAlert,
  neutral: Info,
};

const VARIANT_ICON_STYLES = {
  success: "bg-[#2BD36B]/18 text-[#7CF0A5]",
  error: "bg-[#FF8F8F]/14 text-[#FF9D9D]",
  neutral: "bg-black/8 text-black/68",
};

export default function AppToast({ message, variant = "success" }) {
  const Icon = VARIANT_ICON[variant] || Check;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className="pointer-events-none fixed inset-x-4 top-24 z-[110] flex justify-center"
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div
            className={`flex w-full max-w-[22rem] items-center gap-3 rounded-[1.35rem] px-4 py-3.5 backdrop-blur-xl ${VARIANT_STYLES[variant] || VARIANT_STYLES.success}`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${VARIANT_ICON_STYLES[variant] || VARIANT_ICON_STYLES.success}`}
            >
              <Icon size={17} strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[0.96rem] font-semibold leading-[1.15] tracking-[0.01em]">
                {message}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
