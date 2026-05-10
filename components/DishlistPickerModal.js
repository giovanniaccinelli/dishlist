"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, Plus, Star } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";

const PICKER_ORDER = ["saved", "to_try", "uploaded"];

function orderPickerLists(lists = []) {
  const systemRank = new Map(PICKER_ORDER.map((id, index) => [id, index]));
  return [...lists].sort((a, b) => {
    if (a.id === "all_dishes") return 1;
    if (b.id === "all_dishes") return -1;
    const aRank = systemRank.has(a.id) ? systemRank.get(a.id) : 50;
    const bRank = systemRank.has(b.id) ? systemRank.get(b.id) : 50;
    return aRank - bRank;
  });
}

export default function DishlistPickerModal({
  open,
  onClose,
  lists = [],
  dishName = "dish",
  loading = false,
  title = "Choose dishlists",
  eyebrow = "Add To",
  mode = "multiple",
  selectedIds = [],
  lockedIds = [],
  onToggle,
  onSelect,
  onConfirm,
  confirmLabel = "Save",
  variant = "sheet",
  dishPreview = null,
}) {
  const { darkMode } = useLanguage();
  const selectedSet = new Set(selectedIds);
  const lockedSet = new Set(lockedIds);
  const orderedLists = orderPickerLists(lists);
  const isSwipeCard = variant === "swipe";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex justify-center p-4 ${isSwipeCard ? "items-center" : "items-end"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
          className={`no-accent-border flex min-h-0 w-full max-w-md flex-col rounded-[2rem] border px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
              isSwipeCard ? "h-[82vh]" : "h-[min(82vh,calc(100dvh-2rem))]"
            } ${
              darkMode
                ? "border-white/12 bg-[#101010] text-white"
                : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)]"
            }`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`no-accent-border mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full ${darkMode ? "bg-white/14" : "bg-black/12"}`} />
            <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                  {eyebrow}
                </p>
                <h3 className={`mt-1 text-[1.4rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                  {title}
                </h3>
                <p className={`mt-1 text-sm ${darkMode ? "text-white/62" : "text-black/55"}`}>{dishName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full px-3 py-1 text-sm ${darkMode ? "text-white/70" : "text-black/55"}`}
              >
                Close
              </button>
            </div>
            {dishPreview ? (
              <div className={`mb-4 flex shrink-0 items-center gap-3 rounded-[1.35rem] border p-2.5 ${
                darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white/85"
              }`}>
                <img
                  src={getDishImageUrl(dishPreview, "thumb")}
                  alt={dishPreview?.name || dishName}
                  className="h-16 w-16 rounded-[1rem] object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                    Just swiped
                  </div>
                  <div className={`truncate text-base font-bold ${darkMode ? "text-white" : "text-black"}`}>
                    {dishPreview?.name || dishName}
                  </div>
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className={`rounded-[1.4rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-[#F2EFE8] text-black/55"}`}>
                Loading dishlists...
              </div>
            ) : orderedLists.length === 0 ? (
              <div className={`rounded-[1.4rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-[#F2EFE8] text-black/55"}`}>
                No dishlists yet.
              </div>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                  {orderedLists.map((dishlist) => {
                    const selected = selectedSet.has(dishlist.id);
                    const locked = lockedSet.has(dishlist.id);
                    return (
                      <button
                        key={dishlist.id}
                        type="button"
                        onClick={() => {
                          if (mode === "single") {
                            onSelect?.(dishlist);
                            return;
                          }
                          if (locked) return;
                          onToggle?.(dishlist);
                        }}
                        className={`no-accent-border flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${
                          darkMode
                            ? selected
                              ? "border-[#45C47A] bg-[#12351F] text-white"
                              : "border-white/12 bg-[#181818] text-white"
                            : selected
                              ? "border-[#1FA463] bg-[#F4FFF7]"
                              : "border-black/8 bg-white/90"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                            <span className="inline-flex items-center gap-1.5">
                              {dishlist.id === "saved" ? <Star size={14} className="text-[#D9B550] fill-[#F3D88C]" /> : null}
                              <span>{dishlist.name}</span>
                            </span>
                          </div>
                          <div className={`mt-0.5 text-xs ${darkMode ? "text-white/55" : "text-black/48"}`}>
                            {Number(dishlist.count || 0)} dishes
                          </div>
                        </div>
                        <div
                          className={`no-accent-border ml-4 flex h-9 w-9 items-center justify-center rounded-full border ${
                            darkMode
                              ? selected
                                ? "border-[#45C47A] bg-[#1FA463] text-white"
                                : "border-white/14 bg-[#242424] text-white/70"
                              : selected
                                ? "border-[#1FA463] bg-[#1FA463] text-white"
                                : "border-black/10 bg-[#F7F5EF] text-black/65"
                          }`}
                        >
                          {locked ? <Lock size={15} /> : selected ? <Check size={16} /> : <Plus size={16} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {mode === "multiple" ? (
                  <div className={`sticky bottom-0 mt-4 flex shrink-0 items-center justify-between gap-3 border-t pt-4 ${
                    darkMode ? "border-white/10 bg-[#101010]" : "border-black/8 bg-[#FAF7F0]"
                  }`}>
                    <div className={`text-xs ${darkMode ? "text-white/55" : "text-black/50"}`}>
                      {selectedIds.length} selected
                    </div>
                    <button
                      type="button"
                      onClick={onConfirm}
                      className={`rounded-full px-6 py-3.5 text-sm font-bold shadow-[0_12px_26px_rgba(31,164,99,0.2)] ${
                        darkMode ? "border border-[#45C47A]/45 bg-[#1FA463] text-white" : "bg-[#111111] text-white"
                      }`}
                    >
                      {confirmLabel}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
