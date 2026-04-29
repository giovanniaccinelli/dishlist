"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import CommentsModal from "./CommentsModal";
import { addCommentToDish, deleteCommentThread, getCommentsForDish } from "../app/lib/firebaseHelpers";
import { DEFAULT_DISH_IMAGE, getDishImageUrl, isDishVideo } from "../app/lib/dishImage";

const STORY_DURATION_MS = 4500;

export default function StoryViewerModal({
  open,
  onClose,
  stories,
  storyGroups,
  ownerName,
  ownerPhotoURL,
  onViewed,
  canDelete = false,
  onDelete,
  initialGroupIndex = 0,
  currentUser = null,
}) {
  const router = useRouter();
  const groups = useMemo(() => {
    if (Array.isArray(storyGroups) && storyGroups.length > 0) {
      return storyGroups
        .filter((group) => Array.isArray(group.stories) && group.stories.length > 0)
        .map((group) => ({
          ownerId: group.ownerId || "",
          ownerName: group.ownerName || "User",
          ownerPhotoURL: group.ownerPhotoURL || "",
          stories: group.stories,
        }));
    }

    const fallbackStories = Array.isArray(stories) ? stories : [];
    if (fallbackStories.length === 0) return [];
    return [
      {
        ownerId: "",
        ownerName: ownerName || "User",
        ownerPhotoURL: ownerPhotoURL || "",
        stories: fallbackStories,
      },
    ];
  }, [ownerName, ownerPhotoURL, stories, storyGroups]);

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const didAdvanceRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const suppressTapUntilRef = useRef(0);
  const videoRef = useRef(null);
  const [storyDurationMs, setStoryDurationMs] = useState(STORY_DURATION_MS);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [comments, setComments] = useState([]);
  const [previewComment, setPreviewComment] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const rafProgressRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    setGroupIndex(Math.min(initialGroupIndex, Math.max(groups.length - 1, 0)));
    setStoryIndex(0);
    setProgressMs(0);
    setIsPaused(false);
  }, [open, initialGroupIndex, groups.length]);

  const currentGroup = groups[groupIndex] || null;
  const currentStories = currentGroup?.stories || [];
  const currentStory = currentStories[storyIndex] || null;
  const currentStoryIsVideo = isDishVideo(currentStory);

  useEffect(() => {
    if (!open || !currentStory?.id) return;
    onViewed?.(currentStory, currentGroup);
  }, [open, currentStory?.id, groupIndex, onViewed, currentGroup]);

  useEffect(() => {
    if (!open || !currentStory?.id) return;
    setProgressMs(0);
    setIsPaused(false);
    didAdvanceRef.current = false;
    setStoryDurationMs(STORY_DURATION_MS);
  }, [open, currentStory?.id, groupIndex, storyIndex]);

  useEffect(() => {
    if (!open || !currentStory) return;
    setComments([]);
    setPreviewComment(null);
    setNewComment("");
    setReplyTo(null);
    setCommentsOpen(false);

    const storyDishId = currentStory.dishId || currentStory.id;
    if (!storyDishId) return;

    let cancelled = false;
    (async () => {
      const top = await getCommentsForDish(storyDishId, 1);
      if (!cancelled) setPreviewComment(top?.[0] || null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, currentStory?.id]);

  useEffect(() => {
    if (!open || !currentStory?.id || isPaused || commentsOpen || currentStoryIsVideo) return;
    let frameId = 0;
    let previousTime = performance.now();

    const tick = (now) => {
      const delta = now - previousTime;
      previousTime = now;

      setProgressMs((prev) => {
        const next = Math.min(prev + delta, storyDurationMs);
        if (next >= storyDurationMs && !didAdvanceRef.current) {
          didAdvanceRef.current = true;
          window.setTimeout(() => {
            goNext();
          }, 0);
        }
        return next;
      });

      if (!didAdvanceRef.current) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [open, currentStory?.id, groupIndex, storyIndex, isPaused, storyDurationMs, currentStoryIsVideo, commentsOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !video || !currentStoryIsVideo) return;
    video.currentTime = 0;
    video.loop = false;
    video.playsInline = true;
    video.controls = false;
    video.muted = false;
    video.defaultMuted = false;

    const syncDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setStoryDurationMs(video.duration * 1000);
      }
    };

    const syncProgress = () => {
      setProgressMs(video.currentTime * 1000);
    };

    const tickProgress = () => {
      setProgressMs(video.currentTime * 1000);
      if (!video.paused && !video.ended) {
        rafProgressRef.current = window.requestAnimationFrame(tickProgress);
      }
    };

    const startProgressLoop = () => {
      window.cancelAnimationFrame(rafProgressRef.current);
      rafProgressRef.current = window.requestAnimationFrame(tickProgress);
    };

    const handleEnded = () => {
      if (!didAdvanceRef.current) {
        didAdvanceRef.current = true;
        goNext();
      }
    };

    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("play", startProgressLoop);
    video.addEventListener("pause", syncProgress);
    video.addEventListener("ended", handleEnded);
    syncDuration();
    syncProgress();

    const withAudio = video.play?.();
    if (withAudio?.catch) {
      withAudio.catch(() => {
        video.muted = true;
        video.defaultMuted = true;
        const mutedPlay = video.play?.();
        if (mutedPlay?.catch) mutedPlay.catch(() => {});
      });
    }

    return () => {
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("timeupdate", syncProgress);
      video.removeEventListener("play", startProgressLoop);
      video.removeEventListener("pause", syncProgress);
      video.removeEventListener("ended", handleEnded);
      window.cancelAnimationFrame(rafProgressRef.current);
      try {
        video.pause?.();
      } catch {}
    };
  }, [open, currentStory?.id, groupIndex, storyIndex, currentStoryIsVideo, commentsOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentStoryIsVideo) return;
    if (isPaused || commentsOpen) {
      try {
        video.pause?.();
      } catch {}
      return;
    }
    const withAudio = video.play?.();
    if (withAudio?.catch) {
      withAudio.catch(() => {
        video.muted = true;
        video.defaultMuted = true;
        const mutedPlay = video.play?.();
        if (mutedPlay?.catch) mutedPlay.catch(() => {});
      });
    }
  }, [isPaused, currentStoryIsVideo, currentStory?.id, commentsOpen]);

  const goNext = () => {
    if (Date.now() < suppressTapUntilRef.current) return;
    if (!currentGroup) return onClose?.();
    if (storyIndex < currentStories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      return;
    }
    onClose?.();
  };

  const goPrev = () => {
    if (Date.now() < suppressTapUntilRef.current) return;
    if (!currentGroup) return;
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      return;
    }
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(Math.max((previousGroup?.stories?.length || 1) - 1, 0));
    }
  };

  const goNextGroup = () => {
    if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      return;
    }
    onClose?.();
  };

  const goPrevGroup = () => {
    if (groupIndex > 0) {
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(0);
      return;
    }
  };

  const handleDelete = async () => {
    if (!currentStory?.id || !onDelete) return;
    const shouldClose = await onDelete(currentStory, currentGroup);
    if (shouldClose) {
      onClose?.();
      return;
    }
    if (storyIndex >= Math.max(currentStories.length - 1, 1)) {
      setStoryIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  if (!open || !currentStory) return null;

  const progressWidth = `${Math.min((progressMs / storyDurationMs) * 100, 100)}%`;

  const handlePressStart = (event) => {
    if (event.target.closest("[data-no-story-pause='true']")) return;
    pressStartedAtRef.current = Date.now();
    setIsPaused(true);
  };

  const handlePressEnd = () => {
    if (pressStartedAtRef.current && Date.now() - pressStartedAtRef.current > 180) {
      suppressTapUntilRef.current = Date.now() + 280;
    }
    pressStartedAtRef.current = 0;
    setIsPaused(false);
  };

  const openDish = () => {
    const storyDishId = currentStory.dishId || currentStory.id;
    if (!storyDishId) return;
    onClose?.();
    router.push(`/dish/${storyDishId}?source=public&mode=single`);
  };

  const currentStoryDishId = currentStory?.dishId || currentStory?.id || null;

  const loadComments = async () => {
    if (!currentStoryDishId) return;
    setCommentsLoading(true);
    try {
      const items = await getCommentsForDish(currentStoryDishId, 30);
      setComments(items);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openComments = async (event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    setCommentsOpen(true);
    await loadComments();
  };

  const submitComment = async () => {
    if (!currentStoryDishId || !currentUser?.uid || commentSubmitting) return;
    const text = newComment.trim();
    if (!text) return;
    setCommentSubmitting(true);
    try {
      const ok = await addCommentToDish(currentStoryDishId, {
        userId: currentUser.uid,
        userName: currentUser.displayName || "User",
        userPhotoURL: currentUser.photoURL || "",
        text,
        parentId: replyTo?.id || null,
      });
      if (!ok) return;
      setNewComment("");
      setReplyTo(null);
      await loadComments();
      const top = await getCommentsForDish(currentStoryDishId, 1);
      setPreviewComment(top?.[0] || null);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!currentStoryDishId || !comment?.id || comment.userId !== currentUser?.uid) return;
    const ok = await deleteCommentThread(currentStoryDishId, comment.id);
    if (!ok) return;
    await loadComments();
    const top = await getCommentsForDish(currentStoryDishId, 1);
    setPreviewComment(top?.[0] || null);
  };

  const publishedAtLabel = (() => {
    const raw = currentStory.createdAt;
    let date = null;
    if (raw?.toDate) date = raw.toDate();
    else if (raw instanceof Date) date = raw;
    else if (typeof raw?.seconds === "number") date = new Date(raw.seconds * 1000);
    else if (typeof raw === "string" || typeof raw === "number") date = new Date(raw);
    if (!date || Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  })();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] bg-black flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-screen h-screen overflow-hidden bg-black"
          drag
          dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
          dragElastic={0.12}
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerCancel={handlePressEnd}
          onDragEnd={(_, info) => {
            setIsPaused(false);
            if (Math.abs(info.offset.x) > Math.abs(info.offset.y) && Math.abs(info.offset.x) > 70) {
              if (info.offset.x < 0) goNextGroup();
              else goPrevGroup();
              return;
            }
            if (info.offset.y > 120 || info.velocity.y > 700) onClose?.();
          }}
          style={{ transformStyle: "preserve-3d", touchAction: "pan-y pan-x" }}
        >
          <motion.div
            key={`${currentGroup?.ownerId || "group"}-${currentStory?.id || "story"}`}
            className="absolute inset-0"
            initial={{ opacity: 0.96 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {isDishVideo(currentStory) ? (
              <video
                ref={videoRef}
                src={getDishImageUrl(currentStory)}
                className="w-full h-full object-cover"
                autoPlay
                muted={false}
                playsInline
                preload="auto"
                controls={false}
                disablePictureInPicture
              />
            ) : (
              <img
                src={getDishImageUrl(currentStory)}
                alt={currentStory.name || "Story"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_DISH_IMAGE;
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
          </motion.div>

          <div
            className="absolute left-4 right-4 z-40 flex gap-1"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-nav-gap) + 0.2rem)" }}
          >
            {currentStories.map((story, idx) => (
              <div key={story.id || idx} className="no-accent-border h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                {idx < storyIndex ? (
                  <div className="no-accent-border h-full w-full rounded-full bg-white" />
                ) : idx === storyIndex ? (
                  <div className="no-accent-border h-full rounded-full bg-white" style={{ width: progressWidth }} />
                ) : (
                  <div className="no-accent-border h-full w-0 rounded-full bg-transparent" />
                )}
              </div>
            ))}
          </div>

          <div
            className="absolute left-4 right-4 z-40 flex items-center justify-between text-white"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-nav-gap) + 1.1rem)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center font-semibold">
                {currentGroup?.ownerPhotoURL ? (
                  <img src={currentGroup.ownerPhotoURL} alt={currentGroup.ownerName || "User"} className="w-full h-full object-cover" />
                ) : (
                  (currentGroup?.ownerName?.[0] || "U").toUpperCase()
                )}
              </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{currentGroup?.ownerName || "User"}</div>
                  <div className="text-xs text-white/70 truncate">
                    {publishedAtLabel || (groups.length > 1 ? `${groupIndex + 1}/${groups.length}` : "Story")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
              {canDelete ? (
                <button
                  type="button"
                  data-no-story-pause="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="relative z-50 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                  aria-label="Delete story"
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
              <button
                type="button"
                data-no-story-pause="true"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose?.();
                }}
                className="relative z-50 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="Close story"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            className="absolute left-0 bottom-24 z-10 w-1/3"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-nav-gap) + 5.5rem)" }}
          >
            <button type="button" className="w-full h-full" onClick={goPrev} aria-label="Previous story" />
          </div>
          <div
            className="absolute right-0 bottom-24 z-10 w-1/3"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-nav-gap) + 5.5rem)" }}
          >
            <button type="button" className="w-full h-full" onClick={goNext} aria-label="Next story" />
          </div>

          <div className="absolute bottom-24 left-0 right-0 z-40 p-5 text-white">
            <h2 className="text-2xl font-bold leading-tight">
              {currentStory.name || "Untitled dish"}
            </h2>
            {currentStory.taggedUserName ? (
              <div className="mt-2 inline-flex items-center rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/92 backdrop-blur-sm">
                @{String(currentStory.taggedUserName).replace(/^@+/, "")}
              </div>
            ) : null}
            {currentStory.description ? (
              <p className="mt-2 text-sm text-white/80 line-clamp-3">
                {currentStory.description}
              </p>
            ) : null}
            <div className="mt-2">
              {previewComment ? (
                <button
                  type="button"
                  data-no-story-pause="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={openComments}
                  className="text-left text-xs text-white/88 underline-offset-2 hover:underline"
                >
                  {previewComment.userName || "User"}: {previewComment.text}
                </button>
              ) : (
                <button
                  type="button"
                  data-no-story-pause="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={openComments}
                  className="text-left text-xs text-white/72"
                >
                  Be the first to comment
                </button>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                data-no-story-pause="true"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openDish();
                }}
                className="rounded-full bg-white/14 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md border border-white/15"
              >
                More
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        loading={commentsLoading}
        onDelete={handleDeleteComment}
        newComment={newComment}
        setNewComment={setNewComment}
        disabled={commentSubmitting}
        onSubmit={submitComment}
        currentUser={currentUser}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
    </AnimatePresence>
  );
}
