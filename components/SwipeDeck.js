"use client";

import { useEffect, useMemo, useState } from "react";
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
  const SWIPE_EJECT_THRESHOLD = 70;

  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const [showRecipe, setShowRecipe] = useState(false);

  useEffect(() => {
    const formatted = dishes.map((d, i) => ({
      ...d,
      _key: d.id || `${d.owner || "local"}-${d.name || "dish"}-${i}`,
    }));

    if (!deckInitialized) {
      if (formatted.length > 0) {
        setDeck(formatted);
        setCurrentIndex(0);
        setDeckInitialized(true);
        setDeckEmpty(false);
      } else {
        setDeckEmpty(true);
      }
      return;
    }

    if (!preserveContinuity) {
      setDeck((prev) => {
        const existing = new Set(prev.map((d) => d._key));
        const appended = formatted.filter((d) => !existing.has(d._key));
        return appended.length > 0 ? [...prev, ...appended] : prev;
      });
    }
  }, [dishes, deckInitialized, preserveContinuity]);

  const currentCard = useMemo(() => deck[currentIndex] || null, [deck, currentIndex]);

  useEffect(() => {
    setShowRecipe(false);
  }, [currentCard?._key]);

  const advanceCard = () => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= deck.length) {
        setDeckEmpty(true);
        if (typeof onDeckEmpty === "function") onDeckEmpty();
      }
      return next;
    });
  };

  const handleSwipeEnd = (info, dish) => {
    if (Math.abs(info.offset.x) >= SWIPE_EJECT_THRESHOLD) {
      if (trackSwipes && typeof onSwiped === "function") onSwiped(dish.id);
      advanceCard();
    }
  };

  const renderImage = (dish) => {
    const imageSrc = dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
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

  if (deckEmpty || !currentCard) {
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
        <motion.div
          key={currentCard._key}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          onDragEnd={(e, info) => handleSwipeEnd(info, currentCard)}
          className="relative bg-white rounded-[28px] overflow-hidden w-full h-[70vh] cursor-grab"
          whileTap={{ scale: 0.98 }}
        >
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerMoveCapture={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
          >
            <div className="bg-black/65 text-white rounded-full p-1 flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowRecipe(false);
                }}
                className={`px-4 py-1 rounded-full text-sm font-semibold ${
                  !showRecipe ? "bg-white text-black" : "text-white/80"
                }`}
              >
                dish
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowRecipe(true);
                }}
                className={`px-4 py-1 rounded-full text-sm font-semibold ${
                  showRecipe ? "bg-white text-black" : "text-white/80"
                }`}
              >
                recipe
              </button>
            </div>
          </div>

          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: showRecipe ? 180 : 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
              {renderImage(currentCard)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-20 left-5 right-5 text-white">
                <p className="text-lg font-semibold">{currentCard.ownerName || "Unknown"}</p>
                <h2 className="text-2xl font-bold">{currentCard.name}</h2>
                <p className="text-sm text-white/80 line-clamp-2">
                  {currentCard.description || "No description yet."}
                </p>
              </div>
            </div>

            <div
              className="absolute inset-0 bg-white text-black p-6 pt-16 overflow-y-auto"
              style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
            >
              <p className="text-sm font-semibold text-black/60 mb-1">
                {currentCard.ownerName || "Unknown"}
              </p>
              <h2 className="text-2xl font-bold mb-3">{currentCard.name}</h2>
              {currentCard.description ? (
                <p className="text-sm text-black/70 mb-4">{currentCard.description}</p>
              ) : null}
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-1">Ingredients</h3>
                <p className="text-sm text-black/80 whitespace-pre-wrap">
                  {currentCard.recipeIngredients || "No ingredients provided."}
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold mb-1">Method</h3>
                <p className="text-sm text-black/80 whitespace-pre-wrap">
                  {currentCard.recipeMethod || "No method provided."}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="absolute bottom-6 right-6">
            <button
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();

                const card = currentCard;
                if (dismissOnAction) advanceCard();

                if (typeof onAction !== "function") {
                  if (typeof onAuthRequired === "function") onAuthRequired();
                  return;
                }

                Promise.resolve(onAction(card))
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
                "w-14 h-14 rounded-full bg-[#2BD36B] text-black text-3xl font-bold flex items-center justify-center"
              }
              aria-label="Action"
            >
              {actionLabel}
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed inset-x-4 top-24 z-50 bg-[#1F8B3B] text-white text-center py-3 rounded-xl font-bold tracking-wide"
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
