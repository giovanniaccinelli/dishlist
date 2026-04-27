"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "../../components/BottomNav";
import { DishGridLoading, DishInlineLoading } from "../../components/AppLoadingState";
import AppToast from "../../components/AppToast";
import {
  getAllDishlistsForUser,
  getAllDishesFromFirestore,
  getDishesPage,
  publishDishAsStory,
  getUsersWhoSavedDish,
  saveDishToSelectedDishlist,
} from "../lib/firebaseHelpers";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import AuthPromptModal from "../../components/AuthPromptModal";
import { AnimatePresence, motion } from "framer-motion";
import { CircleUserRound, Plus, Send } from "lucide-react";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import SaversModal from "../../components/SaversModal";
import DishlistPickerModal from "../../components/DishlistPickerModal";

const DISHES_PAGE_SIZE = 24;
const DISHES_SCROLL_BATCH = 3;
const DISH_ROW_ESTIMATE_PX = 148;

const normalizeTag = (tag) => String(tag || "").trim().toLowerCase();
const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchesFlexibleDishSearch = (dish, rawTerm) => {
  const term = normalizeSearchText(rawTerm);
  if (!term) return true;

  const haystacks = [
    normalizeSearchText(dish?.name),
    normalizeSearchText(dish?.description),
    ...(Array.isArray(dish?.tags) ? dish.tags.map((tag) => normalizeSearchText(tag)) : []),
  ].filter(Boolean);

  if (haystacks.some((item) => item.includes(term))) return true;

  const tokens = term.split(" ").filter(Boolean);
  if (!tokens.length) return true;

  const hayTokens = haystacks.flatMap((item) => item.split(" ").filter(Boolean));
  const matchedTokens = tokens.filter((token) =>
    haystacks.some((item) => item.includes(token)) ||
    hayTokens.some(
      (hayToken) =>
        hayToken.startsWith(token) ||
        token.startsWith(hayToken) ||
        hayToken.includes(token) ||
        (token.length >= 4 &&
          hayToken.length >= 4 &&
          Math.abs(hayToken.length - token.length) <= 2 &&
          hayToken.slice(0, token.length - 1) === token.slice(0, token.length - 1))
    )
  );

  return matchedTokens.length >= Math.max(1, Math.ceil(tokens.length * 0.6));
};

function StoryPlateIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4.05" stroke="#2BD36B" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.8" stroke="#2BD36B" strokeWidth="1.8" opacity="0.88" />
      <path
        d="M1.35 3.55V8.7"
        stroke="#2BD36B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M0.2 3.55V6.2"
        stroke="#2BD36B"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M2.5 3.55V6.2"
        stroke="#2BD36B"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M1.35 8.7V19"
        stroke="#2BD36B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08"
        stroke="#2BD36B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M23.6 3.55V19"
        stroke="#2BD36B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Dishes() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [storyPicker, setStoryPicker] = useState(false);
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
  const [toastVariant, setToastVariant] = useState("success");
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["saved"]);
  const [targetDishlistId, setTargetDishlistId] = useState("saved");
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [selectedTagsDraft, setSelectedTagsDraft] = useState([]);
  const [selectedTagsApplied, setSelectedTagsApplied] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(DISHES_PAGE_SIZE);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [loadingMoreFiltered, setLoadingMoreFiltered] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const scrollContainerRef = useRef(null);
  const dishesLoadMoreRef = useRef(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStoryPicker(params.get("storyPicker") === "1");
    setSearch(params.get("q") || "");
    setTargetDishlistId(params.get("targetList") || "saved");
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
    if (!search.trim()) return;
    ensureAllDishesLoaded();
  }, [search]);

  useEffect(() => {
    setVisibleLimit(DISHES_PAGE_SIZE);
  }, [search, selectedTagsApplied]);

  const filtered = useMemo(() => {
    const term = search.trim();
    const source =
      usingGlobalFilter && Array.isArray(allDishesPool) && allDishesPool.length > 0
        ? allDishesPool
        : dishes;
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
    const searchFiltered = term
      ? tagFiltered.filter((dish) => matchesFlexibleDishSearch(dish, term))
      : tagFiltered;
    return searchFiltered
      .slice()
      .sort((leftDish, rightDish) => {
        const savesDelta = Number(rightDish?.saves || 0) - Number(leftDish?.saves || 0);
        if (savesDelta !== 0) return savesDelta;
        const recencyDelta =
          Number(rightDish?.createdAt?.seconds || 0) - Number(leftDish?.createdAt?.seconds || 0);
        if (recencyDelta !== 0) return recencyDelta;
        return String(leftDish?.name || "").localeCompare(String(rightDish?.name || ""));
      });
  }, [allDishesPool, dishes, search, selectedTagsApplied, usingGlobalFilter]);

  const visibleDishes = filtered.slice(0, visibleLimit);
  const hasMoreVisibleDishes = filtered.length > visibleDishes.length;
  const shouldShowInfiniteLoader = !loading && (hasMoreVisibleDishes || (!usingGlobalFilter && hasMore));

  const loadMoreVisibleDishes = (node, root) => {
    if (loadingMoreFiltered || !hasMoreVisibleDishes) return;
    let nextBatch = DISHES_SCROLL_BATCH;
    if (node && root) {
      const nodeTop = node.getBoundingClientRect().top;
      const rootBottom = root.getBoundingClientRect().bottom;
      const overshoot = Math.max(rootBottom - nodeTop, 0);
      const extraRows = Math.max(1, Math.ceil(overshoot / DISH_ROW_ESTIMATE_PX));
      nextBatch = Math.min(extraRows * 3, 15);
    }
    setLoadingMoreFiltered(true);
    window.setTimeout(() => {
      setVisibleLimit((prev) => Math.min(prev + nextBatch, filtered.length));
      setLoadingMoreFiltered(false);
    }, 70);
  };

  useEffect(() => {
    if (
      !shouldShowInfiniteLoader ||
      loadingMore ||
      loadingMoreFiltered ||
      applyingFilters ||
      allDishesLoading
    ) {
      return;
    }

    const node = dishesLoadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (hasMoreVisibleDishes) {
          loadMoreVisibleDishes(node, root);
          return;
        }
        fetchMoreDishes();
      },
      {
        root,
        rootMargin: "120px 0px",
        threshold: 0.05,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    allDishesLoading,
    applyingFilters,
    filtered.length,
    hasMore,
    hasMoreVisibleDishes,
    loading,
    loadingMore,
    loadingMoreFiltered,
    shouldShowInfiniteLoader,
    usingGlobalFilter,
    visibleLimit,
  ]);

  const handleSave = async (dish) => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    if (storyPicker) {
      const saved = await publishDishAsStory(user.uid, dish);
      if (!saved) {
        setToastVariant("error");
        setToast("Story failed");
        setTimeout(() => setToast(""), 1200);
        return;
      }
      setToastVariant("success");
      setToast("Added to Story");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setDishlistPickerDish(dish);
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(user.uid)).filter(
        (dishlist) => dishlist.id !== "all_dishes" && dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      const nextSelectedIds =
        targetDishlistId !== "all_dishes" && targetDishlistId !== "uploaded"
          ? [targetDishlistId]
          : ["saved"];
      setSelectedDishlistIds(Array.from(new Set(nextSelectedIds)));
    } finally {
      setDishlistsLoading(false);
    }
  };

  const handleDishlistSelect = async () => {
    if (!user?.uid || !dishlistPickerDish?.id || selectedDishlistIds.length === 0) return;
    const results = await Promise.all(
      selectedDishlistIds.map((dishlistId) =>
        saveDishToSelectedDishlist(user.uid, dishlistId, dishlistPickerDish)
      )
    );
    if (results.some((result) => !result)) {
      setToastVariant("error");
      setToast("Save failed");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setDishlistPickerOpen(false);
    setDishlistPickerDish(null);
    setToastVariant("success");
    setToast("Added to DishList");
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
    setVisibleLimit(DISHES_PAGE_SIZE);
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

  const handleDishNameSearch = (dishName) => {
    const params = new URLSearchParams();
    params.set("q", dishName || "");
    if (storyPicker) params.set("storyPicker", "1");
    setSelectedTagsApplied([]);
    setSelectedTagsDraft([]);
    setSearch(dishName || "");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/dishes?${params.toString()}`);
    } else {
      router.push(`/dishes?${params.toString()}`);
    }
  };


  return (
    <div
      ref={scrollContainerRef}
      className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative"
    >
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{storyPicker ? "Search Dish" : "Dishes"}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={user ? "/directs" : "/?auth=1"}
            className="top-action-btn relative"
            aria-label="Open directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <Link
            href={user ? "/profile" : "/?auth=1"}
            className="top-action-btn"
            aria-label="Open profile"
          >
            <CircleUserRound size={18} />
          </Link>
        </div>
      </div>
      <div className="relative mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search dishes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 pl-4 pr-4 py-3.5 rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] border border-black/10 text-black shadow-[0_12px_30px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-black/15 placeholder:text-black/38"
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
        <DishGridLoading label="Loading dishes" />
      ) : applyingFilters ? (
        <DishGridLoading label="Loading filtered dishes" />
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
        <div className="grid grid-cols-2 gap-3">
          {visibleDishes.map((dish) => {
            const imageSrc = getDishImageUrl(dish, "thumb");
            return (
              <div
                key={dish.id || `${dish.owner || "dish"}-${dish.name || "untitled"}`}
                className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
              >
                <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                  <span className="sr-only">Open dish card</span>
                </Link>
                <img
                  src={imageSrc}
                  alt={dish.name}
                  className="w-full h-40 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDishNameSearch(dish.name || "");
                    }}
                    className="pointer-events-auto text-left text-[11px] font-semibold leading-tight truncate hover:underline"
                  >
                    {dish.name || "Untitled dish"}
                  </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOpenSavers(dish);
                  }}
                  className="text-[10px] text-white/80 pointer-events-auto text-left self-start"
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
                  {storyPicker ? <StoryPlateIcon size={18} className="text-[#2BD36B]" /> : <Plus size={16} strokeWidth={2.1} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {shouldShowInfiniteLoader && (
        <div ref={dishesLoadMoreRef} className="mt-6 mb-3">
          {loadingMore || loadingMoreFiltered || (usingGlobalFilter && allDishesLoading) ? (
            <DishInlineLoading />
          ) : (
            <div className="h-10" aria-hidden="true" />
          )}
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
      <DishlistPickerModal
        open={dishlistPickerOpen}
        onClose={() => {
          setDishlistPickerOpen(false);
          setDishlistPickerDish(null);
        }}
        lists={dishlists}
        dishName={dishlistPickerDish?.name || "dish"}
        mode="multiple"
        selectedIds={selectedDishlistIds}
        onToggle={(dishlist) =>
          setSelectedDishlistIds((prev) =>
            prev.includes(dishlist.id)
              ? prev.filter((id) => id !== dishlist.id)
              : [...prev, dishlist.id]
          )
        }
        onConfirm={handleDishlistSelect}
        confirmLabel="Add dish"
        loading={dishlistsLoading}
      />
      <AppToast message={toast} variant={toastVariant} />
    </div>
  );
}
