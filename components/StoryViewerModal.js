"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
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
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(Math.max((previousGroup?.stories?.length || 1) - 1, 0));
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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative w-full max-w-sm h-[78vh] rounded-[2rem] overflow-hidden bg-black shadow-2xl">
          <img
            src={getDishImageUrl(currentStory)}
            alt={currentStory.name || "Story"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_DISH_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

          <div className="absolute top-4 left-4 right-4 flex gap-1">
            {currentStories.map((story, idx) => (
              <div key={story.id || idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                <div className={`h-full rounded-full ${idx <= storyIndex ? "bg-white" : "bg-transparent"}`} />
              </div>
            ))}
          </div>

          <div className="absolute top-8 left-4 right-4 flex items-center justify-between text-white">
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
                  {groups.length > 1 ? `${groupIndex + 1}/${groups.length}` : "Story"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                  aria-label="Delete story"
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="Close story"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="absolute left-0 top-0 bottom-0 w-1/3">
            <button type="button" className="w-full h-full" onClick={goPrev} aria-label="Previous story" />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3">
            <button type="button" className="w-full h-full" onClick={goNext} aria-label="Next story" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={goPrev}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              {currentStory.name || "Untitled dish"}
            </h2>
            {currentStory.description ? (
              <p className="mt-2 text-sm text-white/80 line-clamp-3">
                {currentStory.description}
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
