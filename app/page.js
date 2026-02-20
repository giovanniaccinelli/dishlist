"use client";
import { useState, useEffect } from "react";
import SwipeDeck from "../components/SwipeDeck";
import { getAllDishesFromFirestore, cleanupDishIdField } from "./lib/firebaseHelpers";
import { useAuth } from "./lib/auth";
import BottomNav from "../components/BottomNav";
import AuthPromptModal from "../components/AuthPromptModal";

export default function Feed() {
  const { user, loading } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadDishes = async () => {
    setLoadingDishes(true);
    try {
      const all = await getAllDishesFromFirestore();
      setDishes(shuffle(all));
    } catch (err) {
      console.error("Failed to load dishes:", err);
      alert("Failed to load dishes. Please try again.");
    } finally {
      setLoadingDishes(false);
    }
  };

  useEffect(() => {
    loadDishes();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "1" && !user) {
      setShowAuthPrompt(true);
    }
    if (params.get("migrate") === "1") {
      cleanupDishIdField()
        .then((count) => {
          alert(`Cleanup done. Removed id field from ${count} dishes.`);
        })
        .catch((err) => {
          console.error("Cleanup failed:", err);
          alert("Cleanup failed. Check console.");
        });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black relative">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-3xl font-bold">DishList</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!user) {
                setShowAuthPrompt(true);
                return;
              }
              window.location.href = "/profile";
            }}
            className="w-10 h-10 rounded-full border border-black/20 flex items-center justify-center"
            aria-label="Profile"
          >
            <span className="text-xl">👤</span>
          </button>
        </div>
      </div>
      {loadingDishes && dishes.length === 0 ? (
        <div className="flex items-center justify-center h-[70vh] text-black/60">
          Loading feed...
        </div>
      ) : (
        <SwipeDeck
          dishes={dishes}
          trackSwipes={false}
          onAuthRequired={() => setShowAuthPrompt(true)}
          onDeckEmpty={loadDishes}
          loadMoreDishes={loadDishes}
          hasMore={false}
          loadingMore={loadingDishes}
          onResetFeed={loadDishes}
        />
      )}
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <BottomNav />
    </div>
  );
}
