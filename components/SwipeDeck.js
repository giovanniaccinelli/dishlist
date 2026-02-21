"use client";

import { useState, useEffect } from "react";
import TinderCard from "react-tinder-card";
import { motion, AnimatePresence } from "framer-motion";
import { saveDishToUserList, saveSwipedDishForUser } from "../app/lib/firebaseHelpers";
import { useAuth } from "../app/lib/auth";

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
}) {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const [showRecipeByCard, setShowRecipeByCard] = useState({});

  useEffect(() => {
    const formatted = dishes.map((d, i) => ({
      ...d,
      _key: `${d.id || "local"}-${i}`,
    }));
    setCards((prev) => {
      if (prev.length === 0) {
        setDeckEmpty(formatted.length === 0);
        return formatted;
      }

      // Hard reset when upstream list is replaced (e.g. feed reset).
      if (formatted.length < prev.length) {
        setDeckEmpty(formatted.length === 0);
        return formatted;
      }

      // Soft merge for pagination so current swipe state is preserved.
      const existingKeys = new Set(prev.map((c) => c._key));
      const appended = formatted.filter((c) => !existingKeys.has(c._key));
      const merged = appended.length > 0 ? [...prev, ...appended] : prev;
      setDeckEmpty(merged.length === 0);
      return merged;
    });
  }, [dishes]);

  const dismissCard = (dish) => {
    setCards((prev) => {
      const updated = prev.filter((d) => d._key !== dish._key);
      if (updated.length === 0) {
        setDeckEmpty(true);
        if (typeof onDeckEmpty === "function") onDeckEmpty();
      }
      return updated;
    });
  };

  const handleSwipe = async (direction, dish) => {
    if (direction !== "left" && direction !== "right") return;
    if (trackSwipes && user && dish.id) {
      await saveSwipedDishForUser(user.uid, dish.id);
      if (typeof onSwiped === "function") onSwiped(dish.id);
    }
    dismissCard(dish);
  };

  const handleAddToMyList = async (dish) => {
    if (!user) {
      if (typeof onAuthRequired === "function") onAuthRequired();
      return;
    }
    if (!dish?.id) {
      setToast("SAVE FAILED");
      setTimeout(() => setToast(""), 1500);
      return;
    }
    try {
      const savedOk = await saveDishToUserList(user.uid, dish.id, dish);
      if (!savedOk) {
        throw new Error("Save did not persist.");
      }
      await saveSwipedDishForUser(user.uid, dish.id);
      if (typeof onSwiped === "function") onSwiped(dish.id);
    } catch (err) {
      console.error("Save failed:", err);
      setToast("SAVE FAILED");
      setTimeout(() => setToast(""), 1500);
      return;
    }
    setToast("ADDING TO YOUR DISHLIST");
    setTimeout(() => setToast(""), 1200);
    dismissCard(dish);
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

  const toggleRecipeView = (dishKey) => {
    setShowRecipeByCard((prev) => ({ ...prev, [dishKey]: !prev[dishKey] }));
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
            onSwipe={(dir) => handleSwipe(dir, dish)}
          >
            <motion.div
              className="relative bg-white rounded-[28px] shadow-2xl overflow-hidden w-full h-[70vh] cursor-grab"
              style={{ zIndex: cards.length - index }}
            >
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-sm rounded-full p-1 flex gap-1"
                data-no-swipe="1"
                style={{ touchAction: "manipulation" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRecipeByCard((prev) => ({ ...prev, [dish._key]: false }));
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRecipeByCard((prev) => ({ ...prev, [dish._key]: false }));
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                    !showRecipeByCard[dish._key]
                      ? "bg-white text-black"
                      : "text-white/90"
                  }`}
                >
                  dish
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleRecipeView(dish._key);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleRecipeView(dish._key);
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                    showRecipeByCard[dish._key]
                      ? "bg-white text-black"
                      : "text-white/90"
                  }`}
                >
                  recipe
                </button>
              </div>

              <div className="absolute inset-0">
                {showRecipeByCard[dish._key] ? (
                  <div className="absolute inset-0 bg-[#101216] text-white p-6 overflow-y-auto">
                    <h3 className="text-2xl font-bold mb-2">{dish.name}</h3>
                    <p className="text-sm text-white/70 mb-5">
                      {dish.ownerName || "Unknown"}
                    </p>
                    <h4 className="text-sm uppercase tracking-wide text-white/70 mb-2">
                      Ingredients
                    </h4>
                    <p className="text-sm whitespace-pre-wrap mb-5">
                      {dish.recipeIngredients || "No ingredients provided."}
                    </p>
                    <h4 className="text-sm uppercase tracking-wide text-white/70 mb-2">
                      Method
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {dish.recipeMethod || "No method provided."}
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    {renderImage(dish)}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute bottom-20 left-5 right-5 text-white">
                      <p className="text-lg font-semibold">{dish.ownerName || "Unknown"}</p>
                      <h2 className="text-2xl font-bold">{dish.name}</h2>
                      <p className="text-sm text-white/80 line-clamp-2">
                        {dish.description || "No description yet."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-6 right-6">
                {(() => {
                  const isDefaultAddAction =
                    typeof onAction !== "function" && !actionClassName && actionLabel === "+";
                  if (isDefaultAddAction) {
                    return (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleAddToMyList(dish);
                        }}
                        onTouchEnd={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          await handleAddToMyList(dish);
                        }}
                        onPointerUp={async (e) => {
                          if (e.pointerType !== "touch") return;
                          e.stopPropagation();
                          e.preventDefault();
                          await handleAddToMyList(dish);
                        }}
                        className="w-24 h-24 -m-5 flex items-center justify-center"
                        style={{ touchAction: "manipulation" }}
                        aria-label="Action"
                      >
                        <span className="w-14 h-14 rounded-full bg-[#2BD36B] text-black text-3xl font-bold flex items-center justify-center shadow-lg">
                          +
                        </span>
                      </button>
                    );
                  }
                  return (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (typeof onAction === "function") {
                      await onAction(dish);
                      if (actionToast) {
                        setToast(actionToast);
                        setTimeout(() => setToast(""), 1200);
                      }
                      if (dismissOnAction) dismissCard(dish);
                      return;
                    }
                    await handleAddToMyList(dish);
                  }}
                  onTouchEnd={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof onAction === "function") {
                      await onAction(dish);
                      if (actionToast) {
                        setToast(actionToast);
                        setTimeout(() => setToast(""), 1200);
                      }
                      if (dismissOnAction) dismissCard(dish);
                      return;
                    }
                    await handleAddToMyList(dish);
                  }}
                  onPointerUp={async (e) => {
                    if (e.pointerType !== "touch") return;
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof onAction === "function") {
                      await onAction(dish);
                      if (actionToast) {
                        setToast(actionToast);
                        setTimeout(() => setToast(""), 1200);
                      }
                      if (dismissOnAction) dismissCard(dish);
                      return;
                    }
                    await handleAddToMyList(dish);
                  }}
                  className={
                    actionClassName ||
                    "w-14 h-14 rounded-full bg-[#2BD36B] text-black text-3xl font-bold flex items-center justify-center shadow-lg"
                  }
                  aria-label="Action"
                >
                  {actionLabel}
                </button>
                  );
                })()}
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
