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

  const [deckList, setDeckList] = useState([]);
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
  const [guestPendingNames, setGuestPendingNames] = useState([]);

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
    try {
      const names = JSON.parse(sessionStorage.getItem(NAMES_KEY) || "[]");
      if (Array.isArray(names)) setGuestPendingNames(names);
    } catch {}
  }, [router, userId]);

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
            cost: 1,
            time: 1,
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
        setDeckList(shuffleArray(ordered));
      }))
      .catch((err) => console.error("Failed to recount saves:", err));
  }, []);

  const orderedList = useMemo(() => {
    return deckList.filter((d) => !addedDishIds.has(d.id));
  }, [deckList, addedDishIds]);

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
        setDeckList((prev) => prev.filter((d) => d.id !== dishToAdd.id));
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
    setDeckList((prev) => prev.filter((d) => d.id !== dishToAdd.id));
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

  const handleResetFeed = async () => {
    setLoadingDishes(true);
    setAddedDishIds(new Set());
    try {
      const items = await getAllDishesFromFirestore();
      const publicItems = items.filter((dish) => dish.isPublic !== false);
      const ordered = publicItems
        .slice()
        .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      setDeckList(shuffleArray(ordered));
    } catch (err) {
      console.error("Failed to reset feed:", err);
      setDeckList([]);
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
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F6F6F2] text-black relative pb-24 overflow-hidden">
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
      <div className="px-5 h-[calc(100vh-132px)] overflow-hidden">
        <SwipeDeck
          dishes={orderedList}
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
          onResetFeed={handleResetFeed}
        />
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
