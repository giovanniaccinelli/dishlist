"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export const DISH_MODE_ALL = "all";
export const DISH_MODE_COOKING = "cooking";
export const DISH_MODE_RESTAURANT = "restaurant";

export function TossingPanIcon({ className = "", strokeWidth = 1.9 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.3 13.2c0-2.8 2.2-5 5-5h3.5c2.8 0 5 2.2 5 5v1.4H4.3v-1.4Z" />
      <path d="M17.8 13.9h2.7c.9 0 1.6.7 1.6 1.6v.1" />
      <path d="M8.4 7.1c.4-1 1.1-1.8 2-2.4" />
      <path d="M12 5.6c.4-.8 1-1.5 1.8-2" />
      <path d="M15.3 6.6c.8-.6 1.4-1.4 1.8-2.4" />
      <path d="M7.2 16.2c.6 1.6 2.4 2.8 4.6 2.8s4-1.2 4.6-2.8" />
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

export function dishModeMatches(dish, selectedMode) {
  if (!selectedMode || selectedMode === DISH_MODE_ALL) return true;
  return String(dish?.dishMode || "").toLowerCase() === selectedMode;
}

export function DishModeBadge({ dishMode, className = "" }) {
  if (dishMode === DISH_MODE_COOKING) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-black/65 text-[#F0A623] ${className}`}>
        <TossingPanIcon className="h-4 w-4" />
      </span>
    );
  }
  if (dishMode === DISH_MODE_RESTAURANT) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-black/65 text-[#E64646] ${className}`}>
        <RestaurantMapIcon className="h-4 w-4" />
      </span>
    );
  }
  return null;
}

export function DishModeFilterButton({ value = DISH_MODE_ALL, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`top-action-btn absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${className}`}
      aria-label="Filter dish mode"
    >
      <span className="flex items-center gap-1 text-black">
        <TossingPanIcon className={`h-[1rem] w-[1rem] ${value === DISH_MODE_RESTAURANT ? "text-black/45" : "text-[#F0A623]"}`} />
        <span className="text-[12px] font-bold leading-none text-black/45">/</span>
        <RestaurantMapIcon className={`h-[1rem] w-[1rem] ${value === DISH_MODE_COOKING ? "text-black/45" : "text-[#E64646]"}`} />
      </span>
    </button>
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
                <TossingPanIcon className="mx-auto h-8 w-8 text-[#F0A623]" />
                <div className="mt-2 text-sm font-semibold text-black">Cooking</div>
              </button>
              <button
                type="button"
                onClick={() => onSelect(DISH_MODE_RESTAURANT)}
                className={`rounded-[1.45rem] border-2 px-4 py-4 text-center ${value === DISH_MODE_RESTAURANT ? "border-[#E64646] bg-[#FFE7E7]" : "border-black/10 bg-[#FFFDFC]"}`}
              >
                <RestaurantMapIcon className="mx-auto h-8 w-8 text-[#E64646]" />
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
