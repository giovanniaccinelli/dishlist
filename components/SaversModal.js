"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export default function SaversModal({ open, onClose, loading, users, currentUserId }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-black">Saved By</h3>
              <button onClick={onClose} className="text-sm text-black/60">
                Close
              </button>
            </div>
            {loading ? (
              <div className="text-black/60">Loading...</div>
            ) : users.length === 0 ? (
              <div className="bg-[#f0f0ea] rounded-xl h-24 flex items-center justify-center text-gray-500">
                No saves yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    href={u.id === currentUserId ? "/profile" : `/profile/${u.id}`}
                    onClick={onClose}
                    className="bg-white rounded-2xl p-4 shadow-md border border-black/5 flex items-center gap-3"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/10 flex items-center justify-center text-lg font-bold text-black">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="Profile" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        u.displayName?.[0] || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate text-black">{u.displayName || "User"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
