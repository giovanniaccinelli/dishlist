"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pin, Shuffle, Utensils, X } from "lucide-react";
import { useEffect, useState } from "react";
import { hapticImpact, hapticSelection } from "../app/lib/haptics";
import { useLanguage } from "./LanguageProvider";

export const DISH_MODE_ALL = "all";
export const DISH_MODE_COOKING = "cooking";
export const DISH_MODE_RESTAURANT = "restaurant";
export const SLICE_MODE_STORAGE_KEY = "dishlist:slice-mode";
export const SLICE_MODE_CHANGE_EVENT = "dishlist:slice-mode-change";
const GLOBAL_DISH_MODE_KEY = "dish-mode:global";
const OPENING_CHOICE_KEY = "dish-mode:opening-choice-shown";
const FIXED_DISH_MODE_KEY = "dish-mode:fixed";
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
    if (window.localStorage.getItem(FIXED_DISH_MODE_KEY) === "1") return true;
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

function isDishModeFixed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIXED_DISH_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDishModeFixed(fixed) {
  if (typeof window === "undefined") return;
  try {
    if (fixed) {
      window.localStorage.setItem(FIXED_DISH_MODE_KEY, "1");
      markOpeningDishModeChosen();
    } else {
      window.localStorage.removeItem(FIXED_DISH_MODE_KEY);
    }
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

export function UnknownDishModeIcon({ className = "", strokeWidth = 2.15 }) {
  return <Shuffle className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function isSliceModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SLICE_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSliceModeEnabled(enabled) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLICE_MODE_STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent(SLICE_MODE_CHANGE_EVENT, { detail: enabled ? "1" : "0" }));
  } catch {}
}

export function useSliceModeEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const read = (event) => {
      const nextValue = String(event?.detail || window.localStorage.getItem(SLICE_MODE_STORAGE_KEY) || "0") === "1";
      setEnabled(nextValue);
    };
    read();
    window.addEventListener(SLICE_MODE_CHANGE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SLICE_MODE_CHANGE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return enabled;
}

export function dishModeMatches(dish, selectedMode) {
  if (!selectedMode || selectedMode === DISH_MODE_ALL) return true;
  const mode = String(dish?.dishMode || "").toLowerCase();
  if (selectedMode === DISH_MODE_COOKING) return mode === DISH_MODE_COOKING || mode === "home";
  return mode === selectedMode;
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
    if (isDishModeFixed()) {
      openingChoiceShownThisRuntime = true;
      return;
    }
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
          void hapticSelection();
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
  const [fixedMode, setFixedMode] = useState(false);
  const { t, language } = useLanguage();
  const sliceModeEnabled = useSliceModeEnabled();
  const choices = [
    { mode: DISH_MODE_RESTAURANT, label: t("Restaurants"), cropY: 176, icon: <RestaurantForkKnifeIcon className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.35} /> },
    { mode: DISH_MODE_COOKING, label: t("Recipes"), cropY: 337, icon: <CookingHomeIcon className="h-[1.88rem] w-[1.88rem]" strokeWidth={2.3} /> },
    { mode: DISH_MODE_ALL, label: "Mix", cropY: 497, icon: <UnknownDishModeIcon className="h-[1.55rem] w-[1.55rem]" strokeWidth={2.35} /> },
  ];

  useEffect(() => {
    if (!open) return;
    setFixedMode(isDishModeFixed());
  }, [open]);

  const toggleFixedMode = () => {
    const next = !fixedMode;
    void hapticSelection();
    setFixedMode(next);
    setDishModeFixed(next);
  };

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
            <div className="mb-5 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70"
                aria-label="Close dish mode filter"
              >
                <X size={16} />
              </button>
            </div>
            {sliceModeEnabled ? (
              <SliceDishModeWheel
                choices={choices}
                value={value}
                onSelect={(mode) => {
                  void hapticImpact("light");
                  onSelect(mode);
                }}
              />
            ) : (
              <div className="space-y-3">
                {choices.map((choice) => {
                  const selected = value === choice.mode;
                  return (
                    <DishModeChoiceLine
                      key={choice.mode}
                      choice={choice}
                      selected={selected}
                      fixed={fixedMode}
                      onClick={() => {
                        void hapticImpact("light");
                        onSelect(choice.mode);
                      }}
                    />
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={toggleFixedMode}
              className={`mt-5 flex w-full items-center gap-3 rounded-[1.1rem] border px-4 py-3 text-left transition active:scale-[0.985] ${
                fixedMode
                  ? "border-[#F7D76B]/65 bg-[#F7D76B]/14 text-[#F7D76B]"
                  : "border-white/12 bg-white/7 text-white/70"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${fixedMode ? "bg-[#F7D76B] text-black" : "bg-white/10 text-white/70"}`}>
                <Pin size={16} fill={fixedMode ? "currentColor" : "none"} strokeWidth={2.35} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.98rem] font-bold leading-tight">
                  {fixedMode ? (language === "it" ? "Modalita fissata" : "Mode fixed") : (language === "it" ? "Fissa una modalita" : "Fix a mode")}
                </span>
                <span className="mt-0.5 block text-[0.76rem] font-semibold leading-tight opacity-72">
                  {fixedMode
                    ? (language === "it" ? "Tocca Ristoranti, Ricette o Mix per fissarla." : "Tap Restaurants, Recipes, or Mix to fix it.")
                    : (language === "it" ? "Poi scegli quale: Ristoranti, Ricette o Mix." : "Then choose Restaurants, Recipes, or Mix.")}
                </span>
              </span>
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SliceDishModeWheel({ choices, value, onSelect }) {
  const configByMode = {
    [DISH_MODE_RESTAURANT]: {
      path: "M 106 58 Q 134 28 170 24 Q 200 22 214 40 L 184 192 Q 178 222 146 213 Q 84 195 50 151 Q 30 125 47 101 Z",
      fill: "#F63137",
      dark: "#AA151B",
      glow: "rgba(246,49,55,0.48)",
      center: [118, 118],
      icon: [111, 86],
      label: [118, 135],
      hit: "left-[0.6rem] top-[0.6rem] h-[12.4rem] w-[10.8rem]",
    },
    [DISH_MODE_COOKING]: {
      path: "M 246 40 Q 262 22 292 24 Q 328 28 356 58 L 415 101 Q 432 125 412 151 Q 378 195 316 213 Q 284 222 278 192 Z",
      fill: "#FFC72B",
      dark: "#C97800",
      glow: "rgba(255,199,43,0.42)",
      center: [344, 118],
      icon: [344, 86],
      label: [344, 135],
      hit: "right-[0.6rem] top-[0.6rem] h-[12.4rem] w-[10.8rem]",
    },
    [DISH_MODE_ALL]: {
      path: "M 196 218 Q 231 182 266 218 L 395 289 Q 420 306 409 334 Q 384 395 316 419 Q 231 446 146 419 Q 78 395 53 334 Q 42 306 67 289 Z",
      fill: "#43CE55",
      dark: "#11853A",
      glow: "rgba(67,206,85,0.46)",
      center: [231, 319],
      icon: [231, 281],
      label: [231, 337],
      hit: "left-1/2 top-[9.25rem] h-[11.6rem] w-[19.1rem] -translate-x-1/2",
    },
  };

  return (
    <div className="relative mx-auto h-[18.8rem] w-full max-w-[20.2rem] overflow-visible">
      <svg viewBox="0 0 462 444" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          {choices.map((choice) => {
            const config = configByMode[choice.mode];
            return (
              <linearGradient key={`${choice.mode}-gradient`} id={`slice-mode-gradient-${choice.mode}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={config.fill} />
                <stop offset="72%" stopColor={config.fill} />
                <stop offset="100%" stopColor={config.dark} />
              </linearGradient>
            );
          })}
          <filter id="slice-mode-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000000" floodOpacity="0.36" />
          </filter>
        </defs>
        {choices.map((choice) => {
          const config = configByMode[choice.mode];
          const selected = value === choice.mode;
          return (
            <g key={choice.mode} filter="url(#slice-mode-soft-shadow)">
              <path d={config.path} fill={`url(#slice-mode-gradient-${choice.mode})`} stroke={config.fill} strokeWidth={selected ? 10 : 7} strokeLinejoin="round" />
              <path d={config.path} fill="none" stroke={config.dark} strokeWidth="8" strokeLinejoin="round" opacity="0.32" transform="translate(0 6)" />
              <path d={config.path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" strokeLinejoin="round" transform="translate(0 -5)" />
            </g>
          );
        })}
      </svg>
      {choices.map((choice) => {
        const config = configByMode[choice.mode];
        return (
          <button
            key={choice.mode}
            type="button"
            onClick={() => onSelect(choice.mode)}
            className={`absolute z-10 transition active:scale-[0.985] ${config.hit}`}
            aria-label={choice.label}
          />
        );
      })}
      {choices.map((choice) => {
        const config = configByMode[choice.mode];
        return (
          <div key={`${choice.mode}-label`} className="pointer-events-none absolute inset-0">
            <div className="absolute grid h-12 w-12 place-items-center" style={{ left: `${config.icon[0] / 4.62}%`, top: `${config.icon[1] / 4.44}%`, transform: "translate(-50%, -50%)", color: "#050505" }}>
              {choice.icon}
            </div>
            <div className="absolute w-[8rem] -translate-x-1/2 text-center text-[1.18rem] font-black leading-none tracking-[-0.01em]" style={{ left: `${config.label[0] / 4.62}%`, top: `${config.label[1] / 4.44}%`, color: "#050505" }}>
              {choice.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DishModeChoiceLine({ choice, onClick, selected = false, fixed = false }) {
  const fixedSelected = selected && fixed;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-[5.35rem] w-full text-left transition active:scale-[0.985] ${
        fixed && !selected ? "opacity-55" : ""
      }`}
    >
      {fixedSelected ? (
        <span className="pointer-events-none absolute -left-1.5 top-1/2 z-[4] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#F7D76B] text-black shadow-[0_8px_22px_rgba(0,0,0,0.38)]">
          <Pin size={17} fill="currentColor" strokeWidth={2.4} />
        </span>
      ) : null}
      <svg
        viewBox={`150 ${choice.cropY} 670 150`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <image href="/logo-real.png" x="0" y="0" width="953" height="953" />
      </svg>
      <span className="absolute left-[1.42rem] top-[53%] flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[#050505]">
        {choice.icon}
      </span>
      <span className={`absolute inset-y-0 left-[7.15rem] flex items-center ${fixedSelected ? "right-[7.4rem]" : "right-8"}`}>
        <span className="translate-y-[0.2rem] truncate text-[1.34rem] font-bold leading-[0.95] text-[#17110A] antialiased [text-shadow:0_1px_0_rgba(255,255,255,0.18),0_1.5px_2px_rgba(0,0,0,0.12)]">{choice.label}</span>
      </span>
      {fixedSelected ? (
        <span className="pointer-events-none absolute right-5 top-1/2 z-[3] flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#F7D76B] px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.04em] text-black shadow-[0_6px_14px_rgba(0,0,0,0.22)]">
          Fissata
        </span>
      ) : null}
    </button>
  );
}

export function DiningModeOpeningSelection({ className = "", onSelect, intro = false }) {
  const { t } = useLanguage();
  const sliceModeEnabled = useSliceModeEnabled();
  const [mode, setMode] = useState(DISH_MODE_RESTAURANT);
  const [introVisible, setIntroVisible] = useState(Boolean(intro));
  const [closingMode, setClosingMode] = useState(null);
  const choices = [
    { mode: DISH_MODE_RESTAURANT, label: t("Restaurants"), cropY: 176, icon: <RestaurantForkKnifeIcon className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.35} /> },
    { mode: DISH_MODE_COOKING, label: t("Recipes"), cropY: 337, icon: <CookingHomeIcon className="h-[1.88rem] w-[1.88rem]" strokeWidth={2.3} /> },
    { mode: DISH_MODE_ALL, label: "Mix", cropY: 497, icon: <UnknownDishModeIcon className="h-[1.55rem] w-[1.55rem]" strokeWidth={2.35} /> },
  ];

  useEffect(() => {
    if (!intro) return undefined;
    setIntroVisible(true);
    const timeout = window.setTimeout(() => setIntroVisible(false), 520);
    return () => window.clearTimeout(timeout);
  }, [intro]);

  useEffect(() => {
    if (!closingMode) return undefined;
    const timeout = window.setTimeout(() => onSelect?.(closingMode), 520);
    return () => window.clearTimeout(timeout);
  }, [closingMode, onSelect]);

  const choose = (nextMode) => {
    if (closingMode) return;
    void hapticImpact("medium");
    setMode(nextMode);
    setGlobalDishMode(nextMode);
    markOpeningDishModeChosen();
    setClosingMode(nextMode);
  };

  const selector = (
    <motion.div
      key="selector"
      initial={intro ? { opacity: 0, scale: 0.42 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.42 }}
      transition={{ type: "spring", stiffness: 230, damping: 24, mass: 0.82 }}
      className="w-full"
    >
      {sliceModeEnabled ? (
        <SliceDishModeWheel choices={choices} value={mode} onSelect={choose} />
      ) : (
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
      )}
    </motion.div>
  );

  const logo = (
    <motion.div
      key="logo"
      className="flex h-[19rem] items-center justify-center"
      initial={{ opacity: 0, scale: introVisible ? 0.82 : 1.18 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.22 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <motion.img
        src="/logo-real.png"
        alt="DishList"
        className="h-36 w-36 object-contain"
        animate={{ scale: [1, 0.94, 1] }}
        transition={{ duration: 1.45, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );

  return (
    <div className={`w-full max-w-[24rem] ${className}`}>
      {intro ? (
        <AnimatePresence mode="wait">
          {introVisible || closingMode ? (
            logo
          ) : (
            selector
          )}
        </AnimatePresence>
      ) : (
        selector
      )}
    </div>
  );
}
