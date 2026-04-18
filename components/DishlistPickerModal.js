"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, Plus } from "lucide-react";

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
}) {
  const selectedSet = new Set(selectedIds);
  const lockedSet = new Set(lockedIds);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)] px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/12" />
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40">
                  {eyebrow}
                </p>
                <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                  {title}
                </h3>
                <p className="mt-1 text-sm text-black/55">{dishName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-3 py-1 text-sm text-black/55"
              >
                Close
              </button>
            </div>
            {loading ? (
              <div className="rounded-[1.4rem] bg-[#F2EFE8] px-4 py-8 text-center text-sm text-black/55">
                Loading dishlists...
              </div>
            ) : lists.length === 0 ? (
              <div className="rounded-[1.4rem] bg-[#F2EFE8] px-4 py-8 text-center text-sm text-black/55">
                No dishlists yet.
              </div>
            ) : (
              <>
                <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
                  {lists.map((dishlist) => {
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
                        className={`flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${
                          selected
                            ? "border-[#2BD36B] bg-[#F4FFF7]"
                            : "border-black/8 bg-white/90"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-black">
                            {dishlist.name}
                          </div>
                          <div className="mt-0.5 text-xs text-black/48">
                            {Number(dishlist.count || 0)} dishes
                          </div>
                        </div>
                        <div
                          className={`ml-4 flex h-9 w-9 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[#2BD36B] bg-[#2BD36B] text-white"
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
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-black/50">
                      {selectedIds.length} selected
                    </div>
                    <button
                      type="button"
                      onClick={onConfirm}
                      className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
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
