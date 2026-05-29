"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Coffee, Croissant, Moon, Sandwich, Sparkles, Utensils, X } from "lucide-react";

export const STORY_MEAL_TAG_OPTIONS = [
  { id: "pranzo", it: "Pranzo", en: "Lunch", color: "#FFD34D", icon: Utensils },
  { id: "cena", it: "Cena", en: "Dinner", color: "#E64646", icon: Moon },
  { id: "snack", it: "Snack", en: "Snack", color: "#23C268", icon: Sandwich },
  { id: "aperitivo", it: "Aperitivo", en: "Aperitivo", color: "#FF8A3D", icon: Coffee },
  { id: "colazione", it: "Colazione", en: "Breakfast", color: "#F8B84E", icon: Croissant },
  { id: "altro", it: "Altro", en: "Other", color: "#A0A7B4", icon: Sparkles },
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
  const title = language === "it" ? "Quando lo mangi?" : "When are you eating it?";
  const subtitle = language === "it"
    ? "Questo tag apparira al posto dell'orario nella storia."
    : "This tag will replace the upload time in the story.";

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
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold leading-tight">{title}</h3>
                <p className={`mt-1 text-sm ${darkMode ? "text-white/56" : "text-black/52"}`}>{subtitle}</p>
              </div>
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

            <div className="grid grid-cols-2 gap-2.5">
              {STORY_MEAL_TAG_OPTIONS.map((option) => {
                const Icon = option.icon;
                const label = language === "it" ? option.it : option.en;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect?.(option.id)}
                    className="flex min-h-[3.35rem] items-center gap-2.5 rounded-[1rem] px-3 text-left text-black shadow-[inset_0_-1px_0_rgba(0,0,0,0.14)] transition active:scale-[0.98]"
                    style={{ backgroundColor: option.color }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/12 text-black">
                      <Icon size={17} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 text-sm font-extrabold">{label}</span>
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
