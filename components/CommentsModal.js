"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function CommentsModal({
  open,
  onClose,
  comments,
  loading,
  onSubmit,
  newComment,
  setNewComment,
  disabled,
}) {
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
              <h3 className="text-xl font-semibold text-black">Comments</h3>
              <button onClick={onClose} className="text-sm text-black/60">
                Close
              </button>
            </div>

            <div className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={3}
                disabled={disabled}
              />
              <button
                onClick={onSubmit}
                className="mt-2 w-full bg-black text-white py-2 rounded-full font-semibold"
                disabled={disabled || !newComment.trim()}
              >
                Post
              </button>
            </div>

            {loading ? (
              <div className="text-black/60">Loading...</div>
            ) : comments.length === 0 ? (
              <div className="bg-[#f0f0ea] rounded-xl h-24 flex items-center justify-center text-gray-500">
                No comments yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl p-3 shadow-md border border-black/5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-xs font-bold">
                        {c.userPhotoURL ? (
                          <img
                            src={c.userPhotoURL}
                            alt="Profile"
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          c.userName?.[0] || "U"
                        )}
                      </div>
                      <div className="text-sm font-semibold text-black">{c.userName || "User"}</div>
                    </div>
                    <div className="text-sm text-black/80">{c.text}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
