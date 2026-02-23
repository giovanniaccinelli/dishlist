"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";
import {
  getAllDishesFromFirestore,
  getDishesPage,
  getUsersWhoSavedDish,
  saveDishToUserList,
} from "../lib/firebaseHelpers";
import { useAuth } from "../lib/auth";
import AuthPromptModal from "../../components/AuthPromptModal";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import SaversModal from "../../components/SaversModal";

const DISHES_PAGE_SIZE = 24;

const normalizeTag = (tag) => String(tag || "").trim().toLowerCase();

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
  const [allDishesPool, setAllDishesPool] = useState(null);
  const [allDishesLoading, setAllDishesLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [toast, setToast] = useState("");
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [selectedTagsDraft, setSelectedTagsDraft] = useState([]);
  const [selectedTagsApplied, setSelectedTagsApplied] = useState([]);
  const [filteredLimit, setFilteredLimit] = useState(DISHES_PAGE_SIZE);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);

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

  const usingGlobalFilter = search.trim().length > 0 || selectedTagsApplied.length > 0;

  const ensureAllDishesLoaded = async () => {
    if (allDishesPool) return allDishesPool;
    if (allDishesLoading) return null;
    setAllDishesLoading(true);
    setLoadError("");
    try {
      const all = await getAllDishesFromFirestore();
      setAllDishesPool(all);
      return all;
    } catch (err) {
      console.error("Failed to load full dishes pool:", err);
      setLoadError("Failed to load filtered dishes.");
      return null;
    } finally {
      setAllDishesLoading(false);
    }
  };

  useEffect(() => {
    if (!usingGlobalFilter) return;
    if (allDishesPool || allDishesLoading) return;
    let cancelled = false;
    const run = async () => {
      setAllDishesLoading(true);
      try {
        const all = await getAllDishesFromFirestore();
        if (!cancelled) setAllDishesPool(all);
      } catch (err) {
        console.error("Failed to load full search pool:", err);
      } finally {
        if (!cancelled) setAllDishesLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [allDishesLoading, allDishesPool, usingGlobalFilter]);

  useEffect(() => {
    setFilteredLimit(DISHES_PAGE_SIZE);
  }, [search, selectedTagsApplied]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = usingGlobalFilter ? allDishesPool || dishes : dishes;
    const normalizedSelectedTags = selectedTagsApplied
      .map((tag) => normalizeTag(tag))
      .filter(Boolean);
    const tagFiltered =
      normalizedSelectedTags.length === 0
        ? source
        : source.filter((d) => {
            if (!Array.isArray(d.tags)) return false;
            const dishTags = d.tags.map((tag) => normalizeTag(tag)).filter(Boolean);
            return normalizedSelectedTags.every((tag) => dishTags.includes(tag));
          });
    if (!term) return tagFiltered;
    return tagFiltered.filter((d) => {
      const nameMatch = d.name?.toLowerCase().includes(term);
      const tagMatch = Array.isArray(d.tags)
        ? d.tags.some((tag) => normalizeTag(tag).includes(term))
        : false;
      return nameMatch || tagMatch;
    });
  }, [allDishesPool, dishes, search, selectedTagsApplied, usingGlobalFilter]);

  const visibleDishes = usingGlobalFilter ? filtered.slice(0, filteredLimit) : filtered;

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

  const toggleTagFilter = (tag) => {
    setSelectedTagsDraft((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
  };

  const removeAppliedTag = async (tag) => {
    const next = selectedTagsApplied.filter((t) => t !== tag);
    setSelectedTagsApplied(next);
    setSelectedTagsDraft(next);
    if (search.trim() || next.length > 0) {
      await ensureAllDishesLoaded();
    }
  };

  const applyTagFilters = async () => {
    setApplyingFilters(true);
    await ensureAllDishesLoaded();
    setSelectedTagsApplied(selectedTagsDraft);
    setShowTagsPicker(false);
    setFilteredLimit(DISHES_PAGE_SIZE);
    setApplyingFilters(false);
  };

  const handleOpenSavers = async (dish) => {
    setSaversOpen(true);
    setSaversLoading(true);
    try {
      const usersList = await getUsersWhoSavedDish(dish?.id);
      setSaversUsers(usersList);
    } finally {
      setSaversLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-4">Dishes</h1>
      <div className="relative mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search dishes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 p-3 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/30"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {selectedTagsApplied.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border ${getTagChipClass(
                tag,
                true
              )}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeAppliedTag(tag)}
                className="text-black/70 hover:text-black leading-none"
                aria-label={`Remove ${tag} filter`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedTagsApplied.length === 0 && (
            <span className="text-xs text-black/50">No tag filters selected</span>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedTagsDraft(selectedTagsApplied);
              setShowTagsPicker(true);
            }}
            className="px-3 py-1 rounded-full border border-black bg-black text-white text-xs font-medium"
          >
            Add filters
          </button>
        </div>
        {showTagsPicker && (
          <div className="absolute z-40 mt-2 w-full bg-white border border-black/10 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-black">Select tags</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedTagsDraft(selectedTagsApplied);
                  setShowTagsPicker(false);
                }}
                className="px-3 py-1 rounded-full border border-black/20 text-xs font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const active = selectedTagsDraft.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTagFilter(tag)}
                    className={`px-3 py-1 rounded-full text-xs border ${getTagChipClass(tag, active)}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTagsDraft([])}
                className="px-3 py-2 rounded-full border border-black/20 text-xs font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyTagFilters}
                disabled={applyingFilters}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-semibold"
              >
                {applyingFilters ? "Applying..." : "Done"}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-black/60">Loading dishes...</div>
      ) : applyingFilters || (usingGlobalFilter && allDishesLoading && !allDishesPool) ? (
        <div className="text-black/60">Loading filtered dishes...</div>
      ) : loadError && visibleDishes.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-black/70">
          <p>{loadError}</p>
          <button
            onClick={fetchDishes}
            className="mt-4 bg-black text-white px-5 py-2 rounded-full font-semibold"
          >
            Retry
          </button>
        </div>
      ) : visibleDishes.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No dishes found.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {visibleDishes.map((dish, index) => {
            const imageSrc =
              dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
            return (
              <div
                key={`${dish.id}-${index}`}
                className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
              >
                <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                  <span className="sr-only">Open dish card</span>
                </Link>
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
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-white pointer-events-none">
                  <div className="text-[11px] font-semibold leading-tight truncate">
                    {dish.name || "Untitled dish"}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleOpenSavers(dish);
                    }}
                    className="text-[10px] text-white/80 pointer-events-auto"
                  >
                    saves: {Number(dish.saves || 0)}
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
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
                  className="add-action-btn absolute top-2 right-2 z-30 w-9 h-9 text-[24px]"
                  aria-label="Add to dishlist"
                >
                  <Plus size={16} strokeWidth={2.1} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && usingGlobalFilter && filtered.length > visibleDishes.length && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setFilteredLimit((prev) => prev + DISHES_PAGE_SIZE)}
            className="bg-black text-white px-6 py-3 rounded-full font-semibold"
          >
            Load More
          </button>
        </div>
      )}

      {!loading && !usingGlobalFilter && hasMore && (
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
      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
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
