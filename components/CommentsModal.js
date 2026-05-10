"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
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
  const { t, darkMode } = useLanguage();
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
  const compact = orderedComments.length <= 2 && !expanded;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/58 px-0 pt-16 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`flex ${expanded ? "h-[calc(100dvh-1rem)]" : compact ? "max-h-[62dvh] min-h-[18rem]" : "h-[78dvh]"} w-full max-w-md min-h-0 flex-col overflow-hidden rounded-t-[1.7rem] border shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:rounded-[1.7rem] ${
              darkMode
                ? "border-white/12 bg-[#171717] text-white"
                : "border-black/8 bg-white text-black"
            }`}
            drag="y"
            dragConstraints={{ top: 0, bottom: 180 }}
            dragElastic={{ top: 0.02, bottom: 0.28 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 650) onClose();
            }}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex shrink-0 items-center justify-between border-b px-5 py-3.5 ${darkMode ? "border-white/10" : "border-black/8"}`}>
              <div>
                <h3 className={`text-[1.05rem] font-bold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t(title)}</h3>
                <div className={`mt-1 text-xs ${darkMode ? "text-white/42" : "text-black/42"}`}>{orderedComments.length} {t("comments")}</div>
              </div>
              <div className="flex items-center gap-2">
                {orderedComments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold ${darkMode ? "bg-white/10 text-white/70" : "bg-black/6 text-black/65"}`}
                    aria-label={expanded ? "Shrink comments" : "Show more comments"}
                  >
                    {expanded ? "⌄" : "⌃"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "bg-white/10 text-white/70" : "bg-black/6 text-black/65"}`}
                  aria-label="Close comments"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className={`rounded-[1.4rem] p-5 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-black/5 text-black/55"}`}>
                  {t("Loading comments...")}
                </div>
              ) : comments.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <div className={`text-lg font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("No comments yet")}</div>
                  <div className={`mt-1 text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}>{t("Start the conversation.")}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orderedComments.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 ${c.parentId ? "ml-10" : ""}`}
                    >
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold ${darkMode ? "bg-white/12 text-white/70" : "bg-black/10 text-black/70"}`}>
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
                              <span className={`font-semibold ${darkMode ? "text-white" : "text-black"}`}>{c.userName || "User"}</span>{" "}
                              {c.text}
                            </div>
                            <div className="mt-1 flex items-center gap-3">
                              {!c.parentId ? (
                                <button
                                  type="button"
                                  onClick={() => setReplyTo(c)}
                                  className={`text-xs font-semibold ${darkMode ? "text-white/45" : "text-black/45"}`}
                                >
                                  {t("Reply")}
                                </button>
                              ) : null}
                              {currentUser?.uid === c.userId && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(c)}
                                  className={`text-xs font-semibold ${darkMode ? "text-[#FF8A8A]" : "text-[#B34747]"}`}
                                >
                                  {t("Delete")}
                                </button>
                              )}
                            </div>
                          </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`shrink-0 border-t px-4 py-3 ${darkMode ? "border-white/10 bg-[#141414]" : "border-black/8 bg-white/52"}`}>
              {replyTo && (
                <div className={`mb-2 flex items-center justify-between rounded-full px-3 py-2 text-xs font-medium ${darkMode ? "bg-white/8 text-white/68" : "bg-[#EAF3FF] text-black/68"}`}>
                  <span>{t("Replying to")} {replyName}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-[#2B74B8]">
                    {t("Cancel")}
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? t("Write a reply...") : t("Write a comment...")}
                  className={`min-h-11 max-h-24 flex-1 resize-none rounded-full border px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#2B74B8]/20 ${
                    darkMode ? "border-white/12 bg-[#1A1A1A] text-white placeholder:text-white/35" : "border-black/10 bg-[#F5F5F5] text-black"
                  }`}
                  rows={1}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={onSubmit}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                    disabled || !hasText
                      ? darkMode
                        ? "bg-white/10 text-white/35 shadow-none"
                        : "bg-black/10 text-black/35 shadow-none"
                      : "bg-[#2B74B8] text-white"
                  }`}
                  disabled={disabled || !hasText}
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
