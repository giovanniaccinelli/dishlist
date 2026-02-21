"use client";
import { useState, useEffect } from "react";
import SwipeDeck from "../components/SwipeDeck";
import { getAllDishesFromFirestore, getDishesPage, cleanupDishIdField } from "./lib/firebaseHelpers";
import { useAuth } from "./lib/auth";
import BottomNav from "../components/BottomNav";
import AuthPromptModal from "../components/AuthPromptModal";

const FEED_PAGE_SIZE = 20;

export default function Feed() {
  const { user, loading } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadInitialDishes = async () => {
    setLoadingDishes(true);
    setLoadError("");
    try {
      const firstPage = await getDishesPage({ pageSize: FEED_PAGE_SIZE });
      setDishes(shuffle(firstPage.items));
      setLastDoc(firstPage.lastDoc);
      setHasMore(Boolean(firstPage.lastDoc));
    } catch (err) {
      console.error("Failed to load dishes:", err);
      // Fallback: if paginated query fails due to older data shape, fetch all once.
      try {
        const all = await getAllDishesFromFirestore();
        setDishes(shuffle(all.slice(0, FEED_PAGE_SIZE)));
        setHasMore(all.length > FEED_PAGE_SIZE);
      } catch (fallbackErr) {
        console.error("Fallback feed load failed:", fallbackErr);
        setLoadError("Failed to load feed. Please retry.");
      }
    } finally {
      setLoadingDishes(false);
    }
  };

  const loadMoreDishes = async () => {
    if (!lastDoc || loadingMore || loadingDishes) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const nextPage = await getDishesPage({
        pageSize: FEED_PAGE_SIZE,
        cursor: lastDoc,
      });
      setDishes((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const merged = [...prev];
        nextPage.items.forEach((item) => {
          if (!existingIds.has(item.id)) merged.push(item);
        });
        return merged;
      });
      setLastDoc(nextPage.lastDoc);
      setHasMore(Boolean(nextPage.lastDoc));
    } catch (err) {
      console.error("Failed to load more dishes:", err);
      setLoadError("Could not load more dishes.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitialDishes();
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
        <div className="flex items-center gap-3">
          <img src="/logo-mark.svg" alt="DishList logo" className="w-9 h-9" />
          <h1 className="text-3xl font-bold">DishList</h1>
        </div>
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
      ) : loadError && dishes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[70vh] text-black/70">
          <p>{loadError}</p>
          <button
            onClick={loadInitialDishes}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        <SwipeDeck
          dishes={dishes}
          trackSwipes={false}
          onAuthRequired={() => setShowAuthPrompt(true)}
          onDeckEmpty={loadInitialDishes}
          loadMoreDishes={loadMoreDishes}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onResetFeed={loadInitialDishes}
        />
      )}
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <BottomNav />
    </div>
  );
}
