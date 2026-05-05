"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";

function ViewerAvatar({ viewer }) {
  if (viewer?.photoURL) {
    return (
      <img
        src={viewer.photoURL}
        alt={viewer.displayName || viewer.name || "Viewer"}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  const label = String(viewer?.displayName || viewer?.name || "U").slice(0, 1).toUpperCase();
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3EBDD] text-sm font-semibold text-black/65">
      {label}
    </div>
  );
}

export default function StoryViewsModal({ open, onClose, viewers = [], loading = false }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[135] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/12" />
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
                  <Eye size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">
                    Story views
                  </div>
                  <h3 className="mt-1 text-[1.3rem] font-bold leading-none text-black">
                    Seen by {viewers.length}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55"
                aria-label="Close story views"
              >
                <X size={16} />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-black/55">Loading views...</div>
            ) : viewers.length === 0 ? (
              <div className="rounded-[1.5rem] bg-[#F7F3EC] px-4 py-5 text-center text-sm text-black/55">
                Nobody has viewed this story yet.
              </div>
            ) : (
              <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
                {viewers.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center gap-3 rounded-[1.25rem] border border-black/8 bg-[#FFFDF8] px-3 py-2.5"
                  >
                    <ViewerAvatar viewer={viewer} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">
                        {viewer.displayName || viewer.name || "User"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
