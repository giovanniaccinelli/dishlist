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
  createDishForUser,
  getAllDishesFromFirestore,
  getAllDishlistsForUser,
  getCommentsForDish,
  getCommentsForStory,
  getDishesFromFirestore,
  getFollowingForUser,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersByIds,
  getUsersWhoSavedDish,
  recountDishSavesFromUsers,
  saveDishToSelectedDishlist,
  saveDishToUserList,
} from "./lib/firebaseHelpers";
import SaversModal from "../components/SaversModal";
import { Bell, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, UserPlus, Utensils, X } from "lucide-react";
import ShareModal from "../components/ShareModal";
import DishlistPickerModal from "../components/DishlistPickerModal";
import {
  dishModeMatches,
  DISH_MODE_ALL,
  DISH_MODE_COOKING,
  DishModeFilterButton,
  DishModeFilterModal,
  usePersistentDishMode,
} from "../components/DishModeControls";
import { arrayUnion, collection, collectionGroup, doc, getDoc, getDocs, limit as limitResults, orderBy, query, setDoc, where } from "firebase/firestore";
import { db } from "./lib/firebase";
import { isTextOnlyDish } from "./lib/dishContent";
import { useRouter } from "next/navigation";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "./lib/tags";
import { resolveRepresentativeTags } from "./lib/profileTags";
import { useUnreadDirects } from "./lib/useUnreadDirects";
import { useLanguage } from "../components/LanguageProvider";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";
const SELECTED_DISHES_KEY = "onboarding:selectedDishIds";
const viewedStorageKey = (userId) => `feed:viewedDishes:${userId}`;
const FEED_VIEWED_FIELD = "feedViewedDishIds";
const FEED_EXCLUDED_TAGS_KEY = "feed:excludedTags";
const activitySeenStorageKey = (userId) => `feed:activitySeenAt:${userId}`;

function timestampToMs(value) {
  if (!value) return 0;
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
  save: { color: "#E64646", bg: "rgba(230,70,70,0.13)", border: "rgba(230,70,70,0.28)" },
};
const ACTIVITY_INITIAL_LIMIT = 30;
const ACTIVITY_PAGE_SIZE = 30;

export default function Feed() {
  const { user, loading } = useAuth();
  const { t, darkMode } = useLanguage();
  const userId = user?.uid || null;
  const router = useRouter();
  const forYouDeckRef = useRef(null);
  const followingDeckRef = useRef(null);
  const viewedDishIdsRef = useRef([]);

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
  const [dishlistPickerVariant, setDishlistPickerVariant] = useState("sheet");
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["all_dishes"]);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [guestMode, setGuestMode] = useState(null);
  const [guestSavedIds, setGuestSavedIds] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [followingSinceById, setFollowingSinceById] = useState({});
  const [followingHasUpdate, setFollowingHasUpdate] = useState(false);
  const [viewedDishIds, setViewedDishIds] = useState([]);
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
  const [activityVisibleCount, setActivityVisibleCount] = useState(ACTIVITY_INITIAL_LIMIT);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = usePersistentDishMode("dish-mode:feed", DISH_MODE_ALL);
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(userId);
  const activeDeckRef = activeFeed === "following" ? followingDeckRef : forYouDeckRef;
  const showDishModeFilterButton = true;
  const hasActivityUpdate = activityItems.some((item) => Number(item.timeMs || 0) > Number(activitySeenAt || 0));

  const isOwnDish = (dish) => {
    if (!userId || !dish) return false;
    return [dish.owner, dish.ownerId, dish.userId, dish.uploadedBy, dish.createdBy]
      .filter(Boolean)
      .some((value) => String(value) === String(userId));
  };

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

  useEffect(() => {
    viewedDishIdsRef.current = viewedDishIds;
  }, [viewedDishIds]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setActivitySeenAt(0);
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
      if (!cancelled) setActivitySeenAt(Math.max(localSeen, remoteSeen));
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
      viewedDishIdsRef.current = [];
      setViewedHydrated(true);
      return;
    }
    let cancelled = false;
    setViewedHydrated(false);
    (async () => {
      const localIds = getStoredViewedDishIds();
      let serverIds = [];
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const data = snap.exists() ? snap.data() || {} : {};
        serverIds = Array.isArray(data[FEED_VIEWED_FIELD]) ? data[FEED_VIEWED_FIELD] : [];
      } catch (err) {
        console.error("Failed to load viewed feed dishes:", err);
      }
      if (cancelled) return;
      const merged = Array.from(new Set([...localIds, ...serverIds].map(String).filter(Boolean)));
      viewedDishIdsRef.current = merged;
      setViewedDishIds(merged);
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedStorageKey(userId), JSON.stringify(merged));
      }
      if (localIds.some((id) => !serverIds.includes(id))) {
        setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: merged }, { merge: true }).catch((err) =>
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
    if (userId && !viewedHydrated) return;
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
          const followBoost = followedOwners.has(dish.owner) ? 4 : 0;
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
      setLoadingDishes(true);
      try {
        const allItems = await getAllDishesFromFirestore();
        const seenIds = new Set(viewedDishIdsRef.current);
        const publicItems = allItems.filter(
          (dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish) && !seenIds.has(dish.id)
        );

        let nextFollowingIds = [];
        let forYou = [];
        let following = [];

        if (userId) {
          const [followed, saved, toTry, uploaded, currentUserSnap] = await Promise.all([
            getFollowingForUser(userId),
            getSavedDishesFromFirestore(userId),
            getToTryDishesFromFirestore(userId),
            getDishesFromFirestore(userId),
            getDoc(doc(db, "users", userId)),
          ]);
          nextFollowingIds = Array.from(new Set(followed || []));
          const followedSet = new Set(nextFollowingIds);
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
          forYou = buildForYouFeed(publicItems, tagCounts, followedSet, representativeTags);
          following = sortNewest(publicItems.filter((dish) => followedSet.has(dish.owner)));
        } else {
          forYou = shuffleArray(sortNewest(publicItems));
          following = [];
          setFollowingSinceById({});
        }

        setFollowingIds(nextFollowingIds);
        setForYouDeck(forYou);
        setFollowingDeck(following);
      } catch (err) {
        console.error("Failed to load feed dishes:", err);
        setFollowingIds([]);
        setFollowingSinceById({});
        setForYouDeck([]);
        setFollowingDeck([]);
      } finally {
        setLoadingDishes(false);
      }
    })();
  }, [userId, viewedHydrated]);

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
    const shouldRecount = params.get("recountSaves") === "1" || window.localStorage.getItem(recountFlagKey) !== "done";
    if (!shouldRecount) return;
    recountDishSavesFromUsers()
      .then(() => {
        window.localStorage.setItem(recountFlagKey, "done");
        return getAllDishesFromFirestore().then((items) => {
          const seenIds = new Set(getStoredViewedDishIds());
          const publicItems = items.filter(
            (dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish) && !seenIds.has(dish.id)
          );
          const ordered = publicItems
            .slice()
            .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
          setForYouDeck(shuffleArray(ordered));
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

  const orderedForYou = useMemo(
    () => forYouDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d) && dishModeMatches(d, selectedDishMode)),
    [forYouDeck, addedDishIds, excludedTagSet, selectedDishMode]
  );

  const orderedFollowing = useMemo(
    () => followingDeck.filter((d) => !addedDishIds.has(d.id) && isDishAllowedByFilters(d) && dishModeMatches(d, selectedDishMode)),
    [followingDeck, addedDishIds, excludedTagSet, selectedDishMode]
  );

  useEffect(() => {
    if (!userId || !orderedFollowing.length) {
      setFollowingHasUpdate(false);
      return;
    }
    const getDishCreatedMs = (dish) => {
      const raw = dish?.createdAt;
      if (raw?.toMillis) return raw.toMillis();
      if (raw?.seconds) return raw.seconds * 1000;
      if (raw instanceof Date) return raw.getTime();
      const numeric = Number(raw || 0);
      return Number.isFinite(numeric) ? numeric : 0;
    };
    const viewed = new Set(viewedDishIds);
    setFollowingHasUpdate(
      orderedFollowing.some((dish) => {
        const followSince = Number(followingSinceById[dish?.owner] || 0);
        if (!followSince) return false;
        return getDishCreatedMs(dish) > followSince && !viewed.has(dish.id);
      })
    );
  }, [userId, orderedFollowing, viewedDishIds, followingSinceById]);

  const handleFeedTabChange = (tab) => {
    setActiveFeed(tab);
  };

  const handleDishViewed = (dish) => {
    if (!userId || !dish?.id) return;
    setViewedDishIds((prev) => {
      if (prev.includes(dish.id)) return prev;
      const next = [...prev, dish.id];
      viewedDishIdsRef.current = next;
      if (typeof window !== "undefined") {
        localStorage.setItem(viewedStorageKey(userId), JSON.stringify(next));
      }
      setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: arrayUnion(dish.id) }, { merge: true }).catch((err) =>
        console.error("Failed to save viewed feed dish:", err)
      );
      return next;
    });
  };

  const handleAdd = async (dishToAdd, variant = "sheet") => {
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
      if (guestMode === "feed") return false;
      setShowAuthPrompt(true);
      return false;
    }
    if (!dishToAdd?.id) return;
    return handleAdd(dishToAdd, "swipe");
  };

  const handleResetFeed = async (feedType) => {
    setLoadingDishes(true);
    try {
      if (typeof window !== "undefined" && userId) {
        localStorage.removeItem(viewedStorageKey(userId));
        viewedDishIdsRef.current = [];
        setViewedDishIds([]);
        await setDoc(doc(db, "users", userId), { [FEED_VIEWED_FIELD]: [] }, { merge: true });
      }
      const items = await getAllDishesFromFirestore();
      const publicItems = items.filter((dish) => dish.isPublic !== false && !isOwnDish(dish) && !isTextOnlyDish(dish));
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

  const buildActivityItems = async () => {
    if (!userId) return [];
    setActivityLoading(true);
    try {
      const [userSnap, uploadedDishes] = await Promise.all([
        getDoc(doc(db, "users", userId)),
        getDishesFromFirestore(userId),
      ]);
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      const followers = Array.isArray(userData.followers) ? userData.followers : [];
      const activitySnap = await getDocs(query(collection(db, "users", userId, "activity"), orderBy("createdAt", "desc"), limitResults(80))).catch((error) => {
        console.error("Failed to load timestamped activity:", error);
        return { docs: [] };
      });
      const savedActivityEvents = activitySnap.docs
        .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
        .filter((event) => event.kind === "save" && event.actorId && event.actorId !== userId && event.dishId);
      const saveActivityUsers = await getUsersByIds(savedActivityEvents.map((event) => event.actorId)).catch((error) => {
        console.error("Failed to load timestamped save actors:", error);
        return [];
      });
      const saveActivityUsersById = new Map(saveActivityUsers.map((actor) => [actor.id, actor]));
      const saveActivityItems = savedActivityEvents.map((event) => {
        const actor = saveActivityUsersById.get(event.actorId);
        return {
          id: `save-${event.dishId}-${event.actorId}`,
          kind: "save",
          icon: Heart,
          actor: actor?.displayName || actor?.name || "Someone",
          text: t("saved your dish"),
          detail: event.dishName || "",
          href: `/dish/${event.dishId}?source=uploaded&mode=single`,
          timeMs: timestampToMs(event.createdAt || event.updatedAt),
        };
      });
      const followerUsers = await getUsersByIds(followers).catch((error) => {
        console.error("Failed to load follower activity:", error);
        return [];
      });
      const followerItems = followerUsers.map((follower) => ({
        id: `follow-${follower.id}`,
        kind: "follow",
        icon: UserPlus,
        actor: follower.displayName || follower.name || "Someone",
        text: t("started following you"),
        href: `/profile/${follower.id}`,
        timeMs: timestampToMs(userData.followersSince?.[follower.id] || follower.followingSince?.[userId]),
      }));

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

      const storySnap = await getDocs(query(collection(db, "users", userId, "stories"), orderBy("createdAt", "desc"), limitResults(12))).catch((error) => {
        console.error("Failed to load story activity:", error);
        return { docs: [] };
      });
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
                icon: Heart,
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
                icon: Heart,
                actor: saver.displayName || saver.name || "Someone",
                text: t("saved your dish"),
                detail: dish.name || "",
                href: `/dish/${dish.id}?source=uploaded&mode=single`,
                timeMs: timestampToMs(savedAt),
              }));
          }
        })
      );

      const items = [
        ...followerItems,
        ...followedPostItems,
        ...dishCommentGroups.flat(),
        ...storyCommentGroups.flat(),
        ...saveActivityItems,
        ...saveGroups.flat(),
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
      return undefined;
    }
    let cancelled = false;
    buildActivityItems().then((items) => {
      if (!cancelled) setActivityItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, followingDeck, followingSinceById]);

  const openActivity = async () => {
    if (!userId) {
      router.push("/?auth=1");
      return;
    }
    setActivityOpen(true);
    setActivityVisibleCount(ACTIVITY_INITIAL_LIMIT);
    await buildActivityItems();
    const now = Date.now();
    setActivitySeenAt(now);
    if (typeof window !== "undefined") {
      localStorage.setItem(activitySeenStorageKey(userId), String(now));
    }
    setDoc(doc(db, "users", userId), { feedActivitySeenAt: new Date(now) }, { merge: true }).catch(() => {});
  };

  if (loading || loadingDishes) {
    return <FeedLoading />;
  }

  return (
    <div className="h-[100dvh] bg-transparent text-black relative overflow-hidden flex flex-col">
      <div className="app-top-nav px-4 pb-2 grid grid-cols-[1fr_auto_1fr] items-center shrink-0 relative">
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="justify-self-start text-left"
          aria-label="Open DishList guide"
        >
          <h1 className="text-[1.65rem] font-bold leading-none">DishList</h1>
        </button>
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
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </Link>
          <button
            type="button"
            onClick={openActivity}
            className="top-action-btn relative"
            aria-label="Open activity"
          >
            <Bell size={18} />
            {hasActivityUpdate ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
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
      <div className="px-4 pt-1 grid grid-cols-[48px_1fr_48px] items-end gap-3">
        <button
          type="button"
          onClick={() => activeDeckRef.current?.previous?.()}
          className="no-accent-border flex h-10 w-11 items-center justify-center rounded-[1rem] bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
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
          className="no-accent-border flex h-10 w-11 items-center justify-center justify-self-end rounded-[1rem] bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
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
              <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activityLoading && !activityItems.length ? (
                  <div className="py-10 text-center text-sm font-semibold text-white/42">{t("Loading updates...")}</div>
                ) : activityItems.length ? (
                  <div className="space-y-2">
                    {activityItems.slice(0, activityVisibleCount).map((item) => {
                      const Icon = item.icon || Bell;
                      const fresh = Number(item.timeMs || 0) > Number(activitySeenAt || 0);
                      const style = ACTIVITY_STYLE[item.kind] || ACTIVITY_STYLE.post;
                      return (
                        <Link
                          key={item.id}
                          href={item.href || "#"}
                          onClick={() => setActivityOpen(false)}
                          className="flex items-center gap-3 rounded-[1.35rem] border px-3 py-3.5 text-left transition active:scale-[0.99]"
                          style={{ borderColor: fresh ? style.border : "rgba(255,255,255,0.08)", background: fresh ? style.bg : "rgba(255,255,255,0.045)" }}
                        >
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: style.bg, color: style.color }}>
                            <Icon size={18} />
                            {fresh ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[0.94rem] font-black">
                              {item.actor}
                              <span className="font-semibold text-white/62"> {item.text}</span>
                            </div>
                            {item.detail ? <div className="mt-1 truncate text-xs font-semibold text-white/42">{item.detail}</div> : null}
                          </div>
                          {item.timeMs ? (
                            <div className="shrink-0 rounded-full bg-white/7 px-2 py-1 text-[11px] font-bold text-white/45">{formatActivityTime(item.timeMs)}</div>
                          ) : null}
                        </Link>
                      );
                    })}
                    {activityItems.length > activityVisibleCount ? (
                      <button
                        type="button"
                        onClick={() => setActivityVisibleCount((count) => Math.min(activityItems.length, count + ACTIVITY_PAGE_SIZE))}
                        className="mt-3 w-full rounded-full border border-white/12 bg-white/7 px-4 py-3 text-sm font-black text-white transition active:scale-[0.99]"
                      >
                        {t("Load more")}
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
