"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useUnreadDirects } from "../../lib/useUnreadDirects";
import BottomNav from "../../../components/BottomNav";
import { FullScreenLoading } from "../../../components/AppLoadingState";
import AppToast from "../../../components/AppToast";
import AppBackButton from "../../../components/AppBackButton";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllDishlistsForUser,
  getCustomDishlistsForUser,
  getDishesFromFirestore,
  getConversationId,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getOrCreateConversation,
  getUsersWhoSavedDish,
  getActiveStoriesForUser,
  markStoryViewed,
  saveDishToSelectedDishlist,
  getStoryPushStatsForUser,
} from "../../lib/firebaseHelpers";
import AuthPromptModal from "../../../components/AuthPromptModal";
import { MoreHorizontal, Plus, Send, Shuffle } from "lucide-react";
import SaversModal from "../../../components/SaversModal";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../../lib/dishImage";
import StoryViewerModal from "../../../components/StoryViewerModal";
import DishlistPickerModal from "../../../components/DishlistPickerModal";

function StoryStatIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="4.05" stroke="#2BD36B" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.8" stroke="#2BD36B" strokeWidth="1.8" opacity="0.88" />
      <path d="M1.35 3.55V8.7" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0.2 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M2.5 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M1.35 8.7V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function PublicProfile() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [profileUser, setProfileUser] = useState(null);
  const [savedDishes, setSavedDishes] = useState([]);
  const [toTryDishes, setToTryDishes] = useState([]);
  const [customDishlists, setCustomDishlists] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [activeDishlistId, setActiveDishlistId] = useState("saved");
  const [dishlistsOpen, setDishlistsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTitle, setConnectionsTitle] = useState("");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsUsers, setConnectionsUsers] = useState([]);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["saved"]);
  const [activeStories, setActiveStories] = useState([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyPushStats, setStoryPushStats] = useState({});
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const viewedAllStories =
    activeStories.length > 0 &&
    activeStories.every((story) => !user?.uid || (story.viewedBy || []).includes(user.uid));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setProfileLoadFailed(false);
      const results = await Promise.allSettled([
        getDoc(doc(db, "users", id)),
        getDishesFromFirestore(id),
        getSavedDishesFromFirestore(id),
        getToTryDishesFromFirestore(id),
        getCustomDishlistsForUser(id),
        getActiveStoriesForUser(id),
        getStoryPushStatsForUser(id),
      ]);

      if (cancelled) return;

      const [userDocRes, dishesRes, savedRes, toTryRes, customRes, storiesRes, statsRes] = results;
      const userDoc = userDocRes.status === "fulfilled" ? userDocRes.value : null;

      if (userDoc?.exists()) {
        setProfileUser({ id: userDoc.id, ...userDoc.data() });
      } else {
        setProfileUser(null);
        setProfileLoadFailed(true);
      }
      setDishes(dishesRes.status === "fulfilled" ? dishesRes.value : []);
      setSavedDishes(savedRes.status === "fulfilled" ? savedRes.value : []);
      setToTryDishes(toTryRes.status === "fulfilled" ? toTryRes.value : []);
      setCustomDishlists(customRes.status === "fulfilled" ? customRes.value : []);
      setActiveStories(storiesRes.status === "fulfilled" ? storiesRes.value : []);
      setStoryPushStats(statsRes.status === "fulfilled" ? statsRes.value : {});
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setIsFollowing(Boolean(profileUser?.followers?.includes(user?.uid)));
  }, [profileUser?.followers, user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryDishlistId = params.get("list");
    if (!queryDishlistId) return;
    setActiveDishlistId(queryDishlistId);
  }, []);

  useEffect(() => {
    if (activeDishlistId === "saved" || activeDishlistId === "all_dishes" || activeDishlistId === "uploaded") return;
    if (customDishlists.some((dishlist) => dishlist.id === activeDishlistId)) return;
    setActiveDishlistId("saved");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("list", "saved");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeDishlistId, customDishlists]);

  const selectDishlist = (dishlistId) => {
    setActiveDishlistId(dishlistId);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("list", dishlistId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const buildProfileReturnTo = () => {
    return `${pathname}?list=${encodeURIComponent(activeDishlistId || "saved")}`;
  };

  // Follow/Unfollow handler
  const handleFollow = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    const userRef = doc(db, "users", id);
    const currentUserRef = doc(db, "users", user.uid);
    const currentFollowers = profileUser.followers || [];
    const newFollowers = isFollowing
      ? currentFollowers.filter(f => f !== user.uid)
      : [...currentFollowers, user.uid];
    await updateDoc(userRef, { followers: newFollowers });
    await updateDoc(currentUserRef, {
      following: isFollowing ? arrayRemove(id) : arrayUnion(id),
    });
    setIsFollowing(!isFollowing);
  };

  const handleSaveDish = async (dish) => {
    if (!user) {
      setShowAuthPrompt(true);
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
      setSelectedDishlistIds(["saved"]);
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
    const saved = results.every(Boolean);
    if (!saved) {
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

  const openConnections = async (type) => {
    if (!profileUser) return;
    const rawIds = type === "followers" ? profileUser.followers || [] : profileUser.following || [];
    const ids = Array.from(new Set(rawIds));
    setConnectionsTitle(type === "followers" ? "Followers" : "Following");
    setConnectionsOpen(true);
    setConnectionsLoading(true);
    try {
      const docs = await Promise.all(ids.map((uid) => getDoc(doc(db, "users", uid))));
      const usersList = docs
        .filter((snap) => snap.exists())
        .map((snap) => ({ id: snap.id, ...snap.data() }));
      setConnectionsUsers(usersList);
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
      setConnectionsUsers([]);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const openShuffleDeck = (source) => {
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    const pool =
      source === "uploaded"
        ? dishes
        : source === "all_dishes"
          ? allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || []
        : source === "to_try"
          ? toTryDishes
          : source === "saved"
            ? savedDishes
            : customDishlist?.dishes || [];
    if (!pool.length) {
      alert("No dishes to shuffle.");
      return;
    }
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    const returnTo = encodeURIComponent(buildProfileReturnTo());
    if (customDishlist) {
      router.push(`/dish/${randomDish.id}?source=dishlist&listId=${customDishlist.id}&mode=shuffle&profileId=${id}&returnTo=${returnTo}`);
      return;
    }
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle&profileId=${id}&returnTo=${returnTo}`);
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

  const handleStoryViewed = async (story) => {
    if (!user?.uid || !story?.id) return;
    await markStoryViewed(id, story.id, user.uid);
    setActiveStories((prev) =>
      prev.map((item) =>
        item.id === story.id
          ? { ...item, viewedBy: Array.from(new Set([...(item.viewedBy || []), user.uid])) }
          : item
      )
    );
  };

  const getStoryPushCount = (dish) => Number(storyPushStats[dish?.id]?.count || 0);
  const sortDishlistDishes = (dishesList) =>
    [...(dishesList || [])].sort(
      (a, b) =>
        getStoryPushCount(b) - getStoryPushCount(a) ||
        Number(b?.saves || 0) - Number(a?.saves || 0)
    );

  const allDishesCollection = Array.from(
    new Map(
      [...dishes, ...savedDishes, ...toTryDishes, ...customDishlists.flatMap((dishlist) => dishlist.dishes || [])]
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );

  const allDishlists = [
    { id: "saved", name: "Top picks", type: "system", dishes: sortDishlistDishes(savedDishes), count: savedDishes.length },
    {
      id: "all_dishes",
      name: "All dishes",
      type: "system",
      dishes: sortDishlistDishes(allDishesCollection),
      count: allDishesCollection.length,
    },
    { id: "uploaded", name: "Uploaded", type: "system", dishes: sortDishlistDishes(dishes), count: dishes.length },
    ...customDishlists.map((dishlist) => ({
      ...dishlist,
      dishes: sortDishlistDishes(dishlist.dishes || []),
    })),
  ];

  const activeDishlist =
    allDishlists.find((dishlist) => dishlist.id === activeDishlistId) || allDishlists[0] || null;
  const allDishesCount = allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.count || 0;

  const renderDishCounters = (dish) => (
    <div className="flex items-center gap-3.5 text-[13px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
      <div className="inline-flex items-center gap-1.5">
        <StoryStatIcon size={14} />
        <span>: {getStoryPushCount(dish)}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleOpenSavers(dish);
        }}
        className="pointer-events-auto text-left"
      >
        saves: {Number(dish.saves || 0)}
      </button>
    </div>
  );


  if (!profileUser && !profileLoadFailed) {
    return <FullScreenLoading title="Loading profile" />;
  }
  if (!profileUser && profileLoadFailed) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        This profile couldn&apos;t be loaded.
      </div>
    );
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-[74px] items-center gap-2">
          <AppBackButton fallback="/dishlists" />
        </div>
        <div className="flex flex-1 items-center justify-start">
          {user?.uid !== id ? (
            <button
              onClick={handleFollow}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                isFollowing
                  ? "bg-[linear-gradient(135deg,#F4E9D5_0%,#FCF5E7_100%)] text-[#2B2418] border-[#D8C9AF]"
                  : "bg-[linear-gradient(135deg,#EAF7EE_0%,#F4FBF2_100%)] text-[#165D32] border-[#C7E3CB]"
              }`}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          ) : null}
        </div>
        <div className="flex min-w-[74px] items-center justify-end gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!user) {
                setShowAuthPrompt(true);
                return;
              }
              const targetUser = {
                id,
                uid: id,
                displayName: profileUser?.displayName || "",
                photoURL: profileUser?.photoURL || "",
              };
              const conversationId =
                (await getOrCreateConversation(user, targetUser)) || getConversationId(user.uid, id);
              if (conversationId) {
                router.push(`/directs/${conversationId}`);
              }
            }}
            className="top-action-btn relative"
            aria-label="Directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeStories.length > 0) setStoriesOpen(true);
              }}
              className={`no-accent-border h-20 w-20 rounded-full p-[4px] ${
                activeStories.length > 0
                  ? viewedAllStories
                    ? "bg-[#C6C6BF]"
                    : "bg-[#2BD36B]"
                  : "bg-transparent"
              }`}
              aria-label="Open stories"
            >
              <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[3px]">
                <div className="no-accent-border w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden">
                  {profileUser.photoURL ? (
                    <img
                      src={profileUser.photoURL}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    profileUser.displayName?.[0] || "U"
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="flex-1 min-h-20 flex flex-col justify-start py-0.5">
            <h1 className="text-[1.8rem] leading-none font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileUser.followers?.length || 0}</div>
                <button
                  onClick={() => openConnections("followers")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  followers
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileUser.following?.length || 0}</div>
                <button
                  onClick={() => openConnections("following")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  following
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{dishes.length}</div>
                <button
                  onClick={() => selectDishlist("uploaded")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  uploaded
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{allDishesCount}</div>
                <button
                  onClick={() => selectDishlist("all_dishes")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  dishes
                </button>
              </div>
            </div>
          </div>
        </div>

        {profileUser.bio ? (
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/68 whitespace-pre-wrap">{profileUser.bio}</p>
        ) : null}

      </div>

      <div className="mb-3 flex items-center justify-center gap-2">
        {[
          { id: "saved", label: "Top picks" },
          { id: "uploaded", label: "Uploaded" },
          { id: "all_dishes", label: "All dishes" },
        ].map((item) => {
          const active = activeDishlistId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectDishlist(item.id)}
              className={`rounded-full border-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? item.id === "saved"
                    ? "border-[#D94A4A] bg-[linear-gradient(180deg,#FFE4E4_0%,#FFC4C4_100%)] text-[#7E1717] shadow-[0_10px_22px_rgba(217,74,74,0.18)]"
                    : item.id === "uploaded"
                      ? "border-[#D5B647] bg-[linear-gradient(180deg,#FFF8D9_0%,#F7E8A8_100%)] text-[#3F3100] shadow-[0_10px_22px_rgba(213,182,71,0.18)]"
                      : "border-[#1E8A4C] bg-[linear-gradient(180deg,#F4FFF7_0%,#DDF6E5_100%)] text-[#176A37] shadow-[0_10px_22px_rgba(43,211,107,0.16)]"
                  : "border-black/30 bg-white text-black"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDishlistsOpen(true)}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-black/35 bg-white text-black shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
          aria-label="Open all dishlists"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{activeDishlist?.name || "Top picks"}</h2>
        <button
          onClick={() => openShuffleDeck(activeDishlist?.id || "saved")}
          className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
          disabled={(activeDishlist?.dishes || []).length === 0}
        >
          <Shuffle size={14} />
          Shuffle
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(activeDishlist?.dishes || []).length === 0 ? (
          <div className="col-span-2 bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes here.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {(activeDishlist?.dishes || []).map((dish, index) => (
              <motion.div
                key={`${activeDishlist?.id || "list"}-${dish.id || index}`}
                className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
              >
                <Link
                  href={
                    activeDishlist?.type === "custom"
                      ? `/dish/${dish.id}?source=dishlist&listId=${activeDishlist.id}&mode=single&profileId=${id}&returnTo=${encodeURIComponent(buildProfileReturnTo())}`
                      : `/dish/${dish.id}?source=${activeDishlist?.id || "saved"}&mode=single&profileId=${id}&returnTo=${encodeURIComponent(buildProfileReturnTo())}`
                  }
                  className="absolute inset-0 z-10"
                >
                  <span className="sr-only">Open dish card</span>
                </Link>
                <img
                  src={getDishImageUrl(dish, "thumb")}
                  alt={dish.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-40 object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5 text-white pointer-events-none flex flex-col justify-end gap-1">
                  <div className="text-[17px] font-bold leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                    {dish.name || "Untitled dish"}
                  </div>
                  {renderDishCounters(dish)}
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    handleSaveDish(dish);
                  }}
                  className="add-action-btn absolute top-2 right-2 z-30 w-9 h-9 text-[24px]"
                  aria-label="Add to dishlist"
                >
                  <Plus size={16} strokeWidth={2.1} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>


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
        {connectionsOpen && (
          <motion.div
            className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{connectionsTitle}</h3>
                <button onClick={() => setConnectionsOpen(false)} className="text-sm text-black/60">
                  Close
                </button>
              </div>
              {connectionsLoading ? (
                <div className="text-black/60">Loading...</div>
              ) : connectionsUsers.length === 0 ? (
                <div className="bg-[#f0f0ea] rounded-xl h-24 flex items-center justify-center text-gray-500">
                  No users.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {connectionsUsers.map((u) => (
                    <Link
                      key={u.id}
                      href={user?.uid === u.id ? "/profile" : `/profile/${u.id}`}
                      onClick={() => setConnectionsOpen(false)}
                      className="bg-white rounded-2xl p-4 shadow-md border border-black/5 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/10 flex items-center justify-center text-lg font-bold">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt="Profile"
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-full object-cover"
                          />
                        ) : (
                          u.displayName?.[0] || "U"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{u.displayName || "User"}</div>
                        <div className="text-xs text-black/60">
                          {u.followers?.length || 0} followers
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dishlistsOpen && (
          <motion.div
            className="fixed inset-0 z-[88] bg-[#F6F6F2] overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishlistsOpen(false)}
          >
            <motion.div
              className="min-h-screen w-full px-4 pb-28 pt-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto w-full max-w-3xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                    Dishlists
                  </div>
                  <h3 className="mt-2 text-[1.7rem] leading-none font-semibold text-black">
                    {profileUser.displayName || "User"}&apos;s lists
                  </h3>
                </div>
                <button type="button" onClick={() => setDishlistsOpen(false)} className="text-sm text-black/55">
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {allDishlists.map((dishlist) => {
                  const preview = [...(dishlist.dishes || [])]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 4);
                  return (
                    <button
                      key={dishlist.id}
                      type="button"
                      onClick={() => {
                        selectDishlist(dishlist.id);
                        setDishlistsOpen(false);
                      }}
                      className="rounded-[1.5rem] border border-black/10 bg-[#FBF8F1] p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
                    >
                      <div className="mb-2 truncate text-sm font-semibold text-black">{dishlist.name}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Array.from({ length: 4 }).map((_, index) => {
                          const dish = preview[index];
                          return dish ? (
                            <img
                              key={`${dishlist.id}-${dish.id}-${index}`}
                              src={getDishImageUrl(dish, "thumb")}
                              alt={dish.name || dishlist.name}
                              className="aspect-square w-full rounded-[0.85rem] object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_DISH_IMAGE;
                              }}
                            />
                          ) : (
                            <div
                              key={`${dishlist.id}-empty-${index}`}
                              className="aspect-square w-full rounded-[0.85rem] bg-black/6"
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AppToast message={toast} variant={toastVariant} />
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
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={profileUser.displayName || "User"}
        ownerPhotoURL={profileUser.photoURL || ""}
        onViewed={handleStoryViewed}
        currentUser={user}
      />
    </div>
  );
}
