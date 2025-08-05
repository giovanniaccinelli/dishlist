"use client";

import { useState, useEffect } from "react";
import TinderCard from "react-tinder-card";
import { motion } from "framer-motion";
import { saveDishToFirestore } from "../app/lib/firebaseHelpers";
import { useAuth } from "../app/lib/auth";

export default function SwipeDeck({ dishes, reloadDishes }) {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [deckEmpty, setDeckEmpty] = useState(false);

  useEffect(() => {
    const formatted = dishes.map((d, i) => ({
      ...d,
      _key: `${d.id || "local"}-${i}`, // stable and unique
    }));
    setCards(formatted);
    setDeckEmpty(formatted.length === 0);
  }, [dishes]);

  const handleSwipeEnd = (info, dishKey) => {
    const threshold = 120;
    if (Math.abs(info.deltaX) > threshold) {
      setCards((prev) => {
        const updated = prev.filter((d) => d._key !== dishKey);
        if (updated.length === 0) setDeckEmpty(true);
        return updated;
      });
    }
  };

  const handleAddToMyList = async (dish) => {
    if (!user) return alert("You need to log in first!");
    await saveDishToFirestore({
      ...dish,
      owner: user.uid,
      ownerName: user.displayName || "Anonymous",
      createdAt: new Date(),
    });
    alert(`${dish.name} added to your dishlist!`);
  };

  const handleReload = async () => {
    await reloadDishes();
    setDeckEmpty(false);
  };

  if (deckEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-[75vh] text-gray-400 text-xl">
        You're all caught up!
        <button
          onClick={handleReload}
          className="mt-4 bg-red-500 hover:bg-red-600 px-6 py-3 rounded-full text-white font-semibold"
        >
          Reload Dishes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md h-[75vh]">
        {cards.map((dish, index) => (
          <TinderCard
            key={dish._key}
            preventSwipe={["up", "down"]}
            className="absolute w-full"
            onCardLeftScreen={() => {}}
            swipeRequirementType="position"
          >
            <motion.div
              drag="x"
              onDragEnd={(e, info) => handleSwipeEnd(info, dish._key)}
              className="relative bg-[#1A1A1A] rounded-2xl shadow-xl overflow-hidden w-full h-[75vh] cursor-grab"
              style={{ zIndex: cards.length - index }}
            >
              <img
                src={dish.imageURL || dish.image}
                alt={dish.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-14 left-6">
                <h2 className="text-3xl font-bold">{dish.name}</h2>
                <p className="text-gray-300 text-sm">
                  by {dish.ownerName || "Unknown Publisher"}
                </p>
                <p className="text-yellow-400 text-sm">
                  ★ {dish.rating || 0}/5
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAddToMyList(dish)}
                className="absolute bottom-6 right-6 bg-gradient-to-tr from-red-500 to-pink-500 px-4 py-2 rounded-full font-semibold text-sm shadow-lg hover:opacity-90 transition"
              >
                Add
              </motion.button>
            </motion.div>
          </TinderCard>
        ))}
      </div>
    </div>
  );
}
