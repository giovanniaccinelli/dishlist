"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";

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
  const [groupFlash, setGroupFlash] = useState("");

  useEffect(() => {
    if (!open) return;
    setGroupIndex(Math.min(initialGroupIndex, Math.max(groups.length - 1, 0)));
    setStoryIndex(0);
  }, [open, initialGroupIndex, groups.length]);

  const currentGroup = groups[groupIndex] || null;
  const currentStories = currentGroup?.stories || [];
  const currentStory = currentStories[storyIndex] || null;

  useEffect(() => {
    if (!open || !currentStory?.id) return;
    onViewed?.(currentStory, currentGroup);
  }, [open, currentStory?.id, groupIndex, onViewed, currentGroup]);

  const goNext = () => {
    if (!currentGroup) return onClose?.();
    if (storyIndex < currentStories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupFlash(groups[groupIndex + 1]?.ownerName || "Next");
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      return;
    }
    onClose?.();
  };

  const goPrev = () => {
    if (!currentGroup) return;
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      return;
    }
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupFlash(previousGroup?.ownerName || "Previous");
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(Math.max((previousGroup?.stories?.length || 1) - 1, 0));
    }
  };

  useEffect(() => {
    if (!groupFlash) return;
    const timeout = setTimeout(() => setGroupFlash(""), 700);
    return () => clearTimeout(timeout);
  }, [groupFlash]);

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

  const openDish = () => {
    const storyDishId = currentStory.dishId || currentStory.id;
    if (!storyDishId) return;
    onClose?.();
    router.push(`/dish/${storyDishId}?source=public&mode=single`);
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
        <div className="relative w-screen h-screen overflow-hidden bg-black">
          <img
            src={getDishImageUrl(currentStory)}
            alt={currentStory.name || "Story"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_DISH_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

          <div className="absolute top-4 left-4 right-4 z-40 flex gap-1">
            {currentStories.map((story, idx) => (
              <div key={story.id || idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                <div className={`h-full rounded-full ${idx <= storyIndex ? "bg-white" : "bg-transparent"}`} />
              </div>
            ))}
          </div>

          {groups.length > 1 ? (
            <div className="absolute top-16 left-4 right-4 z-40 flex items-center justify-center gap-2">
              {groups.map((group, idx) => (
                <div
                  key={`${group.ownerId}-${idx}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === groupIndex ? "w-12 bg-white" : "w-5 bg-white/30"
                  }`}
                />
              ))}
            </div>
          ) : null}

          <div className="absolute top-10 left-4 right-4 z-40 flex items-center justify-between text-white">
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
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="relative z-50 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                  aria-label="Delete story"
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
              <button
                type="button"
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

          <div className="absolute left-0 top-24 bottom-24 z-10 w-1/3">
            <button type="button" className="w-full h-full" onClick={goPrev} aria-label="Previous story" />
          </div>
          <div className="absolute right-0 top-24 bottom-24 z-10 w-1/3">
            <button type="button" className="w-full h-full" onClick={goNext} aria-label="Next story" />
          </div>

          {groupFlash ? (
            <motion.div
              key={groupFlash}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/18 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md"
            >
              {groupFlash}
            </motion.div>
          ) : null}

          <div className="absolute bottom-16 left-0 right-0 z-40 p-5 text-white">
            <h2 className="text-2xl font-bold leading-tight">
              {currentStory.name || "Untitled dish"}
            </h2>
            {currentStory.description ? (
              <p className="mt-2 text-sm text-white/80 line-clamp-3">
                {currentStory.description}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
