"use client";

import { useEffect, useMemo, useState } from "react";
import SwipeDeck from "../components/SwipeDeck";
import BottomNav from "../components/BottomNav";
import AuthPromptModal from "../components/AuthPromptModal";
import { useAuth } from "./lib/auth";
import { getAllDishesFromFirestore, saveDishToUserList } from "./lib/firebaseHelpers";

export default function Feed() {
  const { user, loading } = useAuth();
  const userId = user?.uid || null;

  const [deckList, setDeckList] = useState([]);
  const [addedDishIds, setAddedDishIds] = useState(() => new Set());
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  useEffect(() => {
    setAddedDishIds(new Set());
    (async () => {
      try {
        const items = await getAllDishesFromFirestore();
        const publicItems = items.filter((dish) => dish.isPublic !== false);
        const ordered = publicItems
          .slice()
          .sort((a, b) => {
            const aTime = a?.createdAt?.seconds || 0;
            const bTime = b?.createdAt?.seconds || 0;
            return bTime - aTime;
          });
        setDeckList(shuffleArray(ordered));
      } catch (err) {
        console.error("Failed to load feed dishes:", err);
        setDeckList([]);
      } finally {
        setLoadingDishes(false);
      }
    })();
  }, []);

  const orderedList = useMemo(() => {
    return deckList.filter((d) => !addedDishIds.has(d.id));
  }, [deckList, addedDishIds]);

  const handleAdd = async (dishToAdd) => {
    if (!userId) {
      setShowAuthPrompt(true);
      return false;
    }
    const saved = await saveDishToUserList(userId, dishToAdd.id, dishToAdd);
    if (!saved) return false;
    setAddedDishIds((prev) => {
      const next = new Set(prev);
      next.add(dishToAdd.id);
      return next;
    });
    setDeckList((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    return true;
  };

  if (loading || loadingDishes) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black relative pb-24">
      <div className="px-5">
        <SwipeDeck
          dishes={orderedList}
          preserveContinuity={false}
          onAction={handleAdd}
          dismissOnAction
          actionLabel="+"
          actionClassName="w-14 h-14 rounded-full bg-[#2BD36B] text-black text-3xl font-bold flex items-center justify-center shadow-lg"
          actionToast="ADDING TO YOUR DISHLIST"
          trackSwipes={false}
          onAuthRequired={() => setShowAuthPrompt(true)}
        />
      </div>
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <BottomNav />
    </div>
  );
}
