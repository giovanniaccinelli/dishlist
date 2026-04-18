"use client";

import { AnimatePresence, motion } from "framer-motion";

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
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#E3CFA7] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF4E5_52%,#F7F6F1_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.24)]"
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-black/8 px-5 py-4">
              <div>
                <h3 className="text-[1.3rem] font-bold leading-none text-black">Story pushes</h3>
                <p className="mt-1 text-xs text-black/55">{dishName || "Dish"}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-lg font-semibold text-black/65 shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                aria-label="Close history"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {orderedHistory.length === 0 ? (
                <div className="rounded-[1.6rem] border border-black/8 bg-white/70 p-6 text-center">
                  <div className="text-lg font-semibold text-black">No story pushes yet</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orderedHistory.map((entry, index) => (
                    <div
                      key={`${entry?.pushedAtMs || entry?.pushedAtISO || "push"}-${index}`}
                      className="rounded-[1.35rem] border border-black/8 bg-white/78 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.045)]"
                    >
                      <div className="text-sm font-semibold text-black">
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
