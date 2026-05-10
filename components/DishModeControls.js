"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Utensils, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";

export const DISH_MODE_ALL = "all";
export const DISH_MODE_COOKING = "cooking";
export const DISH_MODE_RESTAURANT = "restaurant";

export function CookingHomeIcon({ className = "", strokeWidth = 1.95 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.7 10.9 12 4.8l7.3 6.1" />
      <path d="M6.8 9.7v8.6c0 .6.5 1.1 1.1 1.1h8.2c.6 0 1.1-.5 1.1-1.1V9.7" />
      <path d="M10.2 19.4v-4.7c0-.6.5-1.1 1.1-1.1h1.4c.6 0 1.1.5 1.1 1.1v4.7" />
    </svg>
  );
}

export function RestaurantMapIcon({ className = "", strokeWidth = 1.9 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.8 6.3 8.1 4.9l4 1.4 4-1.4 4.1 1.4v11.5l-4.1-1.4-4 1.4-4-1.4-4.3 1.4V6.3Z" />
      <path d="M8.1 4.9v11.6" />
      <path d="M12.1 6.3v11.6" />
      <path d="M16.1 4.9v11.6" />
    </svg>
  );
}

export function RestaurantForkKnifeIcon({ className = "", strokeWidth = 1.9 }) {
  return <Utensils className={`scale-x-[0.86] ${className}`} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function dishModeMatches(dish, selectedMode) {
  if (!selectedMode || selectedMode === DISH_MODE_ALL) return true;
  return String(dish?.dishMode || "").toLowerCase() === selectedMode;
}

export function usePersistentDishMode(storageKey, defaultMode = DISH_MODE_ALL) {
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      const stored = String(window.localStorage.getItem(storageKey) || "").trim().toLowerCase();
      if (
        stored === DISH_MODE_ALL ||
        stored === DISH_MODE_COOKING ||
        stored === DISH_MODE_RESTAURANT
      ) {
        setMode(stored);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, mode || DISH_MODE_ALL);
    } catch {}
  }, [mode, storageKey]);

  return [mode, setMode];
}

export function DishModeBadge({ dishMode, className = "" }) {
  if (dishMode === DISH_MODE_COOKING) {
    return (
      <span className={`default-accent-border inline-flex items-center justify-center rounded-full border-2 bg-black/65 text-[#F0A623] ${className}`}>
        <CookingHomeIcon className="h-[1.3rem] w-[1.3rem]" strokeWidth={2.3} />
      </span>
    );
  }
  if (dishMode === DISH_MODE_RESTAURANT) {
    return null;
  }
  return null;
}

export function DishModeFilterButton({ value = DISH_MODE_ALL, onClick, onSelect, className = "" }) {
  const { t, darkMode } = useLanguage();
  const [flashMessage, setFlashMessage] = useState("");
  const [flashMode, setFlashMode] = useState(DISH_MODE_ALL);
  const flashTimerRef = useRef(null);
  const isLarge = className.includes("dish-mode-filter--large");
  const useLargeSize = false;
  const buttonSizeClass = useLargeSize ? "!h-[3.65rem] !w-[4.05rem] !min-w-[4.05rem]" : "!h-[3.1rem] !w-[3.45rem] !min-w-[3.45rem]";
  const iconSizeClass = useLargeSize ? "h-[2.24rem] w-[2.24rem]" : "h-[1.9rem] w-[1.9rem]";

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  const showFlashMessage = (mode) => {
    const nextMessage =
      mode === DISH_MODE_COOKING
        ? t("Eat in")
        : mode === DISH_MODE_RESTAURANT
          ? t("Eat out")
          : t("Show all");
    setFlashMessage(nextMessage);
    setFlashMode(mode);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashMessage(""), 1300);
  };

  const handlePress = (mode) => {
    const nextMode = value === mode ? DISH_MODE_ALL : mode;
    if (typeof onSelect === "function") {
      onSelect(nextMode);
      showFlashMessage(nextMode);
      return;
    }
    onClick?.();
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`} aria-label="Filter dish mode">
      <button
        type="button"
        onClick={() => handlePress(DISH_MODE_COOKING)}
        className={`dish-mode-control-btn dish-mode-control-btn--home ${value === DISH_MODE_COOKING ? "dish-mode-control-btn--selected" : ""} relative ${buttonSizeClass}`}
        aria-label="Filter home dishes"
        style={{
          border: "2px solid #F0A623",
        }}
      >
        <CookingHomeIcon className={iconSizeClass} strokeWidth={1.55} />
      </button>
      <button
        type="button"
        onClick={() => handlePress(DISH_MODE_RESTAURANT)}
        className={`dish-mode-control-btn dish-mode-control-btn--restaurant ${value === DISH_MODE_RESTAURANT ? "dish-mode-control-btn--selected" : ""} relative ${buttonSizeClass}`}
        aria-label="Filter restaurant dishes"
        style={{
          border: "2px solid #E64646",
        }}
      >
        <RestaurantForkKnifeIcon className={iconSizeClass} strokeWidth={1.45} />
      </button>
      <AnimatePresence>
        {flashMessage ? (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-none fixed inset-x-4 z-[120] flex justify-center"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 7.25rem)" }}
          >
            <div
              className={`max-w-[18rem] rounded-[1.15rem] border px-4 py-3 text-center text-[0.84rem] font-semibold leading-[1.15] shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl ${
                darkMode
                  ? flashMode === DISH_MODE_RESTAURANT
                    ? "border-[#E64646]/35 bg-[#1F1010] text-[#FFB7B7]"
                    : flashMode === DISH_MODE_COOKING
                      ? "border-[#F0A623]/35 bg-[#211806] text-[#FFD986]"
                      : "border-white/16 bg-[#151515] text-white/88"
                  : flashMode === DISH_MODE_RESTAURANT
                    ? "border-[#E64646]/20 bg-[linear-gradient(180deg,rgba(255,239,239,0.96)_0%,rgba(255,230,230,0.96)_100%)] text-[#B92E2E]"
                    : flashMode === DISH_MODE_COOKING
                      ? "border-[#F0A623]/25 bg-[linear-gradient(180deg,rgba(255,248,226,0.97)_0%,rgba(255,241,198,0.97)_100%)] text-[#A66A00]"
                      : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(246,246,242,0.97)_100%)] text-black/78"
              }`}
            >
              {flashMessage}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DishModeFilterModal({ open, value = DISH_MODE_ALL, onClose, onSelect }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-xs rounded-[1.8rem] border border-black/10 bg-white p-4 shadow-[0_26px_60px_rgba(0,0,0,0.18)]"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Dish mode</div>
                <div className="mt-1 text-lg font-semibold text-black">Show dishes from</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-black/60"
                aria-label="Close dish mode filter"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelect(DISH_MODE_COOKING)}
                className={`rounded-[1.45rem] border-2 px-4 py-4 text-center ${value === DISH_MODE_COOKING ? "border-[#F0A623] bg-[#FFF5DA]" : "border-black/10 bg-[#FFFDFC]"}`}
              >
                <CookingHomeIcon className="mx-auto h-8 w-8 text-[#F0A623]" />
                <div className="mt-2 text-sm font-semibold text-black">Home</div>
              </button>
              <button
                type="button"
                onClick={() => onSelect(DISH_MODE_RESTAURANT)}
                className={`rounded-[1.45rem] border-2 px-4 py-4 text-center ${value === DISH_MODE_RESTAURANT ? "border-[#E64646] bg-[#FFE7E7]" : "border-black/10 bg-[#FFFDFC]"}`}
              >
                <RestaurantForkKnifeIcon className="mx-auto h-8 w-8 text-[#E64646]" />
                <div className="mt-2 text-sm font-semibold text-black">Restaurant</div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSelect(DISH_MODE_ALL)}
              className={`mt-3 w-full rounded-full border px-4 py-2.5 text-sm font-semibold ${value === DISH_MODE_ALL ? "border-black bg-black text-white" : "border-black/12 bg-white text-black"}`}
            >
              Show all
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
