"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";
import { getAllDishesFromFirestore, getDishesPage, saveDishToUserList } from "../lib/firebaseHelpers";
import { useAuth } from "../lib/auth";
import AuthPromptModal from "../../components/AuthPromptModal";
import { AnimatePresence, motion } from "framer-motion";

const DISHES_PAGE_SIZE = 24;

export default function Dishes() {
  const { user } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [fallbackPool, setFallbackPool] = useState([]);
  const [usingFallbackPagination, setUsingFallbackPagination] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [toast, setToast] = useState("");

  const fetchDishes = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const firstPage = await getDishesPage({ pageSize: DISHES_PAGE_SIZE });
      setDishes(firstPage.items);
      setLastDoc(firstPage.lastDoc);
      setHasMore(Boolean(firstPage.lastDoc));
      setFallbackPool([]);
      setUsingFallbackPagination(false);
    } catch (err) {
      console.error("Failed to load dishes page:", err);
      try {
        const all = await getAllDishesFromFirestore();
        setDishes(all.slice(0, DISHES_PAGE_SIZE));
        setFallbackPool(all);
        setUsingFallbackPagination(true);
        setLastDoc(null);
        setHasMore(all.length > DISHES_PAGE_SIZE);
      } catch (fallbackErr) {
        console.error("Fallback dishes load failed:", fallbackErr);
        setLoadError("Failed to load dishes.");
      }
    }
    setLoading(false);
  };

  const fetchMoreDishes = async () => {
    if (loadingMore || loading) return;

    if (usingFallbackPagination) {
      setLoadingMore(true);
      try {
        setDishes((prev) => {
          const nextSlice = fallbackPool.slice(prev.length, prev.length + DISHES_PAGE_SIZE);
          const merged = [...prev, ...nextSlice];
          setHasMore(merged.length < fallbackPool.length);
          return merged;
        });
      } finally {
        setLoadingMore(false);
      }
      return;
    }

    if (!lastDoc) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      let cursor = lastDoc;
      let nextPage = { items: [], lastDoc: null };
      let guard = 0;
      while (cursor && guard < 8) {
        nextPage = await getDishesPage({
          pageSize: DISHES_PAGE_SIZE,
          cursor,
        });
        if (nextPage.items.length > 0 || !nextPage.lastDoc) break;
        cursor = nextPage.lastDoc;
        guard += 1;
      }
      setDishes((prev) => {
        const ids = new Set(prev.map((d) => d.id));
        const merged = [...prev];
        nextPage.items.forEach((item) => {
          if (!ids.has(item.id)) merged.push(item);
        });
        return merged;
      });
      setLastDoc(nextPage.lastDoc);
      setHasMore(Boolean(nextPage.lastDoc));
    } catch (err) {
      console.error("Failed to load more dishes:", err);
      try {
        const all = await getAllDishesFromFirestore();
        setFallbackPool(all);
        setUsingFallbackPagination(true);
        let mergedLength = 0;
        setDishes((prev) => {
          const ids = new Set(prev.map((d) => d.id));
          const merged = [...prev];
          all.forEach((item) => {
            if (!ids.has(item.id) && merged.length < prev.length + DISHES_PAGE_SIZE) {
              merged.push(item);
            }
          });
          mergedLength = merged.length;
          return merged;
        });
        setHasMore(mergedLength < all.length);
      } catch (fallbackErr) {
        console.error("Fallback load more failed:", fallbackErr);
        setLoadError("Could not load more dishes.");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchDishes();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dishes;
    return dishes.filter((d) => d.name?.toLowerCase().includes(term));
  }, [dishes, search]);

  const handleSave = async (dish) => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    const saved = await saveDishToUserList(user.uid, dish.id, dish);
    if (!saved) {
      setToast("SAVE FAILED");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setToast("ADDING TO YOUR DISHLIST");
    setTimeout(() => setToast(""), 1200);
  };

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-4">Dishes</h1>
      <input
        type="text"
        placeholder="Search dishes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-6 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/30"
      />

      {loading ? (
        <div className="text-black/60">Loading dishes...</div>
      ) : loadError && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-black/70">
          <p>{loadError}</p>
          <button
            onClick={fetchDishes}
            className="mt-4 bg-black text-white px-5 py-2 rounded-full font-semibold"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No dishes found.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((dish, index) => {
            const imageSrc =
              dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
            return (
              <div
                key={`${dish.id}-${index}`}
                className="bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer"
                onClick={() => handleSave(dish)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleSave(dish);
                }}
                onPointerUp={(e) => {
                  if (e.pointerType === "touch") {
                    e.preventDefault();
                    handleSave(dish);
                  }
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={dish.name}
                    className="w-full h-28 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/file.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center bg-neutral-200 text-gray-500">
                    No image
                  </div>
                )}
                <div className="p-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">{dish.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(dish);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSave(dish);
                    }}
                    onPointerUp={(e) => {
                      if (e.pointerType !== "touch") return;
                      e.stopPropagation();
                      e.preventDefault();
                      handleSave(dish);
                    }}
                    className="w-8 h-8 rounded-full bg-[#2BD36B] text-black text-xl font-bold flex items-center justify-center"
                    aria-label="Add to dishlist"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !search.trim() && hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={fetchMoreDishes}
            disabled={loadingMore}
            className="bg-black text-white px-6 py-3 rounded-full font-semibold disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      <BottomNav />
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
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
