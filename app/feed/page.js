"use client";
import { useState } from "react";
import TinderCard from "react-tinder-card";
import { motion } from "framer-motion";

export default function Feed() {
  // Simulated dishes from multiple users (later: fetch from DB)
  const [dishes, setDishes] = useState([
    {
      id: 1,
      name: "Homemade Lasagna",
      image: "https://images.unsplash.com/photo-1608751255218-0f44b2b0e5e8",
      user: "Sofia",
    },
    {
      id: 2,
      name: "Carbonara",
      image: "https://images.unsplash.com/photo-1525755662778-989d0524087e",
      user: "Luca",
    },
    {
      id: 3,
      name: "Avocado Toast",
      image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141",
      user: "Marta",
    },
    {
      id: 4,
      name: "Panna e Salsiccia",
      image: "https://images.unsplash.com/photo-1603133872878-684f0c3c34f4",
      user: "Davide",
    },
  ]);

  const [myDishes, setMyDishes] = useState([]);

  const swiped = (direction, dish) => {
    if (direction === "right") {
      setMyDishes([...myDishes, dish]);
    }
    setDishes(dishes.filter((d) => d.id !== dish.id));
  };

  return (
    <div className="h-screen w-full bg-[#0E0E0E] text-white flex flex-col items-center justify-center overflow-hidden">
      <h1 className="text-3xl font-bold mt-6 mb-4">Discover Dishes</h1>
      <div className="relative w-full max-w-md h-[75vh]">
        {dishes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
            You're all caught up!
          </div>
        ) : (
          dishes.map((dish) => (
            <TinderCard
              key={dish.id}
              onSwipe={(dir) => swiped(dir, dish)}
              preventSwipe={["up", "down"]}
              className="absolute w-full"
            >
              <motion.div
                className="relative bg-[#1A1A1A] rounded-2xl shadow-xl overflow-hidden w-full h-[75vh]"
                whileTap={{ scale: 0.97 }}
              >
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <h2 className="text-3xl font-bold">{dish.name}</h2>
                  <p className="text-gray-300 text-sm">by {dish.user}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setMyDishes([...myDishes, dish]);
                    setDishes(dishes.filter((d) => d.id !== dish.id));
                  }}
                  className="absolute bottom-6 right-6 bg-gradient-to-tr from-red-500 to-pink-500 px-6 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition"
                >
                  Add to My Dishlist
                </motion.button>
              </motion.div>
            </TinderCard>
          ))
        )}
      </div>
    </div>
  );
}
