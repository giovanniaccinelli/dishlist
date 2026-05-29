"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Croissant, Martini, Moon, Sandwich, Utensils, X } from "lucide-react";

export const STORY_MEAL_TAG_OPTIONS = [
  { id: "pranzo", it: "Pranzo", en: "Lunch", color: "#E4B43F", bg: "#251D0B", text: "#F8D96B", icon: Utensils },
  { id: "cena", it: "Cena", en: "Dinner", color: "#E54848", bg: "#2A1010", text: "#FF9F9F", icon: Moon },
  { id: "snack", it: "Snack", en: "Snack", color: "#35C96F", bg: "#0D2617", text: "#8AF0B0", icon: Sandwich },
  { id: "aperitivo", it: "Aperitivo", en: "Aperitivo", color: "#B56BFF", bg: "#21112F", text: "#D9B7FF", icon: Martini },
  { id: "colazione", it: "Colazione", en: "Breakfast", color: "#FF7A45", bg: "#2B150C", text: "#FFB28F", icon: Croissant },
  { id: "altro", it: "Altro", en: "Other", color: "#8EA2B8", bg: "#141B23", text: "#D5E0EB", icon: Clock3 },
];

export function normalizeStoryMealTag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return STORY_MEAL_TAG_OPTIONS.some((option) => option.id === normalized) ? normalized : "";
}

export function getStoryMealTagOption(value) {
  const id = normalizeStoryMealTag(value);
  return STORY_MEAL_TAG_OPTIONS.find((option) => option.id === id) || null;
}

export function getStoryMealTagLabel(value, language = "it", { showOther = true } = {}) {
  const id = normalizeStoryMealTag(value);
  if (!id || (id === "altro" && !showOther)) return "";
  const option = STORY_MEAL_TAG_OPTIONS.find((item) => item.id === id);
  if (!option) return "";
  return language === "it" ? option.it : option.en;
}

export default function StoryMealTagModal({
  open,
  onClose,
  onSelect,
  language = "it",
  darkMode = true,
}) {
  const title = language === "it" ? "Tag storia" : "Story tag";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full max-w-sm rounded-[1.45rem] border p-4 shadow-2xl ${
              darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-white text-black"
            }`}
            initial={{ y: 30, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[1.35rem] font-semibold leading-tight">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                  darkMode ? "border-white/12 bg-white/8 text-white/72" : "border-black/10 bg-black/5 text-black/58"
                }`}
                aria-label="Close meal tag picker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {STORY_MEAL_TAG_OPTIONS.map((option) => {
                const Icon = option.icon;
                const label = language === "it" ? option.it : option.en;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect?.(option.id)}
                    className="flex min-h-[3.05rem] items-center gap-2.5 rounded-full border px-3 text-left transition active:scale-[0.98]"
                    style={{
                      backgroundColor: darkMode ? option.bg : "#FFFFFF",
                      borderColor: `${option.color}BF`,
                      color: darkMode ? option.text : "#111111",
                      boxShadow: darkMode ? "none" : `0 8px 18px ${option.color}18`,
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: `${option.color}66`,
                        backgroundColor: darkMode ? "rgba(255,255,255,0.06)" : `${option.color}22`,
                        color: darkMode ? option.text : "#111111",
                      }}
                    >
                      <Icon size={15} strokeWidth={2.35} />
                    </span>
                    <span className="min-w-0 text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
