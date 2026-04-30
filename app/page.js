"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import SwipeDeck from "../components/SwipeDeck";
import BottomNav from "../components/BottomNav";
import AppToast from "../components/AppToast";
import { FeedLoading } from "../components/AppLoadingState";
import AuthPromptModal from "../components/AuthPromptModal";
import { useAuth } from "./lib/auth";
import {
  addDishToToTryList,
  createDishForUser,
  getAllDishesFromFirestore,
  getAllDishlistsForUser,
  getDishesFromFirestore,
  getFollowingForUser,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersWhoSavedDish,
  recountDishSavesFromUsers,
  saveDishToSelectedDishlist,
  saveDishToUserList,
} from "./lib/firebaseHelpers";
import SaversModal from "../components/SaversModal";
import { ChevronLeft, ChevronRight, CircleUserRound, Send, X } from "lucide-react";
import ShareModal from "../components/ShareModal";
import DishlistPickerModal from "../components/DishlistPickerModal";
import { dishModeMatches, DISH_MODE_ALL, DISH_MODE_COOKING, DishModeFilterButton, DishModeFilterModal } from "../components/DishModeControls";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./lib/firebase";
import { useRouter } from "next/navigation";
import { TAG_OPTIONS, getTagChipClass } from "./lib/tags";
import { useUnreadDirects } from "./lib/useUnreadDirects";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";
const SELECTED_DISHES_KEY = "onboarding:selectedDishIds";
const viewedStorageKey = (userId) => `feed:viewedDishes:${userId}`;
const FEED_EXCLUDED_TAGS_KEY = "feed:excludedTags";

export default function Feed() {
  const { user, loading } = useAuth();
  const userId = user?.uid || null;
  const router = useRouter();
  const forYouDeckRef = useRef(null);
  const followingDeckRef = useRef(null);

  const [activeFeed, setActiveFeed] = useState("for_you");
  const [forYouDeck, setForYouDeck] = useState([]);
  const [followingDeck, setFollowingDeck] = useState([]);
  const [addedDishIds, setAddedDishIds] = useState(() => new Set());
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDish, setShareDish] = useState(null);
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["saved"]);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [guestMode, setGuestMode] = useState(null);
  const [guestSavedIds, setGuestSavedIds] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [followingHasUpdate, setFollowingHasUpdate] = useState(false);
  const [viewedDishIds, setViewedDishIds] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [draftExcludedTags, setDraftExcludedTags] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterVersion, setFilterVersion] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = useState(DISH_MODE_ALL);
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(userId);
  const activeDeckRef = activeFeed === "following" ? followingDeckRef : forYouDeckRef;
  const showDishModeFilterButton = true;

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userId) return;
    const done = localStorage.getItem(DONE_KEY);
    if (!done) {
      router.replace("/onboarding");
      return;
    }
    const mode = sessionStorage.getItem(MODE_KEY);
    setGuestMode(mode || null);
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVED_KEY) || "[]");
      if (Array.isArray(saved)) setGuestSavedIds(saved);
    } catch {}
  }, [router, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem(FEED_EXCLUDED_TAGS_KEY) || "[]");
      const parsed = Array.isArray(stored) ? stored : [];
      setExcludedTags(parsed);
      setDraftExcludedTags(parsed);
    } catch {
      setExcludedTags([]);
      setDraftExcludedTags([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !userId) {
      setViewedDishIds([]);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(viewedStorageKey(userId)) || "[]");
      setViewedDishIds(Array.isArray(stored) ? stored : []);
    } catch {
      setViewedDishIds([]);
    }
  }, [userId]);

  useEffect(() => {
    const sortNewest = (items) =>
      items
        .slice()
        .sort((a, b) => {
          const aTime = a?.createdAt?.seconds || 0;
          const bTime = b?.createdAt?.seconds || 0;
          return bTime - aTime;
        });

    const normalizeTags = (items) => {
      const counts = new Map();
      items.forEach((dish) => {
        if (!Array.isArray(dish?.tags)) return;
        dish.tags.forEach((tag) => {
          const clean = String(tag || "").trim().toLowerCase();
          if (!clean) return;
          counts.set(clean, (counts.get(clean) || 0) + 1);
        });
      });
      return counts;
    };

    const buildForYouFeed = (items, tagCounts, followedOwners) => {
      if (!userId) return shuffleArray(sortNewest(items));
      const ranked = items
        .map((dish) => {
          const dishTags = Array.isArray(dish.tags)
            ? dish.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
            : [];
          const overlap = dishTags.reduce((sum, tag) => sum + (tagCounts.get(tag) || 0), 0);
          const followBoost = followedOwners.has(dish.owner) ? 4 : 0;
          const recency = dish?.createdAt?.seconds || 0;
          return {
            ...dish,
            _rank: overlap * 10 + followBoost + recency / 1000000000,
          };
        })
        .sort((a, b) => b._rank - a._rank)
        .map(({ _rank, ...dish }) => dish);

      return shuffleArray(ranked);
    };

    setAddedDishIds(new Set());
    (async () => {
      setLoadingDishes(true);
      try {
        const allItems = await getAllDishesFromFirestore();
        const publicItems = allItems.filter((dish) => dish.isPublic !== false);

        let nextFollowingIds = [];
        let forYou = [];
        let following = [];

        if (userId) {
          const [followed, saved, toTry, uploaded] = await Promise.all([
            getFollowingForUser(userId),
            getSavedDishesFromFirestore(userId),
            getToTryDishesFromFirestore(userId),
            getDishesFromFirestore(userId),
          ]);
          nextFollowingIds = Array.from(new Set(followed || []));
          const followedSet = new Set(nextFollowingIds);
          const tagCounts = normalizeTags([...saved, ...toTry, ...uploaded]);
          forYou = buildForYouFeed(publicItems, tagCounts, followedSet);
          following = sortNewest(publicItems.filter((dish) => followedSet.has(dish.owner)));
        } else {
          forYou = shuffleArray(sortNewest(publicItems));
          following = [];
        }

        setFollowingIds(nextFollowingIds);
        setForYouDeck(forYou);
        setFollowingDeck(following);
      } catch (err) {
        console.error("Failed to load feed dishes:", err);
        setFollowingIds([]);
        setForYouDeck([]);
        setFollowingDeck([]);
      } finally {
        setLoadingDishes(false);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;
    const pendingNames = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(NAMES_KEY) || "[]");
      } catch {
        return [];
      }
    })();
    const pendingSelectedDishIds = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(SELECTED_DISHES_KEY) || "[]");
      } catch {
        return [];
      }
    })();
    const pendingSaved = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(SAVED_KEY) || "[]");
      } catch {
        return [];
      }
    })();
    if (!pendingNames.length && !pendingSaved.length && !pendingSelectedDishIds.length) return;
    (async () => {
      const selectedIds = Array.from(
        new Set(
          pendingSelectedDishIds
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 3);

      if (selectedIds.length) {
        for (const dishId of selectedIds) {
          const snap = await getDoc(doc(db, "dishes", dishId));
          if (!snap.exists()) continue;
          const dishData = { id: snap.id, ...snap.data() };
          await saveDishToUserList(userId, dishId, dishData);
        }
      }

      if (pendingNames.length) {
        const selectedIdSet = new Set(selectedIds);
        const seenNames = new Set();
        for (let index = 0; index < 3; index += 1) {
          if (selectedIdSet.has(String(pendingSelectedDishIds[index] || "").trim())) continue;
          const name = String(pendingNames[index] || "").trim();
          if (!name) continue;
          if (seenNames.has(name)) continue;
          seenNames.add(name);
          await createDishForUser({
            name,
            description: "",
            dishMode: DISH_MODE_COOKING,
            recipeIngredients: "",
            recipeMethod: "",
            tags: [],
            isPublic: true,
            imageURL: "",
            owner: userId,
            ownerName: user?.displayName || "Anonymous",
            ownerPhotoURL: user?.photoURL || "",
            createdAt: new Date(),
          });
        }
      }
      if (pendingSaved.length) {
        for (const dishId of pendingSaved) {
          const snap = await getDoc(doc(db, "dishes", dishId));
          if (!snap.exists()) continue;
          const dishData = { id: snap.id, ...snap.data() };
          await saveDishToUserList(userId, dishId, dishData);
        }
      }
      sessionStorage.removeItem(NAMES_KEY);
      sessionStorage.removeItem(SELECTED_DISHES_KEY);
      sessionStorage.removeItem(SAVED_KEY);
      sessionStorage.removeItem(MODE_KEY);
    })();
  }, [userId, user?.displayName, user?.photoURL]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "1") return;
    if (userId) return;
    setShowAuthPrompt(true);
    params.delete("auth");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `/?${nextQuery}` : "/";
    window.history.replaceState({}, "", nextUrl);
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("recountSaves") !== "1") return;
    recountDishSavesFromUsers()
      .then(() => getAllDishesFromFirestore().then((items) => {
        const publicItems = items.filter((dish) => dish.isPublic !== false);
        const ordered = publicItems
          .slice()
          .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
        setForYouDeck(shuffleArray(ordered));
      }))
      .catch((err) => console.error("Failed to recount saves:", err));
  }, []);

  const excludedTagSet = useMemo(
    () => new Set(excludedTags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)),
    [excludedTags]
  );

  const isDishAllowedByFilters = (dish) => {
    if (!excludedTagSet.size) return true;
    const dishTags = Array.isArray(dish?.tags)
      ? dish.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return !dishTags.some((tag) => excludedTagSet.has(tag));
  };

  const orderedForYou = useMemo(
    () => forYouDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d) && dishModeMatches(d, selectedDishMode)),
    [forYouDeck, addedDishIds, excludedTagSet, selectedDishMode]
  );

  const orderedFollowing = useMemo(
    () => followingDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d) && dishModeMatches(d, selectedDishMode)),
    [followingDeck, addedDishIds, excludedTagSet, selectedDishMode]
  );

  useEffect(() => {
    if (!userId || !followingDeck.length) {
      setFollowingHasUpdate(false);
      return;
    }
    const viewed = new Set(viewedDishIds);
    setFollowingHasUpdate(followingDeck.some((dish) => !viewed.has(dish.id)));
  }, [userId, followingDeck, viewedDishIds]);

  const handleFeedTabChange = (tab) => {
    setActiveFeed(tab);
  };

  const handleDishViewed = (dish) => {
    if (!userId || !dish?.id) return;
    setViewedDishIds((prev) => {
      if (prev.includes(dish.id)) return prev;
      const next = [...prev, dish.id];
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedStorageKey(userId), JSON.stringify(next));
      }
      return next;
    });
  };

  const handleAdd = async (dishToAdd) => {
    if (!userId) {
      if (guestMode === "feed") {
        const nextIds = Array.from(new Set([...guestSavedIds, dishToAdd.id])).slice(0, 3);
        setGuestSavedIds(nextIds);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SAVED_KEY, JSON.stringify(nextIds));
        }
        setAddedDishIds((prev) => {
          const next = new Set(prev);
          next.add(dishToAdd.id);
          return next;
        });
        setForYouDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
        setFollowingDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
        if (nextIds.length >= 3) {
          setShowAuthPrompt(true);
        }
        return true;
      }
      setShowAuthPrompt(true);
      return { skipToast: true };
    }
    setDishlistPickerDish(dishToAdd);
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(userId)).filter(
        (dishlist) => dishlist.id !== "all_dishes" && dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      setSelectedDishlistIds(["saved"]);
    } finally {
      setDishlistsLoading(false);
    }
    return { skipToast: true };
  };

  const handleRightSwipeToTry = async (dishToAdd) => {
    if (!userId) {
      if (guestMode === "feed") return false;
      setShowAuthPrompt(true);
      return false;
    }
    if (!dishToAdd?.id) return;
    await addDishToToTryList(userId, dishToAdd.id, dishToAdd);
  };

  const handleResetFeed = async (feedType) => {
    setLoadingDishes(true);
    try {
      const items = await getAllDishesFromFirestore();
      const publicItems = items.filter((dish) => dish.isPublic !== false);
      const ordered = publicItems
        .slice()
        .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      if (feedType === "following") {
        const followedSet = new Set(followingIds);
        setFollowingDeck(ordered.filter((dish) => followedSet.has(dish.owner)));
      } else {
        setForYouDeck(shuffleArray(ordered));
      }
    } catch (err) {
      console.error("Failed to reset feed:", err);
      if (feedType === "following") {
        setFollowingDeck([]);
      } else {
        setForYouDeck([]);
      }
    } finally {
      setLoadingDishes(false);
    }
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

  const handleShare = (dish) => {
    if (!userId) {
      setShowAuthPrompt(true);
      return;
    }
    setShareDish(dish);
    setShareOpen(true);
  };

  const handleDishlistSelect = async () => {
    if (!userId || !dishlistPickerDish?.id || selectedDishlistIds.length === 0) return;
    const dishToAdd = dishlistPickerDish;
    const results = await Promise.all(
      selectedDishlistIds.map((dishlistId) => saveDishToSelectedDishlist(userId, dishlistId, dishToAdd))
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
    setAddedDishIds((prev) => {
      const next = new Set(prev);
      next.add(dishToAdd.id);
      return next;
    });
    setForYouDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    setFollowingDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
  };

  if (loading || loadingDishes) {
    return <FeedLoading />;
  }

  return (
    <div className="h-[100dvh] bg-transparent text-black relative overflow-hidden flex flex-col">
      <div className="app-top-nav px-4 pb-2 flex items-center justify-between shrink-0 relative">
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="flex items-center gap-3"
          aria-label="Open DishList guide"
        >
          <img src="/logo-real.png" alt="DishList logo" className="w-8 h-8 rounded-full object-cover" />
          <h1 className="text-[1.65rem] font-bold leading-none">DishList</h1>
        </button>
        {showDishModeFilterButton ? (
          <DishModeFilterButton
            value={selectedDishMode}
            onClick={() => setDishModeFilterOpen(true)}
            className="absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+var(--app-top-nav-gap)+1.2rem)] -translate-x-1/2 -translate-y-1/2"
          />
        ) : null}
        <div className="flex items-center gap-2">
          <Link
            href={userId ? "/directs" : "/?auth=1"}
            className="top-action-btn relative"
            aria-label="Open directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <Link
            href={userId ? "/profile" : "/?auth=1"}
            className="top-action-btn"
            aria-label="Open profile"
          >
            <CircleUserRound size={18} />
          </Link>
        </div>
      </div>
      {!userId && guestMode === "feed" && (
        <div className="px-5">
          <div className="bg-white border border-black/10 rounded-2xl px-4 py-3 text-sm text-black/70">
            Add up to three dishes to your DishList. We’ll ask you to create an account after the third.
          </div>
        </div>
      )}
      <div className="px-4 pt-0 grid grid-cols-[48px_1fr_48px] items-end gap-3">
        <button
          type="button"
          onClick={() => activeDeckRef.current?.previous?.()}
          className="flex h-10 w-11 items-center justify-center rounded-[1rem] border-2 border-black/35 bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
          aria-label="Previous dish"
        >
          <ChevronLeft size={21} strokeWidth={2.8} />
        </button>
        <div className="relative mx-auto flex items-end gap-10 border-b border-black/12">
          <button
            type="button"
            onClick={() => handleFeedTabChange("following")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "following" ? "text-black" : "text-black/45"
            }`}
          >
            Following
            {followingHasUpdate ? (
              <span className="no-accent-border absolute -top-0.5 -right-3 w-2.5 h-2.5 rounded-full bg-[#E64646]" />
            ) : null}
            {activeFeed === "following" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => handleFeedTabChange("for_you")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "for_you" ? "text-black" : "text-black/45"
            }`}
          >
            For You
            {activeFeed === "for_you" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
        </div>
        <button
          type="button"
          onClick={() => activeDeckRef.current?.next?.()}
          className="flex h-10 w-11 items-center justify-center justify-self-end rounded-[1rem] border-2 border-black/35 bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
          aria-label="Next dish"
        >
          <ChevronRight size={21} strokeWidth={2.8} />
        </button>
      </div>
      <div className="bottom-nav-spacer px-4 pt-1 flex-1 min-h-0 overflow-hidden relative">
        <div className={activeFeed === "for_you" ? "block h-full" : "hidden h-full"}>
          <SwipeDeck
            ref={forYouDeckRef}
            key={`for-you-${filterVersion}-${excludedTags.join("|")}`}
            dishes={orderedForYou}
            preserveContinuity
            onAction={handleAdd}
            onRightSwipe={handleRightSwipeToTry}
            onSavesPress={handleOpenSavers}
            onSharePress={handleShare}
            currentUser={user}
            fitHeight
            actionOnRightSwipe={false}
            dismissOnAction={false}
            actionLabel="+"
            actionClassName="add-action-btn w-14 h-14 text-[36px]"
            actionToast="Added to DishList"
            trackSwipes={false}
            onAuthRequired={() => setShowAuthPrompt(true)}
            onResetFeed={() => handleResetFeed("for_you")}
            onCardViewed={activeFeed === "for_you" ? handleDishViewed : undefined}
          />
        </div>
        <div className={activeFeed === "following" ? "block h-full" : "hidden h-full"}>
          {!userId ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div>
                <p className="text-lg font-semibold mb-2">Sign in to see the people you follow.</p>
                <button
                  type="button"
                  onClick={() => setShowAuthPrompt(true)}
                  className="bg-black text-white px-5 py-3 rounded-full font-semibold"
                >
                  Sign in
                </button>
              </div>
            </div>
          ) : orderedFollowing.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div>
                <p className="text-lg font-semibold mb-2">No dishes from followed accounts yet.</p>
                <p className="text-sm text-black/60 mb-4">
                  Follow people from the People tab to build this feed.
                </p>
                <Link
                  href="/dishlists"
                  className="inline-flex bg-black text-white px-5 py-3 rounded-full font-semibold"
                >
                  Find people
                </Link>
              </div>
            </div>
          ) : (
            <SwipeDeck
              ref={followingDeckRef}
              key={`following-${filterVersion}-${excludedTags.join("|")}`}
              dishes={orderedFollowing}
              preserveContinuity
              onAction={handleAdd}
              onRightSwipe={handleRightSwipeToTry}
              onSavesPress={handleOpenSavers}
              onSharePress={handleShare}
              currentUser={user}
              fitHeight
              actionOnRightSwipe={false}
              dismissOnAction={false}
              actionLabel="+"
              actionClassName="add-action-btn w-14 h-14 text-[36px]"
              actionToast="Added to DishList"
              trackSwipes={false}
              onAuthRequired={() => setShowAuthPrompt(true)}
              onResetFeed={() => handleResetFeed("following")}
              onCardViewed={activeFeed === "following" ? handleDishViewed : undefined}
            />
          )}
        </div>
      </div>
      <AnimatePresence>
        {filterOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFilterOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.16)]"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-black/45">
                    Feed filter
                  </div>
                  <h2 className="mt-2 text-[1.8rem] leading-none font-semibold text-black">Hide tags</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="w-10 h-10 rounded-[1rem] border border-black/10 bg-white/90 flex items-center justify-center"
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-sm text-black/58">
                Deselect any tag to exclude those dishes from the feed. This stays saved until you change it.
              </p>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => {
                  const normalized = String(tag).toLowerCase();
                  const enabled = !draftExcludedTags.some((item) => String(item).toLowerCase() === normalized);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setDraftExcludedTags((prev) => {
                          const next = prev.some((item) => String(item).toLowerCase() === normalized)
                            ? prev.filter((item) => String(item).toLowerCase() !== normalized)
                            : [...prev, tag];
                          return next;
                        })
                      }
                      className={`px-3 py-1 rounded-full text-xs border transition ${getTagChipClass(tag, enabled)}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftExcludedTags([]);
                    setExcludedTags([]);
                    if (typeof window !== "undefined") {
                      localStorage.setItem(FEED_EXCLUDED_TAGS_KEY, JSON.stringify([]));
                    }
                    setFilterVersion((prev) => prev + 1);
                    setFilterOpen(false);
                  }}
                  className="px-4 py-2 rounded-full border border-black/15 bg-white/85 text-sm font-medium text-black/70"
                >
                  Revert filter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExcludedTags(draftExcludedTags);
                    if (typeof window !== "undefined") {
                      localStorage.setItem(FEED_EXCLUDED_TAGS_KEY, JSON.stringify(draftExcludedTags));
                    }
                    setFilterVersion((prev) => prev + 1);
                    setFilterOpen(false);
                  }}
                  className="px-4 py-2 rounded-full bg-[linear-gradient(135deg,#0F3D63_0%,#2B74B8_100%)] text-white text-sm font-semibold"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <DishModeFilterModal
        open={dishModeFilterOpen}
        value={selectedDishMode}
        onClose={() => setDishModeFilterOpen(false)}
        onSelect={(mode) => {
          setSelectedDishMode(mode);
          setDishModeFilterOpen(false);
        }}
      />
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        dish={shareDish}
        currentUser={user}
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
      <AnimatePresence>
        {aboutOpen ? (
          <motion.div
            className="fixed inset-0 z-[140] bg-black/94 backdrop-blur-sm text-white flex items-center justify-center p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAboutOpen(false)}
          >
            <div
              className="w-full max-w-sm max-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-black text-white shadow-[0_28px_80px_rgba(0,0,0,0.38)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col px-4 pb-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/logo-mark.svg" alt="DishList logo" className="h-10 w-10 object-contain" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0A623]">DishList</div>
                    <h2 className="mt-1 text-[1.25rem] font-bold leading-none">Your playlist, for dishes</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
                  aria-label="Close guide"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto pr-1 max-h-[calc(100dvh-10rem)]">
                <div className="rounded-[1.45rem] bg-white/8 p-3.5">
                  <div className="text-[1rem] font-semibold text-[#F7D36A]">Save what you crave.</div>
                  <p className="mt-1.5 text-sm leading-5 text-white/76">
                    Build a personal catalog of dishes you love, want to try, or want to remember when you have no idea what to eat.
                  </p>
                </div>

                <div className="grid gap-2.5">
                  <div className="rounded-[1.35rem] bg-[#E64646]/16 p-3.5">
                    <div className="mb-2 text-sm font-semibold text-[#FF8D8D]">Feed</div>
                    <p className="text-sm leading-5 text-white/76">
                      Scroll ideas, discover dishes, and keep up with the people whose taste you trust.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] bg-[#F0A623]/16 p-3.5">
                    <div className="mb-2 text-sm font-semibold text-[#FFD07B]">DishLists</div>
                    <p className="text-sm leading-5 text-white/76">
                      Organize your food brain into Top picks, Uploaded, All dishes, or your own custom lists.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] bg-[#2BD36B]/16 p-3.5">
                    <div className="mb-2 text-sm font-semibold text-[#85F0A9]">Stories</div>
                    <p className="text-sm leading-5 text-white/76">
                      Share what you&apos;re eating right now and give people a quick read on your taste.
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-3.5">
                  <div className="text-sm font-semibold text-[#F0A623]">Why it works</div>
                  <p className="mt-2 text-sm leading-5 text-white/76">
                    It turns your scattered food ideas into something you can actually come back to, use, and share.
                  </p>
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AppToast message={toast} variant={toastVariant} />
      <BottomNav />
    </div>
  );
}
