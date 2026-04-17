"use client";

import { AnimatePresence, motion } from "framer-motion";

const VARIANT_STYLES = {
  success:
    "border-[#1D8C49]/30 bg-[linear-gradient(180deg,rgba(26,123,65,0.96)_0%,rgba(37,155,84,0.96)_100%)] text-white shadow-[0_18px_38px_rgba(22,93,50,0.28)]",
  error:
    "border-[#C75A5A]/35 bg-[linear-gradient(180deg,rgba(164,54,54,0.96)_0%,rgba(197,77,77,0.96)_100%)] text-white shadow-[0_18px_38px_rgba(120,34,34,0.24)]",
  neutral:
    "border-black/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,243,236,0.96)_100%)] text-black shadow-[0_18px_38px_rgba(0,0,0,0.12)]",
};

export default function AppToast({ message, variant = "success" }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className="pointer-events-none fixed inset-x-4 top-24 z-[110] flex justify-center"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div
            className={`min-w-[12rem] max-w-md rounded-[1.15rem] border px-4 py-3 text-center text-[0.92rem] font-semibold tracking-[0.01em] backdrop-blur-md ${VARIANT_STYLES[variant] || VARIANT_STYLES.success}`}
          >
            {message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
