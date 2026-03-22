"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";

export default function StoryViewerModal({
  open,
  onClose,
  stories,
  ownerName,
  ownerPhotoURL,
  onViewed,
}) {
  const [index, setIndex] = useState(0);

  const activeStories = useMemo(() => (Array.isArray(stories) ? stories : []), [stories]);
  const currentStory = activeStories[index] || null;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, stories]);

  useEffect(() => {
    if (!open || !currentStory?.id) return;
    onViewed?.(currentStory);
  }, [open, currentStory?.id, onViewed]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative w-full max-w-sm h-[78vh] rounded-[2rem] overflow-hidden bg-black shadow-2xl">
          {currentStory ? (
            <>
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
                {activeStories.map((story, idx) => (
                  <div key={story.id || idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${idx <= index ? "bg-white" : "bg-transparent"}`}
                    />
                  </div>
                ))}
              </div>

              <div className="absolute top-8 left-4 right-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center font-semibold">
                    {ownerPhotoURL ? (
                      <img src={ownerPhotoURL} alt={ownerName || "User"} className="w-full h-full object-cover" />
                    ) : (
                      (ownerName?.[0] || "U").toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{ownerName || "User"}</div>
                    <div className="text-xs text-white/70 truncate">Story</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                  aria-label="Close story"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="absolute left-0 top-0 bottom-0 w-1/3">
                <button
                  type="button"
                  className="w-full h-full"
                  onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                  aria-label="Previous story"
                />
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-1/3">
                <button
                  type="button"
                  className="w-full h-full"
                  onClick={() => {
                    if (index >= activeStories.length - 1) {
                      onClose?.();
                      return;
                    }
                    setIndex((prev) => Math.min(activeStories.length - 1, prev + 1));
                  }}
                  aria-label="Next story"
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                    aria-label="Previous"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index >= activeStories.length - 1) {
                        onClose?.();
                        return;
                      }
                      setIndex((prev) => Math.min(activeStories.length - 1, prev + 1));
                    }}
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
            </>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
