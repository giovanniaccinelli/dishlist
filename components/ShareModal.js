"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { getOrCreateConversation, sendMessage } from "../app/lib/firebaseHelpers";

export default function ShareModal({ open, onClose, dish, currentUser }) {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "users"));
      const usersList = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== currentUser?.uid);
      if (active) {
        setAllUsers(usersList);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, currentUser?.uid]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter((u) => (u.displayName || "").toLowerCase().includes(term));
  }, [allUsers, search]);

  const handleShare = async (target) => {
    if (!currentUser?.uid || !dish?.id) return;
    setSending(true);
    try {
      const convoId = await getOrCreateConversation(currentUser, target);
      if (!convoId) return;
      await sendMessage(convoId, {
        senderId: currentUser.uid,
        type: "dish",
        dishId: dish.id,
        text: dish.name || "Shared a dish",
      });
      onClose();
    } finally {
      setSending(false);
    }
  };

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-black">Share Dish</h3>
              <button onClick={onClose} className="text-sm text-black/60">
                Close
              </button>
            </div>
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-3 mb-3 rounded-xl bg-[#F6F6F2] border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
            />
            {loading ? (
              <div className="text-black/60">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-[#f0f0ea] rounded-xl h-24 flex items-center justify-center text-gray-500">
                No users found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleShare(u)}
                    disabled={sending}
                    className="bg-white rounded-2xl p-4 shadow-md border border-black/5 flex items-center gap-3 text-left"
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
                      <div className="text-xs text-black/60">Send dish</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
