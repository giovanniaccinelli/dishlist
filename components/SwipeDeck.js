"use client";

import { useState, useEffect, useRef } from "react";
import TinderCard from "react-tinder-card";
import { motion, AnimatePresence } from "framer-motion";

export default function SwipeDeck({
  dishes,
  onSwiped,
  onDeckEmpty,
  loadMoreDishes,
  hasMore,
  loadingMore,
  onResetFeed,
  onAction,
  dismissOnAction = true,
  actionLabel = "+",
  actionClassName,
  actionToast,
  trackSwipes = true,
  onAuthRequired,
  preserveContinuity = true,
}) {
  const SWIPE_EJECT_THRESHOLD = 110;
  const [cards, setCards] = useState([]);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const dismissedKeys = useRef(new Set());
  const touchStart = useRef({ x: 0, y: 0 });
  const touchMoved = useRef(false);
  const didDrag = useRef(false);

  useEffect(() => {
    const formatted = dishes.map((d) => ({
      ...d,
      _key: d.id || `${d.owner || "local"}-${d.name || "dish"}-${d.createdAt?.seconds || Date.now()}`,
    }));

    if (formatted.length === 0) {
      dismissedKeys.current = new Set();
    }

    const visibleFormatted = formatted.filter((c) => !dismissedKeys.current.has(c._key));
    setCards((prev) => {
      if (prev.length === 0) {
        setDeckEmpty(visibleFormatted.length === 0);
        return visibleFormatted;
      }

      // Keep continuity: once a deck session starts, don't reset/reshuffle it
      // from upstream data updates until this deck is exhausted.
      if (preserveContinuity) {
        return prev;
      }

      // Soft merge for pagination so current swipe state is preserved.
      const existingKeys = new Set(prev.map((c) => c._key));
      const appended = visibleFormatted.filter((c) => !existingKeys.has(c._key));
      const merged = appended.length > 0 ? [...prev, ...appended] : prev;
      setDeckEmpty(merged.length === 0);
      return merged;
    });
  }, [dishes, preserveContinuity]);

  const dismissCard = (dish) => {
    dismissedKeys.current.add(dish._key);
    setCards((prev) => {
      const updated = prev.filter((d) => d._key !== dish._key);
      if (updated.length === 0) {
        setDeckEmpty(true);
        if (typeof onDeckEmpty === "function") onDeckEmpty();
      }
      return updated;
    });
  };

  const handleSwipeEnd = async (info, dish) => {
    if (Math.abs(info.deltaX) >= SWIPE_EJECT_THRESHOLD) {
      if (trackSwipes && typeof onSwiped === "function") onSwiped(dish.id);
      dismissCard(dish);
    }
  };

  const renderImage = (dish) => {
    const imageSrc =
      dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
    if (!imageSrc || imageSrc === "undefined" || imageSrc === "null") {
      return (
        <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-gray-500">
          No image available
        </div>
      );
    }
    return (
      <img
        src={imageSrc}
        alt={dish.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = "/file.svg";
        }}
      />
    );
  };

  if (deckEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-gray-500 text-lg">
        You&apos;re all caught up!
        {hasMore ? (
          <button
            onClick={loadMoreDishes}
            disabled={loadingMore}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        ) : (
          <button
            onClick={onResetFeed}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold"
          >
            Start Over
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md h-[70vh]">
        {cards.map((dish, index) => (
          <TinderCard
            key={dish._key}
            preventSwipe={["up", "down"]}
            className="absolute w-full"
            swipeRequirementType="position"
          >
            <motion.div
              drag="x"
              onDragEnd={(e, info) => handleSwipeEnd(info, dish)}
              onDragStart={() => {
                didDrag.current = true;
              }}
              onPointerDown={(e) => {
                didDrag.current = false;
                if (e.pointerType === "touch") {
                  touchStart.current = { x: e.clientX, y: e.clientY };
                  touchMoved.current = false;
                }
              }}
              onPointerMove={(e) => {
                if (e.pointerType === "touch") {
                  const dx = Math.abs(e.clientX - touchStart.current.x);
                  const dy = Math.abs(e.clientY - touchStart.current.y);
                  if (dx > 6 || dy > 6) touchMoved.current = true;
                }
              }}
              onPointerUp={(e) => {
                if (e.pointerType === "touch") {
                  touchMoved.current = false;
                }
              }}
              className="relative bg-white rounded-[28px] shadow-2xl overflow-hidden w-full h-[70vh] cursor-grab"
              style={{ zIndex: cards.length - index }}
              whileTap={{ scale: 0.98 }}
            >
              {renderImage(dish)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-20 left-5 right-5 text-white">
                <p className="text-lg font-semibold">{dish.ownerName || "Unknown"}</p>
                <h2 className="text-2xl font-bold">{dish.name}</h2>
                <p className="text-sm text-white/80 line-clamp-2">
                  {dish.description || "No description yet."}
                </p>
              </div>
              <div className="absolute bottom-6 right-6">
                <button
                  onPointerUp={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof onAction !== "function") {
                      if (typeof onAuthRequired === "function") onAuthRequired();
                      return;
                    }

                    // Immediate eject: behave like a swipe and move on instantly.
                    if (dismissOnAction) dismissCard(dish);

                    Promise.resolve(onAction(dish))
                      .then((result) => {
                        if (result === false) {
                          setToast("ACTION FAILED");
                          setTimeout(() => setToast(""), 1200);
                          return;
                        }
                        setToast(actionToast || "ADDING TO YOUR DISHLIST");
                        setTimeout(() => setToast(""), 1200);
                      })
                      .catch((err) => {
                        console.error("Deck action failed:", err);
                        setToast("ACTION FAILED");
                        setTimeout(() => setToast(""), 1200);
                      });
                  }}
                  className={
                    actionClassName ||
                    "w-14 h-14 rounded-full bg-[#2BD36B] text-black text-3xl font-bold flex items-center justify-center shadow-lg"
                  }
                  aria-label="Action"
                >
                  {actionLabel}
                </button>
              </div>
            </motion.div>
          </TinderCard>
        ))}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed inset-x-4 top-24 z-50 bg-[#1F8B3B] text-white text-center py-3 rounded-xl font-bold tracking-wide shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
