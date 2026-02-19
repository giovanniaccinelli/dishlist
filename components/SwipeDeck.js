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
  actionLabel = "+",
  actionClassName,
  actionToast,
  trackSwipes = true,
}) {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const formatted = dishes.map((d, i) => ({
      ...d,
      _key: `${d.id || "local"}-${i}`,
    }));
    setCards(formatted);
    setDeckEmpty(formatted.length === 0);
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

  const handleSwipeEnd = async (info, dish) => {
    const threshold = 120;
    if (Math.abs(info.deltaX) > threshold) {
      if (trackSwipes && user && dish.id) {
        await saveSwipedDishForUser(user.uid, dish.id);
        if (typeof onSwiped === "function") onSwiped(dish.id);
      }
      dismissCard(dish);
    }
  };

  const handleAddToMyList = async (dish) => {
    if (!user) return alert("You need to log in first!");
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
                  onClick={async () => {
                    if (typeof onAction === "function") {
                      await onAction(dish);
                      if (actionToast) {
                        setToast(actionToast);
                        setTimeout(() => setToast(""), 1200);
                      }
                      dismissCard(dish);
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
