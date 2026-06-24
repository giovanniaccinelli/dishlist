"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import SwipeDeck from "../components/SwipeDeck";
import BottomNav from "../components/BottomNav";
import AppToast from "../components/AppToast";
import { FeedLoading, FeedLogoLoading } from "../components/AppLoadingState";
import AuthPromptModal from "../components/AuthPromptModal";
import { useAuth } from "./lib/auth";
import {
  createDishForUser,
  getAllDishlistsForUser,
  getCommentsForDish,
  getCommentsForStory,
  getDishesFromFirestore,
  getDishesPage,
  getFollowingForUser,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersByIds,
  getUsersWhoSavedDish,
  markStoryViewed,
  normalizeProfilePhotoURL,
  queueDishForDishlistSorting,
  recountDishSavesFromUsers,
  saveDishToSelectedDishlist,
  saveDishToUserList,
} from "./lib/firebaseHelpers";
import SaversModal from "../components/SaversModal";
import { Bell, ChevronLeft, ChevronRight, Hand, Heart, MessageCircle, Plus, Send, UserPlus, Users, Utensils, X } from "lucide-react";
import ShareModal from "../components/ShareModal";
import DishlistPickerModal from "../components/DishlistPickerModal";
import StoryViewerModal from "../components/StoryViewerModal";
import {
  dishModeMatches,
  DISH_MODE_ALL,
  DISH_MODE_COOKING,
  DISH_MODE_RESTAURANT,
  DishModeFilterButton,
  DishModeFilterModal,
  hasChosenOpeningDishMode,
  usePersistentDishMode,
} from "../components/DishModeControls";
import { arrayUnion, collection, collectionGroup, doc, getDoc, getDocs, limit as limitResults, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { db } from "./lib/firebase";
import { isTextOnlyDish } from "./lib/dishContent";
import { getDishImageUrl, isDishVideo } from "./lib/dishImage";
import { useRouter } from "next/navigation";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "./lib/tags";
import { resolveRepresentativeTags } from "./lib/profileTags";
import { useUnreadDirects } from "./lib/useUnreadDirects";
import { useLanguage } from "../components/LanguageProvider";
import { getSessionPageCache, setSessionPageCache } from "./lib/sessionPageCache";
import { getDishRestaurantLocation, getRestaurantDistanceMeters } from "./lib/restaurants";
import { usePrivateGeolocation } from "./lib/usePrivateGeolocation";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";
const SELECTED_DISHES_KEY = "onboarding:selectedDishIds";
const viewedStorageKey = (userId) => `feed:viewedDishes:${userId}`;
const viewedCountsStorageKey = (userId) => `feed:viewedDishCounts:${userId}`;
const followingSeenStorageKey = (userId) => `feed:followingSeenAt:${userId}`;
const FEED_VIEWED_FIELD = "feedViewedDishIds";
const FEED_VIEWED_COUNTS_FIELD = "feedViewedDishCounts";
const FEED_FOLLOWING_SEEN_FIELD = "feedFollowingSeenAt";
const FEED_EXCLUDED_TAGS_KEY = "feed:excludedTags";
const activitySeenStorageKey = (userId) => `feed:activitySeenAt:${userId}`;
const swipeHintStorageKey = (userId, guestMode = null) => `feed:swipeHintSeen:v1:${userId || guestMode || "guest"}`;

function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatActivityTime(timeMs) {
  if (!timeMs) return "";
  const date = new Date(timeMs);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "ieri";
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("it-IT", sameYear ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "2-digit" }).format(date);
}

const ACTIVITY_STYLE = {
  follow: { color: "#38BDF8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.28)" },
  post: { color: "#F0A623", bg: "rgba(240,166,35,0.13)", border: "rgba(240,166,35,0.28)" },
  comment: { color: "#2BD36B", bg: "rgba(43,211,107,0.12)", border: "rgba(43,211,107,0.26)" },
  save: { color: "#2BD36B", bg: "rgba(43,211,107,0.12)", border: "rgba(43,211,107,0.28)" },
  like: { color: "#FF5A7A", bg: "rgba(255,90,122,0.13)", border: "rgba(255,90,122,0.3)" },
};
const ACTIVITY_INITIAL_LIMIT = 30;
const ACTIVITY_PAGE_SIZE = 30;
const FEED_INITIAL_PAGE_SIZE = 600;
const FEED_AI_CANDIDATE_LIMIT = 80;

const getFeedCacheKey = (userId, guestMode = null) => `feed:${userId || guestMode || "guest"}`;

function mapCountsToObject(counts) {
  if (!(counts instanceof Map)) return {};
  return Object.fromEntries(
    Array.from(counts.entries())
      .filter(([tag, count]) => tag && Number(count) > 0)
      .slice(0, 24)
  );
}

function getDishCreatedAtSeconds(dish) {
  if (typeof dish?.createdAt?.seconds === "number") return dish.createdAt.seconds;
  if (typeof dish?.createdAt === "number") return dish.createdAt;
  return 0;
}

function mergeAiFeedOrder(deck, orderedIds) {
  if (!Array.isArray(deck) || !Array.isArray(orderedIds) || !orderedIds.length) return deck;
  const byId = new Map(deck.map((dish) => [String(dish?.id || ""), dish]));
  const used = new Set();
  const aiOrdered = orderedIds
    .map((id) => String(id || ""))
    .filter((id) => {
      if (!id || used.has(id) || !byId.has(id)) return false;
      used.add(id);
      return true;
    })
    .map((id) => byId.get(id));
  if (!aiOrdered.length) return deck;
  return [...aiOrdered, ...deck.filter((dish) => !used.has(String(dish?.id || "")))];
}

function preloadFeedImage(src) {
  if (!src || typeof window === "undefined" || typeof Image === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 2200);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {}
      finish();
    };
    image.onerror = finish;
    image.src = src;
    if (image.complete && image.naturalWidth > 0) {
      Promise.resolve(image.decode?.())
        .catch(() => {})
        .finally(finish);
    }
  });
}

function FeedSwipeHint({ onDismiss }) {
  return (
    <motion.button
      type="button"
      className="absolute inset-0 z-[55] flex items-center justify-center bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onPointerDown={onDismiss}
      onClick={onDismiss}
      aria-label="Dismiss swipe hint"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute inset-x-6 bottom-5 top-5 overflow-hidden rounded-[28px] border-2 border-[#E4B43F] bg-[#F7F1E5] shadow-[0_24px_58px_rgba(0,0,0,0.26)]"
          animate={{
            x: [-36, 42, -36],
            y: [8, -4, 8],
            rotate: [-5, 6, -5],
          }}
          transition={{ duration: 2.25, repeat: 1, ease: "easeInOut" }}
        >
          <div className="absolute inset-x-0 top-0 h-[64%] bg-[linear-gradient(135deg,#2A2A2A_0%,#111_52%,#3B2F1C_100%)]" />
          <div className="absolute inset-x-4 bottom-5 space-y-2.5">
            <div className="h-3.5 w-2/3 rounded-full bg-black/70" />
            <div className="h-2.5 w-4/5 rounded-full bg-black/24" />
            <div className="h-2.5 w-1/2 rounded-full bg-black/18" />
          </div>
          <div className="absolute bottom-5 right-4 h-10 w-10 rounded-full bg-black/90" />
        </motion.div>
        <motion.div
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-white text-black shadow-[0_14px_34px_rgba(0,0,0,0.32)]"
          animate={{
            x: [-58, 58, -58],
            y: [28, 2, 28],
            rotate: [-18, 10, -18],
            scale: [0.98, 1.04, 0.98],
          }}
          transition={{ duration: 2.25, repeat: 1, ease: "easeInOut" }}
        >
          <Hand size={28} strokeWidth={2.25} />
        </motion.div>
        <motion.div
          className="absolute h-14 w-14 rounded-full border-2 border-[#2BD36B]/70"
          animate={{ scale: [0.45, 1.55, 0.45], opacity: [0.46, 0, 0.46], x: [-58, 58, -58], y: [28, 2, 28] }}
          transition={{ duration: 2.25, repeat: 1, ease: "easeInOut" }}
        />
      </div>
    </motion.button>
  );
}

export default function Feed() {
  const { user, loading } = useAuth();
  const { t, darkMode } = useLanguage();
  const userId = user?.uid || null;
  const router = useRouter();
  const forYouDeckRef = useRef(null);
  const followingDeckRef = useRef(null);
  const viewedDishIdsRef = useRef([]);
  const initialFeedCache = getSessionPageCache(getFeedCacheKey(userId, "guest"))?.value;
  const initialHasCompleteFeedCache = Boolean(initialFeedCache?.forYouDeck?.length && (!userId || initialFeedCache?.followingDeck?.length));

		  const [activeFeed, setActiveFeed] = useState(() => initialFeedCache?.activeFeed || "for_you");
  const [forYouDeck, setForYouDeck] = useState(() => initialFeedCache?.forYouDeck || []);
  const [followingDeck, setFollowingDeck] = useState(() => initialFeedCache?.followingDeck || []);
  const [forYouIndex, setForYouIndex] = useState(() => initialFeedCache?.forYouIndex || 0);
  const [followingIndex, setFollowingIndex] = useState(() => initialFeedCache?.followingIndex || 0);
  const [forYouIndexByMode, setForYouIndexByMode] = useState(() => initialFeedCache?.forYouIndexByMode || {});
  const [followingIndexByMode, setFollowingIndexByMode] = useState(() => initialFeedCache?.followingIndexByMode || {});
  const [currentForYouCard, setCurrentForYouCard] = useState(null);
  const [currentFollowingCard, setCurrentFollowingCard] = useState(null);
  const [addedDishIds, setAddedDishIds] = useState(() => new Set(initialFeedCache?.addedDishIds || []));
  const [loadingDishes, setLoadingDishes] = useState(() => !initialHasCompleteFeedCache);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDish, setShareDish] = useState(null);
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlistPickerVariant, setDishlistPickerVariant] = useState("sheet");
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["all_dishes"]);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [guestMode, setGuestMode] = useState(null);
  const [guestSavedIds, setGuestSavedIds] = useState([]);
  const [followingIds, setFollowingIds] = useState(() => initialFeedCache?.followingIds || []);
  const [followingSinceById, setFollowingSinceById] = useState(() => initialFeedCache?.followingSinceById || {});
  const [followingSeenAt, setFollowingSeenAt] = useState(() => initialFeedCache?.followingSeenAt || 0);
  const [followingHasUpdate, setFollowingHasUpdate] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(() => !initialHasCompleteFeedCache && Boolean(userId));
  const [followingResolved, setFollowingResolved] = useState(() => Boolean(!userId || initialFeedCache?.followingDeck?.length));
  const [followingResetting, setFollowingResetting] = useState(false);
  const [viewedDishIds, setViewedDishIds] = useState([]);
  const [viewedDishCounts, setViewedDishCounts] = useState({});
  const [viewedHydrated, setViewedHydrated] = useState(false);
  const [excludedTags, setExcludedTags] = useState([]);
  const [draftExcludedTags, setDraftExcludedTags] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterVersion, setFilterVersion] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySeenAt, setActivitySeenAt] = useState(0);
  const [activityPingAt, setActivityPingAt] = useState(0);
  const [activitySeenHydrated, setActivitySeenHydrated] = useState(false);
  const [activityVisibleCount, setActivityVisibleCount] = useState(ACTIVITY_INITIAL_LIMIT);
  const [activityExpandedLoaded, setActivityExpandedLoaded] = useState(false);
  const [feedStoryGroups, setFeedStoryGroups] = useState([]);
  const [feedStoriesOpen, setFeedStoriesOpen] = useState(false);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = usePersistentDishMode("dish-mode:feed", DISH_MODE_ALL);
  const [feedClientReady, setFeedClientReady] = useState(false);
  const [needsOpeningDishMode, setNeedsOpeningDishMode] = useState(true);
  const [firstFeedCardReady, setFirstFeedCardReady] = useState(false);
  const [feedHasRendered, setFeedHasRendered] = useState(false);
  const [swipeHintVisible, setSwipeHintVisible] = useState(false);
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(userId);
  const { location: currentLocation, status: currentLocationStatus } = usePrivateGeolocation({
    enabled: selectedDishMode === DISH_MODE_RESTAURANT,
  });
  const feedCacheKey = getFeedCacheKey(userId, guestMode);
  const activeDeckRef = activeFeed === "following" ? followingDeckRef : forYouDeckRef;
  const showDishModeFilterButton = true;
  const feedStoryPreviewGroups = feedStoryGroups.slice(0, 3);
  const extraFeedStoryCount = Math.max(0, feedStoryGroups.length - feedStoryPreviewGroups.length);
  const unseenActivityItems = useMemo(
    () => activityItems.filter((item) => Number(item.timeMs || 0) > Number(activitySeenAt || 0)),
    [activityItems, activitySeenAt]
  );
  const hasActivityUpdate =
    activitySeenHydrated &&
    (unseenActivityItems.length > 0 || Number(activityPingAt || 0) > Number(activitySeenAt || 0));

  const isOwnDish = (dish) => {
    if (!userId || !dish) return false;
    return [dish.owner, dish.ownerId, dish.userId, dish.uploadedBy, dish.createdBy]
      .filter(Boolean)
      .some((value) => String(value) === String(userId));
  };
  const getDishOwnerIds = (dish) =>
    [dish?.owner, dish?.ownerId, dish?.userId, dish?.uploadedBy, dish?.createdBy]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  const isFromFollowedUser = (dish, followedSet) => getDishOwnerIds(dish).some((ownerId) => followedSet.has(ownerId));
  const sortRestaurantDishesByDistance = (items) => {
    if (!Number.isFinite(currentLocation?.lat) || !Number.isFinite(currentLocation?.lng)) return items;
    return items
      .map((dish, index) => {
        const restaurantLocation = getDishRestaurantLocation(dish);
        return {
          dish,
          index,
          distance: restaurantLocation
            ? getRestaurantDistanceMeters(currentLocation, restaurantLocation)
            : Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.index - b.index;
      })
      .map(({ dish }) => dish);
  };
  const requestAiFeedOrder = async ({ deck, tagCounts, followedSet, representativeTags }) => {
    if (!Array.isArray(deck) || deck.length < 6) return [];
    const candidates = deck.slice(0, FEED_AI_CANDIDATE_LIMIT).map((dish) => ({
      id: dish.id,
      name: dish.name,
      tags: Array.isArray(dish.tags) ? dish.tags : [],
      mode: dish.mode || dish.dishMode || (dish.restaurantName || dish.locationName || dish.placeId ? "restaurant" : "home"),
      fromFollowedUser: isFromFollowedUser(dish, followedSet),
      hasLocation: Boolean(dish.restaurantName || dish.locationName || dish.placeId || dish.googlePlaceId),
      saves: Number(dish.saveCount || dish.savesCount || dish.savedByCount || 0),
      likes: Number(dish.likeCount || dish.likesCount || 0),
      createdAt: getDishCreatedAtSeconds(dish),
    }));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2600);
    try {
      const response = await fetch("/api/feed/rerank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTaste: {
            representativeTags,
            savedTagCounts: mapCountsToObject(tagCounts),
            mode: selectedDishMode,
          },
          candidates,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data?.aiUsed && Array.isArray(data.orderedIds) ? data.orderedIds : [];
    } catch {
      return [];
    } finally {
      window.clearTimeout(timeout);
    }
  };
  const getUserAliasIds = (profile) =>
    [profile?.id, profile?.uid, profile?.userId, profile?.authUid, profile?.appleUserId, profile?.appleSub ? `apple:${profile.appleSub}` : "", profile?.appleSub]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  const expandFollowingIds = async (ids = []) => {
    const rawIds = Array.from(new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean)));
    if (!rawIds.length) return [];
    const followedProfiles = await getUsersByIds(rawIds).catch(() => []);
    return Array.from(new Set([...rawIds, ...followedProfiles.flatMap(getUserAliasIds)]));
  };

  useEffect(() => {
    setNeedsOpeningDishMode(!hasChosenOpeningDishMode());
    setFeedClientReady(true);
  }, []);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const getStoredViewedDishIds = () => {
    if (typeof window === "undefined" || !userId) return [];
    try {
      const stored = JSON.parse(localStorage.getItem(viewedStorageKey(userId)) || "[]");
      return Array.isArray(stored) ? stored.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const normalizeViewedCounts = (value = {}) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(
      Object.entries(source)
        .map(([dishId, count]) => [String(dishId || "").trim(), Math.max(0, Number(count || 0))])
        .filter(([dishId, count]) => dishId && Number.isFinite(count) && count > 0)
    );
  };

  const getStoredViewedDishCounts = () => {
    if (typeof window === "undefined" || !userId) return {};
    try {
      return normalizeViewedCounts(JSON.parse(localStorage.getItem(viewedCountsStorageKey(userId)) || "{}"));
    } catch {
      return {};
    }
  };

  const orderByFewestViews = (items, counts = viewedDishCounts) =>
    items
      .slice()
      .sort((a, b) => {
        const aViews = Number(counts?.[a?.id] || 0);
        const bViews = Number(counts?.[b?.id] || 0);
        if (aViews !== bViews) return aViews - bViews;
        return (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0);
      });

  const keepFewestViewsFirst = (items, counts = viewedDishCounts) =>
    items
      .map((dish, index) => ({ dish, index }))
      .sort((a, b) => {
        const aViews = Number(counts?.[a.dish?.id] || 0);
        const bViews = Number(counts?.[b.dish?.id] || 0);
        if (aViews !== bViews) return aViews - bViews;
        return a.index - b.index;
      })
      .map(({ dish }) => dish);

  useEffect(() => {
    viewedDishIdsRef.current = viewedDishIds;
  }, [viewedDishIds]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setActivitySeenAt(0);
      setActivitySeenHydrated(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const localSeen = Number(localStorage.getItem(activitySeenStorageKey(userId)) || 0);
      let remoteSeen = 0;
      try {
        const snap = await getDoc(doc(db, "users", userId));
        remoteSeen = timestampToMs(snap.data()?.feedActivitySeenAt);
      } catch {}
      if (!cancelled) {
        setActivitySeenAt(Math.max(localSeen, remoteSeen));
        setActivitySeenHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setActivityPingAt(0);
      return undefined;
    }
    const q = query(collection(db, "users", userId, "activity"), orderBy("createdAt", "desc"), limitResults(1));
    return onSnapshot(
      q,
      (snapshot) => {
        const latest = snapshot.docs[0]?.data();
        setActivityPingAt(timestampToMs(latest?.createdAt || latest?.updatedAt));
      },
      (error) => {
        console.error("Failed to listen for activity updates:", error);
      }
    );
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const orderStoryGroups = (groups) =>
      groups
        .filter(Boolean)
        .sort((a, b) => {
          const aViewed = userId ? (a.stories || []).every((story) => (story.viewedBy || []).includes(userId)) : false;
          const bViewed = userId ? (b.stories || []).every((story) => (story.viewedBy || []).includes(userId)) : false;
          if (aViewed !== bViewed) return aViewed ? 1 : -1;
          return (a.ownerName || "").localeCompare(b.ownerName || "");
        });
    const loadFromFlaggedUsers = async () => {
      const usersSnap = await getDocs(query(collection(db, "users"), where("hasActiveStory", "==", true), limitResults(16)));
      return Promise.all(
        usersSnap.docs.map(async (userDoc) => {
          const data = userDoc.data() || {};
          const stories = await getDocs(query(collection(db, "users", userDoc.id, "stories"), orderBy("createdAt", "desc")));
          const now = Date.now();
          const activeStories = stories.docs
            .map((storyDoc) => ({ id: storyDoc.id, ...storyDoc.data() }))
            .filter((story) => (story.expiresAtMs || 0) > now);
          if (!activeStories.length) return null;
          return {
            ownerId: userDoc.id,
            ownerName: data.displayName || data.name || "User",
            ownerPhotoURL: normalizeProfilePhotoURL(data.photoURL || data.photoUrl || ""),
            stories: activeStories,
          };
        })
      );
    };
    (async () => {
      try {
        const now = Date.now();
        const storySnap = await getDocs(query(collectionGroup(db, "stories"), orderBy("createdAt", "desc"), limitResults(80)));
        const storiesByOwner = new Map();
        storySnap.docs.forEach((storyDoc) => {
          const ownerId = storyDoc.ref.parent?.parent?.id || "";
          const story = { id: storyDoc.id, ...storyDoc.data() };
          if (!ownerId || (story.expiresAtMs || 0) <= now) return;
          if (!storiesByOwner.has(ownerId)) storiesByOwner.set(ownerId, []);
          storiesByOwner.get(ownerId).push(story);
        });
        const ownerIds = Array.from(storiesByOwner.keys()).slice(0, 16);
        const owners = await getUsersByIds(ownerIds);
        const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));
        let groups = ownerIds.map((ownerId) => {
          const owner = ownerMap.get(ownerId) || {};
          const stories = storiesByOwner.get(ownerId) || [];
          if (!stories.length) return null;
          return {
            ownerId,
            ownerName: owner.displayName || owner.name || "User",
            ownerPhotoURL: normalizeProfilePhotoURL(owner.photoURL || owner.photoUrl || ""),
            stories,
          };
        });
        if (!groups.filter(Boolean).length) {
          groups = await loadFromFlaggedUsers();
        }
        if (cancelled) return;
        setFeedStoryGroups(orderStoryGroups(groups));
      } catch (error) {
        console.error("Failed to load feed stories:", error);
        try {
          const fallbackGroups = await loadFromFlaggedUsers();
          if (!cancelled) setFeedStoryGroups(orderStoryGroups(fallbackGroups));
        } catch (fallbackError) {
          console.error("Failed to load fallback feed stories:", fallbackError);
          if (!cancelled) setFeedStoryGroups([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userId) return;
    const done = localStorage.getItem(DONE_KEY);
    if (!done) {
      router.replace("/onboarding");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "feed") {
      sessionStorage.setItem(MODE_KEY, "feed");
      if (!sessionStorage.getItem(SAVED_KEY)) {
        sessionStorage.setItem(SAVED_KEY, JSON.stringify([]));
      }
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
    if (!userId) {
      setViewedDishIds([]);
      setViewedDishCounts({});
      viewedDishIdsRef.current = [];
      setViewedHydrated(true);
      return;
    }
    let cancelled = false;
    setViewedHydrated(false);
    (async () => {
      const localIds = getStoredViewedDishIds();
      const localCounts = getStoredViewedDishCounts();
      let serverIds = [];
      let serverCounts = {};
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const data = snap.exists() ? snap.data() || {} : {};
        serverIds = Array.isArray(data[FEED_VIEWED_FIELD]) ? data[FEED_VIEWED_FIELD] : [];
        serverCounts = normalizeViewedCounts(data[FEED_VIEWED_COUNTS_FIELD]);
      } catch (err) {
        console.error("Failed to load viewed feed dishes:", err);
      }
      if (cancelled) return;
      const merged = Array.from(new Set([...localIds, ...serverIds].map(String).filter(Boolean)));
      const mergedCounts = normalizeViewedCounts({ ...serverCounts, ...localCounts });
      merged.forEach((dishId) => {
        if (!mergedCounts[dishId]) mergedCounts[dishId] = 1;
      });
      viewedDishIdsRef.current = merged;
      setViewedDishIds(merged);
      setViewedDishCounts(mergedCounts);
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedStorageKey(userId), JSON.stringify(merged));
        localStorage.setItem(viewedCountsStorageKey(userId), JSON.stringify(mergedCounts));
      }
      if (localIds.some((id) => !serverIds.includes(id)) || Object.keys(localCounts).length) {
        setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: merged, [FEED_VIEWED_COUNTS_FIELD]: mergedCounts }, { merge: true }).catch((err) =>
          console.error("Failed to sync viewed feed dishes:", err)
        );
      }
      setViewedHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const cachedFeed = getSessionPageCache(feedCacheKey)?.value;
	    if (cachedFeed) {
      const cachedHasBothDecks = Boolean(cachedFeed?.forYouDeck?.length && (!userId || cachedFeed?.followingDeck?.length));
	      setActiveFeed(cachedFeed.activeFeed || "for_you");
	      setForYouDeck(Array.isArray(cachedFeed.forYouDeck) ? cachedFeed.forYouDeck : []);
	      setFollowingDeck(Array.isArray(cachedFeed.followingDeck) ? cachedFeed.followingDeck : []);
	      setForYouIndex(Number(cachedFeed.forYouIndex || 0));
	      setFollowingIndex(Number(cachedFeed.followingIndex || 0));
	      setForYouIndexByMode(cachedFeed.forYouIndexByMode || {});
	      setFollowingIndexByMode(cachedFeed.followingIndexByMode || {});
	      setFollowingIds(Array.isArray(cachedFeed.followingIds) ? cachedFeed.followingIds : []);
	      setFollowingSinceById(cachedFeed.followingSinceById || {});
	      setFollowingSeenAt(Number(cachedFeed.followingSeenAt || 0));
	      setAddedDishIds(new Set(Array.isArray(cachedFeed.addedDishIds) ? cachedFeed.addedDishIds : []));
      setFollowingResolved(Boolean(!userId || cachedFeed?.followingDeck?.length));
      setFollowingLoading(Boolean(userId && !cachedHasBothDecks));
      setLoadingDishes(!cachedHasBothDecks);
    }
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

    const buildForYouFeed = (items, tagCounts, followedOwners, representativeTags = []) => {
      if (!userId) return shuffleArray(sortNewest(items));
      const representativeTagSet = new Set(
        representativeTags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
      );
      const ranked = items
        .map((dish) => {
          const dishTags = Array.isArray(dish.tags)
            ? dish.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
            : [];
          const overlap = dishTags.reduce((sum, tag) => sum + (tagCounts.get(tag) || 0), 0);
          const representativeOverlap = dishTags.reduce((sum, tag) => sum + (representativeTagSet.has(tag) ? 1 : 0), 0);
          const followBoost = isFromFollowedUser(dish, followedOwners) ? 4 : 0;
          const recency = dish?.createdAt?.seconds || 0;
          return {
            ...dish,
            _rank: representativeOverlap * 60 + overlap * 8 + followBoost + recency / 1000000000,
          };
        })
        .sort((a, b) => b._rank - a._rank)
        .map(({ _rank, ...dish }) => dish);

      return shuffleArray(ranked);
    };

    setAddedDishIds(new Set());
    (async () => {
      const cachedHasBothDecks = Boolean(cachedFeed?.forYouDeck?.length && (!userId || cachedFeed?.followingDeck?.length));
      setLoadingDishes(!cachedHasBothDecks);
      setFollowingLoading(Boolean(userId));
      setFollowingResolved(false);
      try {
        const feedPagePromise = getDishesPage({ pageSize: FEED_INITIAL_PAGE_SIZE, enrichOwners: false });
        const currentUserPromise = userId ? getDoc(doc(db, "users", userId)) : null;
        const userFeedPromise = userId
          ? Promise.all([
              getFollowingForUser(userId, { force: true }),
              getSavedDishesFromFirestore(userId),
              getToTryDishesFromFirestore(userId),
              getDishesFromFirestore(userId),
              currentUserPromise,
            ])
          : null;
        const { items: allItems } = await feedPagePromise;
        const seenIds = new Set(getStoredViewedDishIds());
        const seenCounts = getStoredViewedDishCounts();
        const publicItems = allItems.filter(
          (dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish)
        );
        const getLeastSeenItems = (items) => {
          if (!items.length) return [];
          const unseen = items.filter((dish) => !seenIds.has(String(dish.id)));
          if (unseen.length) return orderByFewestViews(unseen, seenCounts);
          return orderByFewestViews(items, seenCounts);
        };
        const unseenPublicItems = getLeastSeenItems(publicItems);

        const quickForYou = shuffleArray(sortNewest(unseenPublicItems));
        if (!userId) {
          setForYouDeck(quickForYou);
          setForYouIndex(0);
          setForYouIndexByMode({});
        } else {
          currentUserPromise
            .then((snap) => {
              if (cancelled) return;
              const data = snap.exists() ? snap.data() || {} : {};
              const quickExcludedIds = new Set([
                ...(Array.isArray(data.savedDishes) ? data.savedDishes : []),
                ...(Array.isArray(data.toTryDishes) ? data.toTryDishes : []),
              ].map((id) => String(id || "")).filter(Boolean));
              const quickDeck = shuffleArray(sortNewest(getLeastSeenItems(publicItems.filter((dish) => !quickExcludedIds.has(String(dish.id))))));
              setForYouDeck(quickDeck);
              setForYouIndex(0);
              setForYouIndexByMode({});
              setLoadingDishes(false);
            })
            .catch((err) => {
              console.error("Failed to prepare quick feed:", err);
            });
        }
        if (!userId) {
          setFollowingDeck([]);
          setFollowingIndex(0);
          setFollowingIndexByMode({});
          setFollowingSinceById({});
          setFollowingLoading(false);
          setFollowingResolved(true);
        }

        let nextFollowingIds = [];
        let following = [];

        if (userId) {
          const [followed, saved, toTry, uploaded, currentUserSnap] = await userFeedPromise;
          nextFollowingIds = Array.from(new Set(followed || []));
          const expandedFollowingIds = await expandFollowingIds(nextFollowingIds);
          const followedSet = new Set(expandedFollowingIds);
          const userData = currentUserSnap.exists() ? currentUserSnap.data() : {};
          const storedFollowingSince =
            userData?.followingSince && typeof userData.followingSince === "object"
              ? userData.followingSince
              : {};
          const now = Date.now();
          const nextFollowingSince = nextFollowingIds.reduce((acc, followId) => {
            const raw = storedFollowingSince[followId];
            const rawMs =
              typeof raw === "number"
                ? raw
                : raw?.toMillis
                  ? raw.toMillis()
                  : raw?.seconds
                    ? raw.seconds * 1000
                    : Number(raw || 0);
            acc[followId] = Number.isFinite(rawMs) && rawMs > 0 ? rawMs : now;
            return acc;
          }, {});
          const missingFollowSince = nextFollowingIds.some((followId) => !storedFollowingSince[followId]);
          if (missingFollowSince) {
            setDoc(doc(db, "users", userId), { followingSince: nextFollowingSince }, { merge: true }).catch((err) =>
              console.error("Failed to backfill following timestamps:", err)
            );
          }
          setFollowingSinceById(nextFollowingSince);
          const tagCounts = normalizeTags([...saved, ...toTry, ...uploaded]);
          const representativeTags = resolveRepresentativeTags(userData?.representativeTags, [...saved, ...toTry, ...uploaded]);
          const savedOrOwnedIds = new Set([...saved, ...toTry, ...uploaded].map((dish) => String(dish?.id || "")).filter(Boolean));
          const eligiblePublicItems = publicItems.filter((dish) => !savedOrOwnedIds.has(String(dish.id)));
          const feedCandidates = getLeastSeenItems(eligiblePublicItems);
          const forYou = keepFewestViewsFirst(buildForYouFeed(feedCandidates, tagCounts, followedSet, representativeTags), seenCounts);
          const matchedFollowingItems = eligiblePublicItems.filter((dish) => isFromFollowedUser(dish, followedSet));
          const followingSourceItems = matchedFollowingItems.length || !nextFollowingIds.length ? matchedFollowingItems : eligiblePublicItems;
          following = keepFewestViewsFirst(sortNewest(getLeastSeenItems(followingSourceItems.filter((dish) => !savedOrOwnedIds.has(String(dish.id))))), seenCounts);
          setFollowingIds(expandedFollowingIds);
          setForYouDeck(forYou);
          requestAiFeedOrder({ deck: forYou, tagCounts, followedSet, representativeTags }).then((orderedIds) => {
            if (cancelled || !orderedIds.length) return;
            const originalFirstId = String(forYou[0]?.id || "");
            setForYouDeck((prev) => {
              if (String(prev?.[0]?.id || "") !== originalFirstId) return prev;
              return keepFewestViewsFirst(mergeAiFeedOrder(prev, orderedIds), seenCounts);
            });
          });
          setFollowingDeck(following);
          setFollowingLoading(false);
          setFollowingResolved(true);
        }
	      } catch (err) {
        console.error("Failed to load feed dishes:", err);
        setFollowingIds([]);
        setFollowingSinceById({});
        setForYouDeck([]);
        setFollowingDeck([]);
        setFollowingLoading(false);
        setFollowingResolved(true);
      } finally {
        setLoadingDishes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, feedCacheKey]);

  useEffect(() => {
    if (loadingDishes) return;
    setSessionPageCache(feedCacheKey, {
      forYouDeck,
      followingDeck,
      activeFeed,
      forYouIndex,
      followingIndex,
      forYouIndexByMode,
      followingIndexByMode,
      followingIds,
      followingSinceById,
      followingSeenAt,
      addedDishIds: Array.from(addedDishIds),
    });
  }, [activeFeed, addedDishIds, feedCacheKey, followingDeck, followingIds, followingIndex, followingIndexByMode, followingSeenAt, followingSinceById, forYouDeck, forYouIndex, forYouIndexByMode, loadingDishes]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setFollowingSeenAt(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const localSeen = Number(localStorage.getItem(followingSeenStorageKey(userId)) || 0);
      let remoteSeen = 0;
      try {
        const snap = await getDoc(doc(db, "users", userId));
        remoteSeen = timestampToMs(snap.data()?.[FEED_FOLLOWING_SEEN_FIELD]);
      } catch {}
      if (!cancelled) setFollowingSeenAt(Math.max(localSeen, remoteSeen));
    })();
    return () => {
      cancelled = true;
    };
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
    if (loading) return;
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
    const recountFlagKey = "dishlist-save-recount-v3";
    const shouldRecount = params.get("recountSaves") === "1";
    if (!shouldRecount) return;
    recountDishSavesFromUsers()
      .then(() => {
        window.localStorage.setItem(recountFlagKey, "done");
        return getDishesPage({ pageSize: FEED_INITIAL_PAGE_SIZE, enrichOwners: false }).then(({ items }) => {
          const publicItems = items.filter(
            (dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish)
          );
	          const ordered = publicItems
	            .slice()
	            .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
	          setForYouDeck(shuffleArray(ordered));
	          setForYouIndex(0);
	          setForYouIndexByMode({});
	        });
      })
      .catch((err) => console.error("Failed to recount saves:", err));
  }, [loading, userId]);

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

  const orderedForYou = useMemo(() => {
    const filtered = forYouDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d) && dishModeMatches(d, selectedDishMode));
    return selectedDishMode === DISH_MODE_RESTAURANT ? sortRestaurantDishesByDistance(filtered) : filtered;
  }, [forYouDeck, addedDishIds, excludedTagSet, selectedDishMode, currentLocation?.lat, currentLocation?.lng]);

  const orderedFollowing = useMemo(() => {
    const base = followingDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d));
    const modeFiltered = base.filter((d) => dishModeMatches(d, selectedDishMode));
    const resolved = modeFiltered.length ? modeFiltered : base;
    return selectedDishMode === DISH_MODE_RESTAURANT ? sortRestaurantDishesByDistance(resolved) : resolved;
  }, [followingDeck, addedDishIds, excludedTagSet, selectedDishMode, currentLocation?.lat, currentLocation?.lng]);

  useEffect(() => {
    if (selectedDishMode !== DISH_MODE_RESTAURANT) return;
    if (currentLocationStatus !== "ready") return;
    setForYouIndex(0);
    setFollowingIndex(0);
    setForYouIndexByMode((prev) => ({ ...(prev || {}), [DISH_MODE_RESTAURANT]: 0 }));
    setFollowingIndexByMode((prev) => ({ ...(prev || {}), [DISH_MODE_RESTAURANT]: 0 }));
  }, [selectedDishMode, currentLocationStatus, currentLocation?.lat, currentLocation?.lng]);

  const getModeIndex = (map, fallbackIndex = 0) => {
    const stored = Number(map?.[selectedDishMode]);
    return Number.isFinite(stored) && stored >= 0 ? stored : fallbackIndex;
  };

  const updateModeIndex = (setter, mode, index) => {
    setter((prev) => {
      const safeIndex = Math.max(0, Number(index || 0));
      if (Number(prev?.[mode] || 0) === safeIndex) return prev;
      return { ...(prev || {}), [mode]: safeIndex };
    });
  };

  const currentForYouIndex = getModeIndex(forYouIndexByMode, forYouIndex);
  const currentFollowingIndex = getModeIndex(followingIndexByMode, followingIndex);
  const firstVisibleFeedCard =
    activeFeed === "following"
      ? orderedFollowing[currentFollowingIndex] || null
      : orderedForYou[currentForYouIndex] || null;
  const firstUnderlayFeedCard =
    activeFeed === "following"
      ? orderedFollowing[currentFollowingIndex + 1] || null
      : orderedForYou[currentForYouIndex + 1] || null;

  const handleFeedTabChange = (tab) => {
    setActiveFeed(tab);
    if (tab === "following") {
      markFollowingSeen();
    }
  };

  const handleDishSwiped = (dishOrId) => {
    const dishId = typeof dishOrId === "string" ? dishOrId : dishOrId?.id;
    if (!userId || !dishId) return;
    setViewedDishCounts((prev) => {
      const next = normalizeViewedCounts(prev);
      next[dishId] = Number(next[dishId] || 0) + 1;
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedCountsStorageKey(userId), JSON.stringify(next));
      }
      setDoc(doc(db, "users", userId), { [FEED_VIEWED_COUNTS_FIELD]: next }, { merge: true }).catch((err) =>
        console.error("Failed to save viewed feed count:", err)
      );
      return next;
    });
    setViewedDishIds((prev) => {
      if (prev.includes(dishId)) return prev;
      const next = [...prev, dishId];
      viewedDishIdsRef.current = next;
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedStorageKey(userId), JSON.stringify(next));
      }
      setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: arrayUnion(dishId) }, { merge: true }).catch((err) =>
        console.error("Failed to save viewed feed dish:", err)
      );
      return next;
    });
  };

  const isGuestFeedOnboarding = () => {
    if (guestMode === "feed") return true;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("onboarding") === "feed" || sessionStorage.getItem(MODE_KEY) === "feed";
  };

  const handleAdd = async (dishToAdd, variant = "sheet") => {
    if (!userId) {
      if (isGuestFeedOnboarding()) {
        if (!dishToAdd?.id) return false;
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
    setDishlistPickerVariant(variant);
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(userId)).filter(
        (dishlist) => dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      setSelectedDishlistIds(["all_dishes"]);
    } finally {
      setDishlistsLoading(false);
    }
    return { skipToast: true };
  };

  const handleRightSwipeToTry = async (dishToAdd) => {
    if (!userId) {
      if (isGuestFeedOnboarding()) return handleAdd(dishToAdd, "swipe");
      setShowAuthPrompt(true);
      return false;
    }
    if (!dishToAdd?.id) return false;
    const [saved, queued] = await Promise.all([
      saveDishToUserList(userId, dishToAdd.id, dishToAdd),
      queueDishForDishlistSorting(userId, dishToAdd),
    ]);
    if (!saved || !queued) return false;
    setAddedDishIds((prev) => {
      const next = new Set(prev);
      next.add(dishToAdd.id);
      return next;
    });
    setForYouDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    setFollowingDeck((prev) => prev.filter((d) => d.id !== dishToAdd.id));
    return true;
  };

  const handleResetFeed = async (feedType) => {
    setLoadingDishes(true);
    if (feedType === "following") {
      setFollowingResetting(true);
      setFollowingLoading(true);
      setFollowingResolved(false);
    }
    try {
      if (typeof window !== "undefined" && userId) {
        localStorage.removeItem(viewedStorageKey(userId));
        viewedDishIdsRef.current = [];
        setViewedDishIds([]);
        await setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: [] }, { merge: true });
      }
      const { items } = await getDishesPage({ pageSize: FEED_INITIAL_PAGE_SIZE, enrichOwners: false });
      const publicItems = items.filter((dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish));
      const ordered = publicItems
        .slice()
        .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      if (feedType === "following") {
        const expandedFollowingIds = await expandFollowingIds(followingIds);
        const followedSet = new Set(expandedFollowingIds);
        setFollowingIds(expandedFollowingIds);
        const matchedFollowingItems = ordered.filter((dish) => isFromFollowedUser(dish, followedSet));
        setFollowingDeck(shuffleArray(sortNewest(matchedFollowingItems.length || !expandedFollowingIds.length ? matchedFollowingItems : ordered)));
        setFollowingIndex(0);
        setFollowingIndexByMode((prev) => ({ ...(prev || {}), [selectedDishMode]: 0 }));
        setFollowingLoading(false);
        setFollowingResolved(true);
        setFollowingResetting(false);
      } else {
        setForYouDeck(shuffleArray(ordered));
        setForYouIndex(0);
        setForYouIndexByMode((prev) => ({ ...(prev || {}), [selectedDishMode]: 0 }));
      }
    } catch (err) {
      console.error("Failed to reset feed:", err);
      if (feedType === "following") {
        setFollowingDeck([]);
        setFollowingLoading(false);
        setFollowingResolved(true);
        setFollowingResetting(false);
      } else {
        setForYouDeck([]);
      }
    } finally {
      setLoadingDishes(false);
      if (feedType === "following") setFollowingResetting(false);
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

  const getDishCreatedMs = (dish) => timestampToMs(dish?.createdAt);

  const latestFollowingUploadMs = useMemo(
    () => orderedFollowing.reduce((latest, dish) => Math.max(latest, getDishCreatedMs(dish)), 0),
    [orderedFollowing]
  );

  useEffect(() => {
    if (!userId || !latestFollowingUploadMs) {
      setFollowingHasUpdate(false);
      return;
    }
    setFollowingHasUpdate(latestFollowingUploadMs > Number(followingSeenAt || 0));
  }, [followingSeenAt, latestFollowingUploadMs, userId]);

  useEffect(() => {
    if (!userId || !latestFollowingUploadMs) return;
    if (followingSeenAt > 0) return;
    setFollowingSeenAt(latestFollowingUploadMs);
    if (typeof window !== "undefined") {
      localStorage.setItem(followingSeenStorageKey(userId), String(latestFollowingUploadMs));
    }
    setDoc(doc(db, "users", userId), { [FEED_FOLLOWING_SEEN_FIELD]: new Date(latestFollowingUploadMs) }, { merge: true }).catch(() => {});
  }, [followingSeenAt, latestFollowingUploadMs, userId]);

  const markFollowingSeen = () => {
    if (!userId || !latestFollowingUploadMs) return;
    const nextSeenAt = Math.max(Date.now(), latestFollowingUploadMs);
    setFollowingSeenAt(nextSeenAt);
    setFollowingHasUpdate(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(followingSeenStorageKey(userId), String(nextSeenAt));
    }
    setDoc(doc(db, "users", userId), { [FEED_FOLLOWING_SEEN_FIELD]: new Date(nextSeenAt) }, { merge: true }).catch(() => {});
  };

  useEffect(() => {
    if (activeFeed === "following") {
      markFollowingSeen();
    }
  }, [activeFeed, latestFollowingUploadMs]);

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
    const persistDishlistIds = selectedDishlistIds.filter((dishlistId) => dishlistId !== "all_dishes");
    const results = await Promise.all(
      persistDishlistIds.map((dishlistId) => saveDishToSelectedDishlist(userId, dishlistId, dishToAdd))
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

  const buildActivityItems = async ({ includeExpanded = false } = {}) => {
    if (!userId) return [];
    setActivityLoading(true);
    try {
      const activitySnap = await getDocs(query(collection(db, "users", userId, "activity"), orderBy("createdAt", "desc"), limitResults(80))).catch((error) => {
        console.error("Failed to load timestamped activity:", error);
        return { docs: [] };
      });
      const reactionActivityEvents = activitySnap.docs
        .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
        .filter((event) => {
          if (!["save", "like", "follow"].includes(event.kind) || !event.actorId || event.actorId === userId) return false;
          return event.kind === "follow" || Boolean(event.dishId);
        });
      const [reactionActivityUsers] = await Promise.all([
        getUsersByIds(reactionActivityEvents.map((event) => event.actorId)).catch((error) => {
          console.error("Failed to load timestamped activity actors:", error);
          return [];
        }),
      ]);
      const reactionActivityUsersById = new Map(reactionActivityUsers.map((actor) => [actor.id, actor]));
      const reactionActivityItems = reactionActivityEvents.map((event) => {
        const actor = reactionActivityUsersById.get(event.actorId);
        const kind = event.kind === "follow" ? "follow" : event.kind === "like" ? "like" : "save";
        return {
          id: kind === "follow" ? `follow-${event.actorId}` : `${kind}-${event.dishId}-${event.actorId}`,
          kind,
          icon: kind === "follow" ? UserPlus : kind === "like" ? Heart : Plus,
          actor: actor?.displayName || actor?.name || "Someone",
          text: t(kind === "follow" ? "started following you" : kind === "like" ? "liked your dish" : "saved your dish"),
          detail: kind === "follow" ? "" : event.dishName || "",
          href: kind === "follow" ? `/profile/${event.actorId}` : `/dish/${event.dishId}?source=uploaded&mode=single`,
          timeMs: timestampToMs(event.createdAt || event.updatedAt),
        };
      });

      const followedPostItems = followingDeck
        .filter((dish) => {
          const followSince = Number(followingSinceById[dish?.owner] || 0);
          return followSince && timestampToMs(dish.createdAt) > followSince;
        })
        .slice(0, 20)
        .map((dish) => ({
          id: `post-${dish.id}`,
          kind: "post",
          icon: Utensils,
          actor: dish.ownerName || "Someone",
          text: t("posted a new dish"),
          detail: dish.name || "",
          href: `/dish/${dish.id}?source=public&mode=single`,
          timeMs: timestampToMs(dish.createdAt),
        }));

      let expandedItems = [];
      if (includeExpanded) {
        const [uploadedDishes, storySnap] = await Promise.all([
          getDishesFromFirestore(userId).catch((error) => {
            console.error("Failed to load uploaded dishes for activity:", error);
            return [];
          }),
          getDocs(query(collection(db, "users", userId, "stories"), orderBy("createdAt", "desc"), limitResults(12))).catch((error) => {
            console.error("Failed to load story activity:", error);
            return { docs: [] };
          }),
        ]);

        const dishCommentGroups = await Promise.all(
          uploadedDishes.slice(0, 24).map(async (dish) => {
            const comments = await getCommentsForDish(dish.id, 8, "dish").catch((error) => {
              console.error("Failed to load dish activity comments:", error);
              return [];
            });
            return comments
              .filter((comment) => comment.userId !== userId)
              .map((comment) => ({
                id: `dish-comment-${dish.id}-${comment.id}`,
                kind: "comment",
                icon: MessageCircle,
                actor: comment.userName || "Someone",
                text: t("commented on your dish"),
                detail: dish.name || "",
                href: `/dish/${dish.id}?source=uploaded&mode=single`,
                timeMs: timestampToMs(comment.createdAt),
              }));
          })
        );

        const storyCommentGroups = await Promise.all(
          storySnap.docs.map(async (storyDoc) => {
            const story = { id: storyDoc.id, ...storyDoc.data() };
            const comments = await getCommentsForStory(userId, storyDoc.id, 8).catch((error) => {
              console.error("Failed to load story activity comments:", error);
              return [];
            });
            return comments
              .filter((comment) => comment.userId !== userId)
              .map((comment) => ({
                id: `story-comment-${storyDoc.id}-${comment.id}`,
                kind: "comment",
                icon: MessageCircle,
                actor: comment.userName || "Someone",
                text: t("commented on your story"),
                detail: story.name || story.dishName || "",
                href: "/profile",
                timeMs: timestampToMs(comment.createdAt),
              }));
          })
        );
        const saveGroups = await Promise.all(
          uploadedDishes.slice(0, 12).map(async (dish) => {
            try {
              const savedSnap = await getDocs(query(collectionGroup(db, "saved"), where("id", "==", dish.id), limitResults(8)));
              const events = savedSnap.docs
                .map((savedDoc) => {
                  const saverId = savedDoc.ref.parent.parent?.id || "";
                  return {
                    saverId,
                    savedAt: savedDoc.data()?.savedAt || savedDoc.data()?.addedAt || null,
                  };
                })
                .filter((event) => event.saverId && event.saverId !== userId);
              const saverUsers = await getUsersByIds(events.map((event) => event.saverId));
              const usersById = new Map(saverUsers.map((saver) => [saver.id, saver]));
              return events.slice(0, 4).map((event) => {
                const saver = usersById.get(event.saverId);
                return {
                  id: `save-${dish.id}-${event.saverId}`,
                  kind: "save",
                  icon: Plus,
                  actor: saver?.displayName || saver?.name || "Someone",
                  text: t("saved your dish"),
                  detail: dish.name || "",
                  href: `/dish/${dish.id}?source=uploaded&mode=single`,
                  timeMs: timestampToMs(event.savedAt),
                };
              });
            } catch (error) {
              console.error("Failed to load timestamped save activity:", error);
              const savers = await getUsersWhoSavedDish(dish.id).catch(() => []);
              const directEvents = await Promise.all(
                savers
                  .filter((saver) => saver.id !== userId)
                  .slice(0, 3)
                  .map(async (saver) => {
                    const savedDoc = await getDoc(doc(db, "users", saver.id, "saved", dish.id)).catch(() => null);
                    const savedData = savedDoc?.exists?.() ? savedDoc.data() || {} : {};
                    return { saver, savedAt: savedData.savedAt || savedData.addedAt || null };
                  })
              );
              return directEvents
                .filter(({ saver }) => saver?.id && saver.id !== userId)
                .map(({ saver, savedAt }) => ({
                  id: `save-${dish.id}-${saver.id}`,
                  kind: "save",
                  icon: Plus,
                  actor: saver.displayName || saver.name || "Someone",
                  text: t("saved your dish"),
                  detail: dish.name || "",
                  href: `/dish/${dish.id}?source=uploaded&mode=single`,
                  timeMs: timestampToMs(savedAt),
                }));
            }
          })
        );
        expandedItems = [...dishCommentGroups.flat(), ...storyCommentGroups.flat(), ...saveGroups.flat()];
      }

      const items = [
        ...followedPostItems,
        ...reactionActivityItems,
        ...expandedItems,
      ]
        .filter((item) => item.id)
        .reduce((unique, item) => {
          if (!unique.has(item.id) || Number(item.timeMs || 0) > Number(unique.get(item.id)?.timeMs || 0)) {
            unique.set(item.id, item);
          }
          return unique;
        }, new Map())
        .values();
      const sortedItems = Array.from(items)
        .sort((a, b) => Number(b.timeMs || 0) - Number(a.timeMs || 0))
        .slice(0, 80);
      setActivityItems(sortedItems);
      if (includeExpanded) setActivityExpandedLoaded(true);
      return sortedItems;
    } catch (error) {
      console.error("Failed to load activity:", error);
      return [];
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setActivityItems([]);
      setActivityVisibleCount(ACTIVITY_INITIAL_LIMIT);
      setActivityExpandedLoaded(false);
    }
  }, [userId]);

  const openActivity = async () => {
    if (!userId) {
      router.push("/?auth=1");
      return;
    }
    setActivityOpen(true);
    setActivityVisibleCount(ACTIVITY_INITIAL_LIMIT);
    setActivityExpandedLoaded(false);
    const now = Date.now();
    setActivitySeenAt(now);
    setActivityPingAt(0);
    if (typeof window !== "undefined") {
      localStorage.setItem(activitySeenStorageKey(userId), String(now));
    }
    setDoc(doc(db, "users", userId), { feedActivitySeenAt: new Date(now) }, { merge: true }).catch(() => {});
    await buildActivityItems({ includeExpanded: false });
  };

  const loadMoreActivity = async () => {
    if (!activityExpandedLoaded) {
      const items = await buildActivityItems({ includeExpanded: true });
      setActivityVisibleCount(Math.max(ACTIVITY_INITIAL_LIMIT + ACTIVITY_PAGE_SIZE, items.length));
      return;
    }
    setActivityVisibleCount((count) => Math.min(activityItems.length, count + ACTIVITY_PAGE_SIZE));
  };

  const handleFeedStoryViewed = async (story, group) => {
    if (!userId || !group?.ownerId || !story?.id) return;
    await markStoryViewed(group.ownerId, story.id, userId);
    setFeedStoryGroups((prev) =>
      prev.map((item) => {
        if (item.ownerId !== group.ownerId) return item;
        return {
          ...item,
          stories: (item.stories || []).map((activeStory) =>
            activeStory.id === story.id
              ? {
                  ...activeStory,
                  viewedBy: Array.from(new Set([...(activeStory.viewedBy || []), userId])),
                }
              : activeStory
          ),
        };
      })
    );
  };

  const hasLoadedFeedCards = forYouDeck.length > 0 || followingDeck.length > 0;
  const firstVisibleFeedCardKey = firstVisibleFeedCard?.id || firstVisibleFeedCard?._key || "";

  const dismissSwipeHint = () => {
    setSwipeHintVisible(false);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(swipeHintStorageKey(userId, guestMode), "1");
    } catch {}
  };

  useEffect(() => {
    if (feedHasRendered) return undefined;
    if (feedClientReady && !needsOpeningDishMode && !loading && !loadingDishes && !hasLoadedFeedCards) {
      setFirstFeedCardReady(true);
      setFeedHasRendered(true);
      return undefined;
    }
    if (!feedClientReady || needsOpeningDishMode || loading || loadingDishes || !hasLoadedFeedCards) {
      setFirstFeedCardReady(false);
      return undefined;
    }
    if (!firstVisibleFeedCard) {
      setFirstFeedCardReady(true);
      setFeedHasRendered(true);
      return undefined;
    }
    let cancelled = false;
    setFirstFeedCardReady(false);
    const openingCards = [firstVisibleFeedCard, firstUnderlayFeedCard].filter(
      (dish) => dish && !isDishVideo(dish)
    );
    const openingSources = Array.from(new Set(openingCards.map((dish) => getDishImageUrl(dish)).filter(Boolean)));
    Promise.all(openingSources.map(preloadFeedImage)).finally(() => {
      if (!cancelled) {
        setFirstFeedCardReady(true);
        setFeedHasRendered(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [feedClientReady, feedHasRendered, firstUnderlayFeedCard, firstVisibleFeedCard, firstVisibleFeedCardKey, hasLoadedFeedCards, loading, loadingDishes, needsOpeningDishMode]);

  useEffect(() => {
    if (!feedHasRendered || !firstVisibleFeedCardKey || !hasLoadedFeedCards || loading || loadingDishes || needsOpeningDishMode) return undefined;
    if (typeof window === "undefined") return undefined;
    const key = swipeHintStorageKey(userId, guestMode);
    try {
      if (window.localStorage.getItem(key) === "1") return undefined;
      window.localStorage.setItem(key, "1");
    } catch {}
    setSwipeHintVisible(true);
    const timeout = window.setTimeout(() => setSwipeHintVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [feedHasRendered, firstVisibleFeedCardKey, guestMode, hasLoadedFeedCards, loading, loadingDishes, needsOpeningDishMode, userId]);

  if (!feedClientReady || needsOpeningDishMode) {
    return (
      <FeedLoading
        onModeSelect={(mode) => {
          setSelectedDishMode(mode);
          setNeedsOpeningDishMode(false);
        }}
      />
    );
  }

  if (loading || loadingDishes || !firstFeedCardReady) {
    return <FeedLogoLoading />;
  }

  return (
    <div className="h-[100dvh] bg-transparent text-black relative overflow-hidden flex flex-col">
      <div className="app-top-nav mt-1 px-4 pb-0 grid grid-cols-[1fr_auto_1fr] items-center shrink-0 relative">
        <div className="justify-self-start flex items-center gap-1.5">
          <Link
            href="/dishlists"
            className="top-action-btn"
            aria-label={t("People")}
          >
            <Users size={19} strokeWidth={2.35} />
          </Link>
          {feedStoryGroups.length ? (
            <button
              type="button"
              onClick={() => setFeedStoriesOpen(true)}
              className="no-accent-border relative flex h-11 min-w-[2.4rem] items-center rounded-[1rem] bg-transparent pl-0 pr-1.5"
              aria-label={t("Open user stories")}
            >
              <span className="flex items-center">
                {feedStoryPreviewGroups.map((group, index) => {
                  const viewedAll = userId
                    ? (group.stories || []).every((story) => (story.viewedBy || []).includes(userId))
                    : false;
                  const initial = (group.ownerName || "U").trim().charAt(0).toUpperCase();
                  return (
                    <span
                      key={group.ownerId}
                      className={`no-accent-border relative flex h-8 w-8 items-center justify-center rounded-full p-[2px] ${
                        viewedAll ? "bg-[#C6C6BF]" : "bg-[#2BD36B]"
                      } ${index > 0 ? "-ml-4" : ""}`}
                      style={{ zIndex: feedStoryPreviewGroups.length - index }}
                    >
                      <span className={`no-accent-border flex h-full w-full items-center justify-center overflow-hidden rounded-full p-[1.5px] ${
                        viewedAll ? "bg-[#2A2A2A]" : "bg-[#F6F6F2]"
                      }`}>
                        <span className="no-accent-border flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black">
                          {group.ownerPhotoURL ? (
                            <img src={group.ownerPhotoURL} alt={group.ownerName || "Story"} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[11px] font-black text-white">
                              {initial}
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </span>
              {extraFeedStoryCount ? (
                <span className="no-accent-border -ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-black text-white">
                  +{extraFeedStoryCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
        {showDishModeFilterButton ? (
          <div className="justify-self-center">
            <DishModeFilterButton
              value={selectedDishMode}
              onSelect={setSelectedDishMode}
              className="dish-mode-filter--large"
            />
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center justify-self-end gap-2">
          <Link
            href={userId ? "/directs" : "/?auth=1"}
            className="top-action-btn relative"
            aria-label="Open directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <button
            type="button"
            onClick={openActivity}
            className="top-action-btn relative"
            aria-label="Open activity"
          >
            <Bell size={18} />
            {hasActivityUpdate ? <span className="no-accent-border absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </button>
        </div>
      </div>
      {!userId && guestMode === "feed" && (
        <div className="px-5">
          <div className="bg-white border border-black/10 rounded-2xl px-4 py-3 text-sm text-black/70">
            {t("Add up to three dishes to your DishList. We'll ask you to create an account after the third.")}
          </div>
        </div>
      )}
      <div className="px-3 pt-0 grid grid-cols-[48px_1fr_48px] items-end gap-3 -mt-1">
        <button
          type="button"
          onClick={() => activeDeckRef.current?.previous?.()}
          className="no-accent-border flex h-10 w-11 items-center justify-center rounded-[1rem] bg-transparent text-black/36 shadow-none transition-transform active:scale-[0.97]"
          aria-label="Previous dish"
        >
          <ChevronLeft size={21} strokeWidth={2.8} />
        </button>
        <div className="feed-tab-switcher relative mx-auto flex items-end gap-10 border-b border-black/12">
          <button
            type="button"
            onClick={() => handleFeedTabChange("following")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "following" ? "text-black" : "text-black/45"
            }`}
          >
            {t("Following")}
            {followingHasUpdate ? (
              <span className="no-accent-border absolute -top-0.5 -right-3 w-2.5 h-2.5 rounded-full bg-[#E64646]" />
            ) : null}
            {activeFeed === "following" ? (
              <span className="feed-tab-active-underline absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => handleFeedTabChange("for_you")}
            className={`relative pb-2 text-sm font-semibold transition ${
              activeFeed === "for_you" ? "text-black" : "text-black/45"
            }`}
          >
            {t("For you")}
            {activeFeed === "for_you" ? (
              <span className="feed-tab-active-underline absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
        </div>
        <button
          type="button"
          onClick={() => activeDeckRef.current?.next?.()}
          className="no-accent-border flex h-10 w-11 items-center justify-center justify-self-end rounded-[1rem] bg-transparent text-black/36 shadow-none transition-transform active:scale-[0.97]"
          aria-label="Next dish"
        >
          <ChevronRight size={21} strokeWidth={2.8} />
        </button>
      </div>
      <div className="bottom-nav-spacer px-3 pt-0 flex-1 min-h-0 overflow-hidden relative">
        <div className={activeFeed === "for_you" ? "block h-full" : "hidden h-full"}>
          <SwipeDeck
            ref={forYouDeckRef}
            key={`for-you-${selectedDishMode}-${filterVersion}-${excludedTags.join("|")}-${selectedDishMode === DISH_MODE_RESTAURANT ? `${currentLocationStatus}-${Number(currentLocation?.lat || 0).toFixed(4)}-${Number(currentLocation?.lng || 0).toFixed(4)}` : "no-geo"}`}
	            dishes={orderedForYou}
	            preserveContinuity
	            initialIndex={currentForYouIndex}
	            onIndexChange={(index, card) => {
	              setForYouIndex(index);
	              setCurrentForYouCard(card || null);
	              updateModeIndex(setForYouIndexByMode, selectedDishMode, index);
	            }}
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
            trackSwipes
            onSwiped={handleDishSwiped}
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
          ) : (!followingResolved || followingLoading || followingResetting) && orderedFollowing.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <img
                src="/logo-real.png"
                alt="DishList"
                className="h-24 w-24 object-contain dishlist-loading-logo"
              />
            </div>
          ) : orderedFollowing.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <img
                src="/logo-real.png"
                alt="DishList"
                className="h-24 w-24 object-contain dishlist-loading-logo"
              />
            </div>
          ) : (
            <SwipeDeck
              ref={followingDeckRef}
              key={`following-${selectedDishMode}-${filterVersion}-${excludedTags.join("|")}-${selectedDishMode === DISH_MODE_RESTAURANT ? `${currentLocationStatus}-${Number(currentLocation?.lat || 0).toFixed(4)}-${Number(currentLocation?.lng || 0).toFixed(4)}` : "no-geo"}`}
	              dishes={orderedFollowing}
	              preserveContinuity
	              initialIndex={currentFollowingIndex}
	              onIndexChange={(index, card) => {
	                setFollowingIndex(index);
	                setCurrentFollowingCard(card || null);
	                updateModeIndex(setFollowingIndexByMode, selectedDishMode, index);
	              }}
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
              trackSwipes
              onSwiped={handleDishSwiped}
              onAuthRequired={() => setShowAuthPrompt(true)}
              onResetFeed={() => handleResetFeed("following")}
            />
          )}
        </div>
        <AnimatePresence>
          {swipeHintVisible ? <FeedSwipeHint onDismiss={dismissSwipeHint} /> : null}
        </AnimatePresence>
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
                      className={`px-3 py-1 rounded-full text-xs border transition ${darkMode ? getDarkTagChipClass(tag, enabled) : getTagChipClass(tag, enabled)}`}
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
      <StoryViewerModal
        open={feedStoriesOpen}
        onClose={() => setFeedStoriesOpen(false)}
        storyGroups={feedStoryGroups}
        initialGroupIndex={0}
        onViewed={handleFeedStoryViewed}
        currentUser={user}
      />
      <DishlistPickerModal
        open={dishlistPickerOpen}
        onClose={() => {
          setDishlistPickerOpen(false);
          setDishlistPickerDish(null);
          setDishlistPickerVariant("sheet");
        }}
        lists={dishlists}
        dishName={dishlistPickerDish?.name || "dish"}
        mode="multiple"
        selectedIds={selectedDishlistIds}
        lockedIds={["all_dishes"]}
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
        variant={dishlistPickerVariant}
        dishPreview={dishlistPickerVariant === "swipe" ? dishlistPickerDish : null}
      />
      <AnimatePresence>
        {activityOpen ? (
          <motion.div
            className="fixed inset-0 z-[138] bg-black/70 backdrop-blur-sm text-white flex items-end justify-center px-3 pb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivityOpen(false)}
          >
            <motion.div
            className="w-full max-w-md max-h-[calc(100dvh-4rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
              initial={{ y: 32, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 32, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
                <div>
                  <h2 className="text-[1.45rem] font-black leading-none tracking-[-0.03em]">{t("Activity")}</h2>
                  <div className="mt-1 text-xs font-semibold text-white/42">{t("Updates from your DishList")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivityOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-white"
                  aria-label="Close activity"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activityLoading && !activityItems.length ? (
                  <div className="py-10 text-center text-sm font-semibold text-white/42">{t("Loading updates...")}</div>
                ) : activityItems.length ? (
                  <div className="space-y-3">
                    {activityItems.slice(0, activityVisibleCount).map((item) => {
                      const Icon = item.icon || Bell;
                      const fresh = Number(item.timeMs || 0) > Number(activitySeenAt || 0);
                      const style = ACTIVITY_STYLE[item.kind] || ACTIVITY_STYLE.post;
                      return (
                        <Link
                          key={item.id}
                          href={item.href || "#"}
                          onClick={() => setActivityOpen(false)}
                          className="flex items-start gap-3.5 rounded-[1.45rem] border px-3.5 py-4 text-left transition active:scale-[0.99]"
                          style={{ borderColor: fresh ? style.border : "rgba(255,255,255,0.08)", background: fresh ? style.bg : "rgba(255,255,255,0.045)" }}
                        >
                          <div className="flex w-12 shrink-0 flex-col items-center gap-1.5">
                            <div className="relative flex h-12 w-12 items-center justify-center rounded-full" style={{ background: style.bg, color: style.color }}>
                              <Icon size={19} />
                              {fresh ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
                            </div>
                            {item.timeMs ? (
                              <div className="max-w-[3rem] rounded-full bg-white/7 px-2 py-0.5 text-center text-[10px] font-bold leading-tight text-white/45">{formatActivityTime(item.timeMs)}</div>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="text-[1.02rem] font-black leading-snug">
                              {item.actor}
                              <span className="font-semibold text-white/62"> {item.text}</span>
                            </div>
                            {item.detail ? <div className="mt-1.5 text-[0.86rem] font-semibold leading-snug text-white/48">{item.detail}</div> : null}
                          </div>
                        </Link>
                      );
                    })}
                    {activityItems.length > activityVisibleCount || !activityExpandedLoaded ? (
                      <button
                        type="button"
                        onClick={loadMoreActivity}
                        disabled={activityLoading}
                        className="mt-3 w-full rounded-full border border-white/12 bg-white/7 px-4 py-3 text-sm font-black text-white transition active:scale-[0.99]"
                      >
                        {activityLoading ? t("Loading updates...") : t("Load more")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/8">
                      <Bell size={20} />
                    </div>
                    <div className="text-sm font-black">{t("No updates yet")}</div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
                      Organize your food brain into Favorites, Uploaded, All dishes, or your own custom lists.
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
