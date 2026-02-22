"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TinderCard from "react-tinder-card";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Plus } from "lucide-react";

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
  disabled = false,
}) {
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const [showRecipe, setShowRecipe] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [swipeHintDirection, setSwipeHintDirection] = useState(null);

  const currentCard = useMemo(() => deck[currentIndex] || null, [deck, currentIndex]);
  const currentCardRef = useRef(null);
  const swipeAddEnabled = actionLabel === "+" && typeof onAction === "function";

  useEffect(() => {
    currentCardRef.current = currentCard;
  }, [currentCard]);

  useEffect(() => {
    setShowRecipe(false);
    setSwipeHintDirection(null);
  }, [currentCard?._key]);

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
      setDeck(formatted);
      setCurrentIndex(0);
      setDeckEmpty(formatted.length === 0);
      return;
    }

    setDeck((prev) => {
      const existing = new Set(prev.map((d) => d._key));
      const appended = formatted.filter((d) => !existing.has(d._key));
      if (appended.length === 0) return prev;
      setDeckEmpty(false);
      return [...prev, ...appended];
    });
  }, [dishes, deckInitialized, preserveContinuity]);

  useEffect(() => {
    const remaining = deck.length - (currentIndex + 1);
    if (remaining <= 5 && hasMore && !loadingMore && typeof loadMoreDishes === "function") {
      loadMoreDishes();
    }
  }, [currentIndex, deck.length, hasMore, loadingMore, loadMoreDishes]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(""), 1200);
  };

  const runAction = async (card) => {
    if (!card) return false;
    if (typeof onAction !== "function") {
      if (typeof onAuthRequired === "function") onAuthRequired();
      return false;
    }
    try {
      const result = await onAction(card);
      if (result === false) {
        showToast("ACTION FAILED");
        return false;
      }
      showToast(actionToast || "ADDING TO YOUR DISHLIST");
      return true;
    } catch (err) {
      console.error("Deck action failed:", err);
      showToast("ACTION FAILED");
      return false;
    }
  };

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

  const handleSwipe = async (direction) => {
    if (disabled) return;
    const card = currentCardRef.current;
    if (!card) return;

    if (swipeAddEnabled && direction === "right") {
      await runAction(card);
    }

    if (trackSwipes && typeof onSwiped === "function" && card.id) {
      await onSwiped(card.id);
    }

    advanceCard();
  };

  const handleActionPress = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || actionBusy) return;

    const card = currentCardRef.current;
    if (!card) return;

    setActionBusy(true);
    try {
      const ok = await runAction(card);
      if (!ok || !dismissOnAction) return;

      if (trackSwipes && typeof onSwiped === "function" && card.id) {
        await onSwiped(card.id);
      }
      advanceCard();
    } finally {
      setActionBusy(false);
    }
  };

  const handleStartOver = () => {
    if (typeof onResetFeed === "function") {
      onResetFeed();
      return;
    }
    setCurrentIndex(0);
    setDeckEmpty(false);
    setShowRecipe(false);
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
            onClick={handleStartOver}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold"
          >
            Start Over
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center">
      <div className="relative w-full max-w-md h-[70vh]">
        <TinderCard
          key={currentCard._key}
          preventSwipe={["up", "down"]}
          swipeRequirementType="position"
          swipeThreshold={90}
          onSwipe={handleSwipe}
          onSwipeRequirementFulfilled={(dir) => {
            if (dir === "left" || dir === "right") setSwipeHintDirection(dir);
          }}
          onSwipeRequirementUnfulfilled={() => {
            setSwipeHintDirection(null);
          }}
          onCardLeftScreen={() => {
            setSwipeHintDirection(null);
          }}
        >
          <motion.div className="pressable-card relative bg-white rounded-[28px] overflow-hidden w-full h-[70vh] cursor-grab">
            <AnimatePresence>
              {swipeHintDirection === "right" && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#2BD36B]/25"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.8 }}
                    className="w-44 h-44 rounded-full border-4 border-white/80 bg-[#2BD36B]/35 backdrop-blur-sm flex items-center justify-center"
                  >
                    <Plus size={96} strokeWidth={2.2} className="text-white" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {swipeHintDirection === "left" && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.8 }}
                    className="w-44 h-44 rounded-full border-4 border-white/80 bg-black/35 backdrop-blur-sm flex items-center justify-center text-white text-[100px] leading-none font-light"
                  >
                    ×
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              data-no-drag="true"
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerMoveCapture={(e) => e.stopPropagation()}
              onPointerUpCapture={(e) => e.stopPropagation()}
            >
              <div className="bg-black/65 text-white rounded-full p-1 flex items-center gap-1">
                <button
                  data-no-drag="true"
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
                  data-no-drag="true"
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

            <div className="absolute top-4 right-4 z-30 bg-black/65 text-white text-xs font-semibold px-3 py-1 rounded-full">
              saves: {Number(currentCard.saves || 0)}
            </div>

            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: showRecipe ? 180 : 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                <button
                  type="button"
                  className="absolute inset-x-0 top-0 bottom-36 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRecipe((prev) => !prev);
                  }}
                  aria-label="Toggle dish and recipe view"
                />
                {renderImage(currentCard)}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-20 left-5 right-5 text-white z-20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-xs font-bold">
                      {currentCard.ownerPhotoURL ? (
                        <img
                          src={currentCard.ownerPhotoURL}
                          alt={currentCard.ownerName || "User"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (currentCard.ownerName?.[0] || "U").toUpperCase()
                      )}
                    </div>
                    {currentCard.owner ? (
                      <Link
                        data-no-drag="true"
                        href={`/profile/${currentCard.owner}`}
                        className="text-lg font-semibold leading-none underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentCard.ownerName || "Unknown"}
                      </Link>
                    ) : (
                      <p className="text-lg font-semibold leading-none">
                        {currentCard.ownerName || "Unknown"}
                      </p>
                    )}
                  </div>
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
                <button
                  type="button"
                  className="absolute inset-x-0 top-0 bottom-36 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRecipe((prev) => !prev);
                  }}
                  aria-label="Toggle dish and recipe view"
                />
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
                data-no-drag="true"
                onClick={handleActionPress}
                className={actionClassName || "add-action-btn w-14 h-14 text-[36px]"}
                aria-label="Action"
                disabled={disabled || actionBusy}
              >
                {actionLabel === "+" ? <Plus size={26} strokeWidth={2.1} /> : actionLabel}
              </button>
            </div>
          </motion.div>
        </TinderCard>
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
