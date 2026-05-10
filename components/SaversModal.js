"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "./LanguageProvider";

export default function SaversModal({ open, onClose, loading, users, currentUserId }) {
  const { t, darkMode } = useLanguage();
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
            className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border p-5 ${
              darkMode ? "border-white/12 bg-[#111111] text-white" : "border-black/8 bg-white text-black"
            }`}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Saved By")}</h3>
              <button onClick={onClose} className={`text-sm ${darkMode ? "text-white/62" : "text-black/60"}`}>
                {t("Close")}
              </button>
            </div>
            {loading ? (
              <div className={darkMode ? "text-white/60" : "text-black/60"}>{t("Loading...")}</div>
            ) : users.length === 0 ? (
              <div className={`rounded-xl h-24 flex items-center justify-center ${darkMode ? "bg-white/8 text-white/58" : "bg-[#f0f0ea] text-gray-500"}`}>
                {t("No saves yet.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    href={u.id === currentUserId ? "/profile" : `/profile/${u.id}`}
                    onClick={onClose}
                    className={`rounded-2xl p-4 shadow-md border flex items-center gap-3 ${
                      darkMode ? "border-white/10 bg-[#1A1A1A]" : "border-black/5 bg-white"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${darkMode ? "bg-white/12 text-white" : "bg-black/10 text-black"}`}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="Profile" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        u.displayName?.[0] || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-base font-semibold truncate ${darkMode ? "text-white" : "text-black"}`}>{u.displayName || "User"}</div>
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
