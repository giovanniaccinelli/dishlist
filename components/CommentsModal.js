"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function CommentsModal({
  open,
  onClose,
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
            className={`flex ${expanded ? "max-h-[calc(100dvh-1rem)]" : "max-h-[calc(100dvh-5rem)]"} w-full max-w-md min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#E3CFA7] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF4E5_52%,#F7F6F1_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.24)]`}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-black/8 px-5 py-4">
              <h3 className="text-[1.45rem] font-bold leading-none text-black">Comments</h3>
              <div className="flex items-center gap-2">
                {orderedComments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-lg font-semibold text-black/65 shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                    aria-label={expanded ? "Shrink comments" : "Show more comments"}
                  >
                    {expanded ? "⌄" : "⌃"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-lg font-semibold text-black/65 shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                  aria-label="Close comments"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="rounded-[1.4rem] bg-white/72 p-5 text-center text-sm text-black/55">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className="rounded-[1.6rem] border border-black/8 bg-white/70 p-6 text-center">
                  <div className="text-lg font-semibold text-black">No comments yet</div>
                  <div className="mt-1 text-sm text-black/55">Start the conversation.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orderedComments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-[1.35rem] border border-black/8 bg-white/78 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.045)] ${
                        c.parentId ? "ml-7 border-l-[3px] border-l-[#D7B443]" : ""
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/10 text-xs font-bold text-black/70">
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
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-tight text-black">
                              {c.userName || "User"}
                            </div>
                            <div className="text-[11px] font-medium text-black/38">
                              {c.parentId ? "reply" : ""}
                            </div>
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
                      <div className="whitespace-pre-wrap break-words text-sm leading-5 text-black/78">{c.text}</div>
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

            <div className="shrink-0 border-t border-black/8 bg-white/52 px-4 py-3">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-full bg-[#EAF3FF] px-3 py-2 text-xs font-medium text-black/68">
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
                  className="min-h-12 max-h-24 flex-1 resize-none rounded-[1.25rem] border border-black/10 bg-white px-4 py-3 text-base text-black shadow-[0_8px_20px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#2B74B8]/20"
                  rows={1}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={onSubmit}
                  className={`flex h-12 shrink-0 items-center justify-center rounded-[1.1rem] px-4 text-base font-semibold shadow-[0_10px_24px_rgba(43,116,184,0.22)] ${
                    disabled || !hasText
                      ? "bg-black/10 text-black/35 shadow-none"
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
