"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Utensils, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

export const DISH_MODE_ALL = "all";
export const DISH_MODE_COOKING = "cooking";
export const DISH_MODE_RESTAURANT = "restaurant";
const GLOBAL_DISH_MODE_KEY = "dish-mode:global";
const OPENING_CHOICE_KEY = "dish-mode:opening-choice-shown";
let openingChoiceShownThisRuntime = false;

export function setGlobalDishMode(mode) {
  if (typeof window === "undefined") return;
  const nextMode = [DISH_MODE_ALL, DISH_MODE_COOKING, DISH_MODE_RESTAURANT].includes(mode) ? mode : DISH_MODE_RESTAURANT;
  try {
    window.localStorage.setItem(GLOBAL_DISH_MODE_KEY, nextMode);
    window.dispatchEvent(new CustomEvent("dish-mode:change", { detail: nextMode }));
  } catch {}
}

export function hasChosenOpeningDishMode() {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(OPENING_CHOICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOpeningDishModeChosen() {
  if (typeof window === "undefined") return;
  try {
    openingChoiceShownThisRuntime = true;
    window.sessionStorage.setItem(OPENING_CHOICE_KEY, "1");
  } catch {}
}

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

export function RestaurantForkKnifeIcon({ className = "", strokeWidth = 1.95 }) {
  return <Utensils className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function dishModeMatches(dish, selectedMode) {
  if (!selectedMode || selectedMode === DISH_MODE_ALL) return true;
  return String(dish?.dishMode || "").toLowerCase() === selectedMode;
}

export function usePersistentDishMode(storageKey, defaultMode = DISH_MODE_RESTAURANT) {
  const initialMode = defaultMode === DISH_MODE_ALL ? DISH_MODE_RESTAURANT : defaultMode;
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = String(window.localStorage.getItem(GLOBAL_DISH_MODE_KEY) || "").trim().toLowerCase();
      if (
        stored === DISH_MODE_ALL ||
        stored === DISH_MODE_COOKING ||
        stored === DISH_MODE_RESTAURANT
      ) {
        setMode(stored);
      } else {
        setMode(DISH_MODE_RESTAURANT);
        window.localStorage.setItem(GLOBAL_DISH_MODE_KEY, DISH_MODE_RESTAURANT);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setGlobalDishMode(mode || DISH_MODE_RESTAURANT);
    } catch {}
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleModeChange = (event) => {
      const nextMode = String(event?.detail || window.localStorage.getItem(GLOBAL_DISH_MODE_KEY) || "").trim().toLowerCase();
      if ([DISH_MODE_ALL, DISH_MODE_COOKING, DISH_MODE_RESTAURANT].includes(nextMode)) {
        setMode(nextMode);
      }
    };
    window.addEventListener("dish-mode:change", handleModeChange);
    window.addEventListener("storage", handleModeChange);
    return () => {
      window.removeEventListener("dish-mode:change", handleModeChange);
      window.removeEventListener("storage", handleModeChange);
    };
  }, []);

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
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || openingChoiceShownThisRuntime) return;
    const alreadyShown = window.sessionStorage.getItem(OPENING_CHOICE_KEY) === "1";
    openingChoiceShownThisRuntime = true;
    if (!alreadyShown) {
      window.sessionStorage.setItem(OPENING_CHOICE_KEY, "1");
      onSelect?.(DISH_MODE_RESTAURANT);
      setPickerOpen(true);
    }
  }, [onSelect]);

  return (
    <div className={`relative ${className}`} aria-label="Filter dish mode">
      <button
        type="button"
        onClick={() => {
          onClick?.();
          setPickerOpen(true);
        }}
        className="dish-mode-logo-button no-accent-border flex h-[3.45rem] w-[4.15rem] min-w-[4.15rem] items-center justify-center rounded-[1.05rem] border border-white/12 bg-black/72 p-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md"
        aria-label="Open dish mode selection"
      >
        <img src="/logo-real.png" alt="" className="h-full w-full object-contain" />
      </button>
      <DishModeFilterModal
        open={pickerOpen}
        value={value}
        onClose={() => setPickerOpen(false)}
        onSelect={(mode) => {
          onSelect?.(mode);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

export function DishModeFilterModal({ open, value = DISH_MODE_ALL, onClose, onSelect }) {
  const choices = [
    { mode: DISH_MODE_RESTAURANT, label: "Ristorante", cropY: 194, icon: <RestaurantForkKnifeIcon className="h-[1.66rem] w-[1.66rem]" strokeWidth={2.25} /> },
    { mode: DISH_MODE_COOKING, label: "Home", cropY: 355, icon: <CookingHomeIcon className="h-[2.02rem] w-[2.02rem]" strokeWidth={2.2} /> },
    { mode: DISH_MODE_ALL, label: "Non so", cropY: 516, icon: null },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[24rem]"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="text-[1.65rem] font-bold leading-none text-white">Dove vuoi mangiare?</div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70"
                aria-label="Close dish mode filter"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {choices.map((choice) => {
                const selected = value === choice.mode;
                return (
                  <DishModeChoiceLine key={choice.mode} choice={choice} selected={selected} onClick={() => onSelect(choice.mode)} />
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DishModeChoiceLine({ choice, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-[6.15rem] w-full text-left transition active:scale-[0.985]"
    >
      <svg
        viewBox={`150 ${choice.cropY} 670 116`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <image href="/logo-real.png" x="0" y="0" width="953" height="953" />
      </svg>
      <span className="absolute left-[1.16rem] top-[54%] flex h-12 w-12 -translate-y-1/2 items-center justify-center text-[#050505]">
        {choice.icon}
      </span>
      <span className="absolute inset-y-0 left-[8.15rem] right-9 flex items-center">
        <span className="translate-y-[0.24rem] truncate text-[1.54rem] font-bold leading-[0.95] text-[#050505]">{choice.label}</span>
      </span>
    </button>
  );
}

export function DiningModeOpeningSelection({ className = "", onSelect }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(DISH_MODE_RESTAURANT);
  const choices = [
    { mode: DISH_MODE_RESTAURANT, label: "Ristorante", cropY: 194, icon: <RestaurantForkKnifeIcon className="h-[1.66rem] w-[1.66rem]" strokeWidth={2.25} /> },
    { mode: DISH_MODE_COOKING, label: "Home", cropY: 355, icon: <CookingHomeIcon className="h-[2.02rem] w-[2.02rem]" strokeWidth={2.2} /> },
    { mode: DISH_MODE_ALL, label: "Non so", cropY: 516, icon: null },
  ];

  const choose = (nextMode) => {
    setMode(nextMode);
    setGlobalDishMode(nextMode);
    markOpeningDishModeChosen();
    onSelect?.(nextMode);
  };

  return (
    <div className={`w-full max-w-[27rem] ${className}`}>
      <div className="mb-5 text-center text-[1.65rem] font-bold leading-none text-white">{t("Dove vuoi mangiare?")}</div>
      <div className="space-y-3">
        {choices.map((choice) => (
          <DishModeChoiceLine
            key={choice.mode}
            choice={choice}
            selected={mode === choice.mode}
            onClick={() => choose(choice.mode)}
          />
        ))}
      </div>
    </div>
  );
}
