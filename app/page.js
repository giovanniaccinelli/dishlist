"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SwipeDeck from "../components/SwipeDeck";
import BottomNav from "../components/BottomNav";
import AuthPromptModal from "../components/AuthPromptModal";
import { useAuth } from "./lib/auth";
import {
  addDishToToTryList,
  createDishForUser,
  getAllDishesFromFirestore,
  getDishesFromFirestore,
  getFollowingForUser,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersWhoSavedDish,
  recountDishSavesFromUsers,
  saveDishToUserList,
} from "./lib/firebaseHelpers";
import SaversModal from "../components/SaversModal";
import { CircleUserRound, Send } from "lucide-react";
import ShareModal from "../components/ShareModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./lib/firebase";
import { useRouter } from "next/navigation";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";

export default function Feed() {
  const { user, loading } = useAuth();
  const userId = user?.uid || null;
  const router = useRouter();

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
  const [guestMode, setGuestMode] = useState(null);
  const [guestSavedIds, setGuestSavedIds] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);

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
      return items
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
    const pendingSaved = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(SAVED_KEY) || "[]");
      } catch {
        return [];
      }
    })();
    if (!pendingNames.length && !pendingSaved.length) return;
    (async () => {
      if (pendingNames.length) {
        const uniqueNames = Array.from(new Set(pendingNames.map((n) => String(n).trim()).filter(Boolean))).slice(
          0,
          3
        );
        for (const name of uniqueNames) {
          await createDishForUser({
            name,
            description: "",
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

  const orderedForYou = useMemo(
    () => forYouDeck.filter((d) => !addedDishIds.has(d.id)),
    [forYouDeck, addedDishIds]
  );

  const orderedFollowing = useMemo(
    () => followingDeck.filter((d) => !addedDishIds.has(d.id)),
    [followingDeck, addedDishIds]
  );

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
      return false;
    }
    const saved = await saveDishToUserList(userId, dishToAdd.id, dishToAdd);
    if (!saved) return false;
    setAddedDishIds((prev) => {
      const next = new Set(prev);
      next.add(dishToAdd.id);
      return next;
    });
    setForYouDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    setFollowingDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    return true;
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

  if (loading || loadingDishes) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent text-black relative pb-24 overflow-hidden">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo-real.png" alt="DishList logo" className="w-9 h-9 rounded-full object-cover" />
          <h1 className="text-3xl font-bold">DishList</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={userId ? "/directs" : "/?auth=1"}
            className="w-10 h-10 rounded-full border border-black/20 bg-white flex items-center justify-center"
            aria-label="Open directs"
          >
            <Send size={18} />
          </Link>
          <Link
            href={userId ? "/profile" : "/?auth=1"}
            className="w-10 h-10 rounded-full border border-black/20 bg-white flex items-center justify-center"
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
      <div className="px-5 pt-3 flex justify-center">
        <div className="relative flex items-end gap-10 border-b border-black/12">
          <button
            type="button"
            onClick={() => setActiveFeed("for_you")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "for_you" ? "text-black" : "text-black/45"
            }`}
          >
            For You
            {activeFeed === "for_you" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveFeed("following")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "following" ? "text-black" : "text-black/45"
            }`}
          >
            Following
            {activeFeed === "following" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
        </div>
      </div>
      <div className="px-5 h-[calc(100vh-184px)] overflow-hidden relative">
        <div className={activeFeed === "for_you" ? "block h-full" : "hidden h-full"}>
          <SwipeDeck
            dishes={orderedForYou}
            preserveContinuity
            onAction={handleAdd}
            onRightSwipe={handleRightSwipeToTry}
            onSavesPress={handleOpenSavers}
            onSharePress={handleShare}
            currentUser={user}
            actionOnRightSwipe={false}
            dismissOnAction
            actionLabel="+"
            actionClassName="add-action-btn w-14 h-14 text-[36px]"
            actionToast="ADDING TO YOUR DISHLIST"
            trackSwipes={false}
            onAuthRequired={() => setShowAuthPrompt(true)}
            onResetFeed={() => handleResetFeed("for_you")}
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
              dishes={orderedFollowing}
              preserveContinuity
              onAction={handleAdd}
              onRightSwipe={handleRightSwipeToTry}
              onSavesPress={handleOpenSavers}
              onSharePress={handleShare}
              currentUser={user}
              actionOnRightSwipe={false}
              dismissOnAction
              actionLabel="+"
              actionClassName="add-action-btn w-14 h-14 text-[36px]"
              actionToast="ADDING TO YOUR DISHLIST"
              trackSwipes={false}
              onAuthRequired={() => setShowAuthPrompt(true)}
              onResetFeed={() => handleResetFeed("following")}
            />
          )}
        </div>
      </div>
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
      <BottomNav />
    </div>
  );
}
