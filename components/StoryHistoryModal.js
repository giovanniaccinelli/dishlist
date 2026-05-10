"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "./LanguageProvider";

function formatPushTimestamp(entry) {
  const millis = Number(entry?.pushedAtMs || 0);
  if (millis > 0) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(millis));
  }
  if (entry?.pushedAtISO) {
    const parsed = new Date(entry.pushedAtISO);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed);
    }
  }
  return "Unknown time";
}

export default function StoryHistoryModal({ open, onClose, dishName, history = [] }) {
  const { t, darkMode } = useLanguage();
  const orderedHistory = Array.isArray(history) ? [...history].sort((a, b) => Number(b?.pushedAtMs || 0) - Number(a?.pushedAtMs || 0)) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/42 px-3 pb-3 pt-16 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`flex max-h-[calc(100dvh-2rem)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-[2rem] border shadow-[0_28px_80px_rgba(0,0,0,0.24)] ${
              darkMode
                ? "border-white/12 bg-[#111111] text-white"
                : "border-[#E3CFA7] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF4E5_52%,#F7F6F1_100%)] text-black"
            }`}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex shrink-0 items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/8"}`}>
              <div>
                <h3 className={`text-[1.3rem] font-bold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t("Story pushes")}</h3>
                <p className={`mt-1 text-xs ${darkMode ? "text-white/55" : "text-black/55"}`}>{dishName || t("Dish")}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${
                  darkMode ? "bg-white/10 text-white/70" : "bg-white/82 text-black/65"
                }`}
                aria-label="Close history"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {orderedHistory.length === 0 ? (
                <div className={`rounded-[1.6rem] border p-6 text-center ${darkMode ? "border-white/10 bg-white/8" : "border-black/8 bg-white/70"}`}>
                  <div className={`text-lg font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("No story pushes yet")}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orderedHistory.map((entry, index) => (
                    <div
                      key={`${entry?.pushedAtMs || entry?.pushedAtISO || "push"}-${index}`}
                      className={`rounded-[1.35rem] border p-3 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ${darkMode ? "border-white/10 bg-white/8" : "border-black/8 bg-white/78"}`}
                    >
                      <div className={`text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                        {formatPushTimestamp(entry)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
