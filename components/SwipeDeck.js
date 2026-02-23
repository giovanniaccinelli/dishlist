"use client";

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  animate,
} from "framer-motion";
import Link from "next/link";
import { DollarSign, Hourglass, Plus } from "lucide-react";

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
  const SWIPE_EJECT_THRESHOLD = 70;

  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const [showRecipe, setShowRecipe] = useState(false);
  const [isEjecting, setIsEjecting] = useState(false);
  const dragControls = useDragControls();
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-240, 0, 240], [-14, 0, 14]);
  const swipeAddEnabled = actionLabel === "+" && typeof onAction === "function";
  const rightCueOpacity = useTransform(dragX, [0, 50, 160], [0, 0.25, 0.75]);
  const leftCueOpacity = useTransform(dragX, [0, -50, -160], [0, 0.25, 0.75]);
  const rightCueScale = useTransform(dragX, [0, 50, 160], [0.7, 0.9, 1.1]);
  const leftCueScale = useTransform(dragX, [0, -50, -160], [0.7, 0.9, 1.1]);

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

  const runAction = (card) => {
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
  };

  const handleActionPress = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isEjecting) return;
    const card = currentCard;
    if (dismissOnAction) advanceCard();
    dragX.set(0);
    runAction(card);
  };

  const handleStartOver = () => {
    if (typeof onResetFeed === "function") {
      onResetFeed();
      return;
    }
    setCurrentIndex(0);
    setDeckEmpty(false);
    setShowRecipe(false);
    dragX.set(0);
  };

  const handleSwipeEnd = async (info, dish) => {
    if (disabled || isEjecting) return;
    if (Math.abs(info.offset.x) >= SWIPE_EJECT_THRESHOLD) {
      const direction = info.offset.x > 0 ? 1 : -1;
      setIsEjecting(true);
      if (swipeAddEnabled && info.offset.x > 0) {
        runAction(dish);
      }
      if (trackSwipes && typeof onSwiped === "function") onSwiped(dish.id);

      const targetX =
        direction * (typeof window !== "undefined" ? window.innerWidth * 1.2 : 700);
      try {
        await animate(dragX, targetX, {
          type: "spring",
          stiffness: 280,
          damping: 28,
          mass: 0.6,
        }).finished;
      } catch {}
      advanceCard();
      setIsEjecting(false);
      dragX.set(0);
      return;
    }
    animate(dragX, 0, {
      type: "spring",
      stiffness: 420,
      damping: 34,
      mass: 0.55,
    });
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

  const getTags = (dish) => {
    if (!Array.isArray(dish?.tags)) return [];
    return dish.tags
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  };

  const TAG_COLORS = [
    "bg-[#DFF3FF] text-[#123B52]",
    "bg-[#E9FBD8] text-[#1D4F1A]",
    "bg-[#FFF2D9] text-[#6A3E00]",
    "bg-[#FFE3EC] text-[#6A1A36]",
    "bg-[#EDE8FF] text-[#33205D]",
    "bg-[#E5F7F4] text-[#0F4D45]",
  ];

  const normalizeLevel = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(3, Math.round(n)));
  };

  const renderLevelDots = (level, colorClass) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((idx) => (
        <span
          key={idx}
          className={`w-2.5 h-2.5 rounded-full border ${colorClass} ${
            idx <= level ? "opacity-100" : "opacity-25"
          }`}
        />
      ))}
    </div>
  );

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
      <div className="relative w-full max-w-md h-[74vh]">
        <motion.div
          key={currentCard._key}
          drag={disabled || isEjecting ? false : "x"}
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          style={{ x: dragX, rotate: cardRotate }}
          onPointerDown={(e) => {
            if (disabled) return;
            const target = e.target;
            if (target instanceof Element && target.closest("[data-no-drag='true']")) return;
            dragControls.start(e);
          }}
          onDragEnd={(e, info) => handleSwipeEnd(info, currentCard)}
          className="pressable-card relative bg-white rounded-[28px] overflow-hidden w-full h-[74vh] cursor-grab"
        >
          {swipeAddEnabled && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#2BD36B]/25"
              style={{ opacity: rightCueOpacity }}
            >
              <motion.div
                style={{ scale: rightCueScale }}
                className="w-48 h-48 rounded-full border-4 border-white/80 bg-[#2BD36B]/35 backdrop-blur-sm flex items-center justify-center"
              >
                <Plus size={110} strokeWidth={2.1} className="text-white" />
              </motion.div>
            </motion.div>
          )}
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30"
            style={{ opacity: leftCueOpacity }}
          >
            <motion.div
              style={{ scale: leftCueScale }}
              className="w-48 h-48 rounded-full border-4 border-white/80 bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-[110px] leading-none font-light"
            >
              ×
            </motion.div>
          </motion.div>
          <div
            data-no-drag="true"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
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
          <div className="absolute right-4 top-14 z-30 bg-black/65 rounded-2xl px-3 py-2.5 flex flex-col gap-2 text-white">
            <div className="flex items-center gap-1.5 text-[#2BD36B]">
              <DollarSign size={14} strokeWidth={2.2} />
              {renderLevelDots(normalizeLevel(currentCard.cost), "border-[#2BD36B] bg-[#2BD36B]")}
            </div>
            <div className="flex items-center gap-1.5 text-[#FACC15]">
              <Hourglass size={14} strokeWidth={2.2} />
              {renderLevelDots(
                normalizeLevel(currentCard.time ?? currentCard.difficulty),
                "border-[#FACC15] bg-[#FACC15]"
              )}
            </div>
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
                className="absolute inset-x-0 top-0 bottom-44 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRecipe((prev) => !prev);
                }}
                aria-label="Toggle dish and recipe view"
              />
              {renderImage(currentCard)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-28 left-5 right-5 text-white z-20">
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
                className="absolute inset-x-0 top-0 bottom-44 z-10"
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

          <div className="absolute bottom-14 right-6">
            <button
              data-no-drag="true"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerMove={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                handleActionPress(e);
              }}
              className={
                actionClassName ||
                "add-action-btn w-14 h-14 text-[36px]"
              }
              aria-label="Action"
              disabled={disabled}
            >
              {actionLabel === "+" ? <Plus size={26} strokeWidth={2.1} /> : actionLabel}
            </button>
          </div>

          <div className="absolute left-5 right-5 bottom-4 z-30 flex flex-wrap gap-2">
            {getTags(currentCard).map((tag, idx) => (
              <span
                key={`${tag}-${idx}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  TAG_COLORS[idx % TAG_COLORS.length]
                }`}
              >
                {tag}
              </span>
            ))}
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
