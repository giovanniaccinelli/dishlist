"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert, Info, Sparkles } from "lucide-react";

const VARIANT_STYLES = {
  success:
    "bg-[linear-gradient(180deg,rgba(15,24,20,0.94)_0%,rgba(22,37,30,0.94)_100%)] text-white shadow-[0_24px_54px_rgba(0,0,0,0.28)]",
  error:
    "bg-[linear-gradient(180deg,rgba(33,20,20,0.95)_0%,rgba(53,26,26,0.95)_100%)] text-white shadow-[0_24px_54px_rgba(0,0,0,0.28)]",
  neutral:
    "bg-[linear-gradient(180deg,rgba(255,252,246,0.96)_0%,rgba(247,241,232,0.96)_100%)] text-black shadow-[0_22px_48px_rgba(0,0,0,0.14)]",
  swipe:
    "bg-[linear-gradient(180deg,rgba(9,18,13,0.98)_0%,rgba(15,32,22,0.98)_100%)] text-white shadow-[0_22px_58px_rgba(43,211,107,0.22),0_18px_42px_rgba(0,0,0,0.28)] border-2 border-[#2BD36B]/45",
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
  swipe: "bg-[#2BD36B] text-black",
};

const SUCCESS_PARTICLES = [
  { x: -118, y: -18, delay: 0.02, size: 7, color: "#2BD36B" },
  { x: -74, y: -48, delay: 0.05, size: 5, color: "#FFE06B" },
  { x: -30, y: -62, delay: 0.08, size: 6, color: "#7CF0A5" },
  { x: 38, y: -58, delay: 0.03, size: 5, color: "#FF6B5F" },
  { x: 86, y: -36, delay: 0.07, size: 7, color: "#2BD36B" },
  { x: 126, y: -4, delay: 0.1, size: 5, color: "#FFE06B" },
];

export default function AppToast({ message, variant = "success" }) {
  const Icon = VARIANT_ICON[variant] || Check;
  const isCelebration = variant === "success" || variant === "swipe";

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className={`pointer-events-none fixed inset-x-4 z-[110] flex justify-center ${variant === "swipe" ? "top-[6.6rem]" : "top-24"}`}
          initial={{ opacity: 0, y: -28, scale: isCelebration ? 0.78 : 0.96, rotate: isCelebration ? -1.5 : 0 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: -18, scale: 0.96 }}
          transition={isCelebration ? { type: "spring", stiffness: 540, damping: 22, mass: 0.8 } : { duration: 0.2, ease: "easeOut" }}
        >
          <div
            className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] backdrop-blur-xl ${
              variant === "swipe" ? "max-w-[23rem] px-5 py-4" : "max-w-[22rem] px-4 py-3.5"
            } ${VARIANT_STYLES[variant] || VARIANT_STYLES.success}`}
          >
            {isCelebration ? (
              <>
                <motion.div
                  className="pointer-events-none absolute inset-y-0 -left-16 w-24 rotate-12 bg-white/24 blur-md"
                  initial={{ x: 0, opacity: 0 }}
                  animate={{ x: 410, opacity: [0, 1, 0] }}
                  transition={{ duration: 0.74, ease: [0.2, 0.7, 0.2, 1] }}
                />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(43,211,107,0.22),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(255,224,107,0.18),transparent_36%)]" />
                {SUCCESS_PARTICLES.map((particle, index) => (
                  <motion.span
                    key={`${particle.x}-${index}`}
                    className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                    style={{ width: particle.size, height: particle.size, backgroundColor: particle.color }}
                    initial={{ x: -4, y: -4, scale: 0, opacity: 0 }}
                    animate={{ x: particle.x, y: particle.y, scale: [0, 1.15, 0.85], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.92, delay: particle.delay, ease: [0.16, 0.85, 0.25, 1] }}
                  />
                ))}
              </>
            ) : null}
            <motion.div
              className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ${
                variant === "swipe" ? "h-10 w-10" : "h-9 w-9"
              } ${VARIANT_ICON_STYLES[variant] || VARIANT_ICON_STYLES.success}`}
              initial={isCelebration ? { scale: 0.45, rotate: -18 } : false}
              animate={isCelebration ? { scale: [0.45, 1.22, 1], rotate: [-18, 8, 0] } : undefined}
              transition={isCelebration ? { duration: 0.48, ease: [0.2, 0.8, 0.2, 1] } : undefined}
            >
              <Icon size={variant === "swipe" ? 19 : 17} strokeWidth={2.7} />
            </motion.div>
            <div className="relative z-10 min-w-0 flex-1 text-left">
              <div className={`${variant === "swipe" ? "text-[1.08rem] font-extrabold" : "text-[0.96rem] font-semibold"} leading-[1.15] tracking-[0.01em]`}>
                {message}
              </div>
            </div>
            {isCelebration ? (
              <motion.div
                className="relative z-10 mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#FFE06B]"
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: [0, 1.08, 1], rotate: [-25, 12, 0] }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Sparkles size={15} strokeWidth={2.4} />
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
