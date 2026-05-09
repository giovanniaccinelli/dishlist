"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "./LanguageProvider";

export default function CommentsModal({
  open,
  onClose,
  title = "Comments",
  comments,
  loading,
  onSubmit,
  onDelete,
  newComment,
  setNewComment,
  disabled,
  currentUser,
  replyTo,
  setReplyTo,
}) {
  const { darkMode } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const replyName = replyTo?.userName || "User";
  const orderedComments = (() => {
    const safe = Array.isArray(comments) ? comments : [];
    const byId = new Map(safe.map((c) => [c.id, c]));
    const parents = safe.filter((c) => !c.parentId);
    const repliesByParent = safe.reduce((acc, c) => {
      if (!c.parentId) return acc;
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
      return acc;
    }, {});
    const sortByTime = (a, b) => {
      const aTime = a?.createdAt?.seconds || 0;
      const bTime = b?.createdAt?.seconds || 0;
      return aTime - bTime;
    };
    parents.sort(sortByTime);
    Object.values(repliesByParent).forEach((list) => list.sort(sortByTime));
    const result = [];
    parents.forEach((p) => {
      result.push(p);
      const replies = repliesByParent[p.id] || [];
      replies.forEach((r) => {
        if (byId.has(r.id)) result.push(r);
      });
    });
    return result;
  })();

  const hasText = Boolean(newComment.trim());

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/42 px-3 pb-3 pt-16 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`flex ${expanded ? "max-h-[calc(100dvh-1rem)]" : "max-h-[calc(100dvh-5rem)]"} w-full max-w-md min-h-0 flex-col overflow-hidden rounded-[2rem] border shadow-[0_28px_80px_rgba(0,0,0,0.24)] ${
              darkMode
                ? "border-white/12 bg-[#101010] text-white"
                : "border-[#E3CFA7] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF4E5_52%,#F7F6F1_100%)]"
            }`}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex shrink-0 items-center justify-between border-b px-5 py-4 ${darkMode ? "border-white/10" : "border-black/8"}`}>
              <h3 className={`text-[1.45rem] font-bold leading-none ${darkMode ? "text-white" : "text-black"}`}>{title}</h3>
              <div className="flex items-center gap-2">
                {orderedComments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.06)] ${darkMode ? "bg-white/10 text-white/70" : "bg-white/82 text-black/65"}`}
                    aria-label={expanded ? "Shrink comments" : "Show more comments"}
                  >
                    {expanded ? "⌄" : "⌃"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.06)] ${darkMode ? "bg-white/10 text-white/70" : "bg-white/82 text-black/65"}`}
                  aria-label="Close comments"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className={`rounded-[1.4rem] p-5 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-white/72 text-black/55"}`}>
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className={`rounded-[1.6rem] border p-6 text-center ${darkMode ? "border-white/10 bg-white/7" : "border-black/8 bg-white/70"}`}>
                  <div className={`text-lg font-semibold ${darkMode ? "text-white" : "text-black"}`}>No comments yet</div>
                  <div className={`mt-1 text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}>Start the conversation.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orderedComments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-[1.35rem] border p-3 shadow-[0_10px_24px_rgba(0,0,0,0.045)] ${
                        darkMode ? "border-white/10 bg-[#1A1A1A]" : "border-black/8 bg-white/78"
                      } ${
                        c.parentId ? "ml-7 border-l-[3px] border-l-[#D7B443]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${darkMode ? "bg-white/12 text-white/70" : "bg-black/10 text-black/70"}`}>
                            {c.userPhotoURL ? (
                              <img
                                src={c.userPhotoURL}
                                alt="Profile"
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              c.userName?.[0] || "U"
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`whitespace-pre-wrap break-words text-sm leading-5 ${darkMode ? "text-white/82" : "text-black/78"}`}>
                              <span className={`font-semibold ${darkMode ? "text-white/90" : "text-black/72"}`}>{c.userName || "User"}:</span>{" "}
                              {c.text}
                            </div>
                            {c.parentId ? (
                              <div className={`mt-1 text-[11px] font-medium ${darkMode ? "text-white/38" : "text-black/38"}`}>reply</div>
                            ) : null}
                          </div>
                        </div>
                        {currentUser?.uid === c.userId && (
                          <button
                            type="button"
                            onClick={() => onDelete(c)}
                            className="rounded-full bg-[#FFE6E6] px-2.5 py-1 text-[11px] font-semibold text-[#8A1F1F]"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {!c.parentId && (
                        <button
                          type="button"
                          onClick={() => setReplyTo(c)}
                          className="mt-2 text-xs font-semibold text-[#2B74B8]"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`shrink-0 border-t px-4 py-3 ${darkMode ? "border-white/10 bg-[#141414]" : "border-black/8 bg-white/52"}`}>
              {replyTo && (
                <div className={`mb-2 flex items-center justify-between rounded-full px-3 py-2 text-xs font-medium ${darkMode ? "bg-white/8 text-white/68" : "bg-[#EAF3FF] text-black/68"}`}>
                  <span>Replying to {replyName}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-[#2B74B8]">
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                  className={`min-h-12 max-h-24 flex-1 resize-none rounded-[1.25rem] border px-4 py-3 text-base shadow-[0_8px_20px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#2B74B8]/20 ${
                    darkMode ? "border-white/12 bg-[#202020] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black"
                  }`}
                  rows={1}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={onSubmit}
                  className={`flex h-12 shrink-0 items-center justify-center rounded-[1.1rem] px-4 text-base font-semibold shadow-[0_10px_24px_rgba(43,116,184,0.22)] ${
                    disabled || !hasText
                      ? darkMode
                        ? "bg-white/10 text-white/35 shadow-none"
                        : "bg-black/10 text-black/35 shadow-none"
                      : "bg-gradient-to-r from-[#0F3D63] to-[#2B74B8] text-white"
                  }`}
                  disabled={disabled || !hasText}
                >
                  Post
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
