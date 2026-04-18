"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ListPlus } from "lucide-react";

export default function DishlistPickerModal({
  open,
  onClose,
  lists = [],
  dishName = "dish",
  onSelect,
  loading = false,
}) {
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
                  Add To
                </p>
                <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                  Choose a dishlist
                </h3>
                <p className="mt-1 text-sm text-black/55">
                  {dishName}
                </p>
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
              <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
                {lists.map((dishlist) => (
                  <button
                    key={dishlist.id}
                    type="button"
                    onClick={() => onSelect?.(dishlist)}
                    className="flex items-center justify-between rounded-[1.25rem] border border-black/8 bg-white/90 px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">
                        {dishlist.name}
                      </div>
                      <div className="mt-0.5 text-xs text-black/48">
                        {Number(dishlist.count || 0)} dishes
                      </div>
                    </div>
                    <div className="ml-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-[#F7F5EF] text-black/65">
                      {dishlist.type === "system" ? <Check size={16} /> : <ListPlus size={16} />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
