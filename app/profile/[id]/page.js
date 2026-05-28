"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
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
  getUploadedDishesForUserAliases,
  getConversationId,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getOrCreateConversation,
  getUsersWhoSavedDish,
  getActiveStoriesForUser,
  markStoryViewed,
  saveDishToSelectedDishlist,
  getStoryPushStatsForUser,
  getLeaderboardAnswersForUser,
  getAvatarTone,
  normalizeProfilePhotoURL,
} from "../../lib/firebaseHelpers";
import AuthPromptModal from "../../../components/AuthPromptModal";
import { CalendarDays, ChevronLeft, ListChecks, NotebookText, Plus, Search, Send, Shuffle, Trophy, Upload, UserCheck, UserPlus, Users, X } from "lucide-react";
import SaversModal from "../../../components/SaversModal";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../../lib/dishImage";
import { hasDishMedia, isTextOnlyDish, orderDishesForProfileList } from "../../lib/dishContent";
import { resolveRepresentativeTags } from "../../lib/profileTags";
import { getDarkTagChipClass, getTagChipClass } from "../../lib/tags";
import StoryViewerModal from "../../../components/StoryViewerModal";
import DishlistPickerModal from "../../../components/DishlistPickerModal";
import DishRatingBadge from "../../../components/DishRatingBadge";
import ProfileTakesStrip from "../../../components/ProfileTakesStrip";
import MapPreview from "../../../components/MapPreview";
import RestaurantMapView from "../../../components/RestaurantMapView";
import {
  dishModeMatches,
  DISH_MODE_ALL,
  DishModeFilterButton,
  DishModeFilterModal,
  RestaurantMapIcon,
  usePersistentDishMode,
} from "../../../components/DishModeControls";
import { getRestaurantDishGroups } from "../../lib/restaurants";
import { LANGUAGE_IT, useLanguage } from "../../../components/LanguageProvider";
import { getSessionPageCache, setSessionPageCache } from "../../lib/sessionPageCache";

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

function uniqueNonEmpty(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getStoryCalendarMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStoryCalendarKey(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarMonthPreviewCells(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const first = new Date(year, month, 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dayKey: getStoryCalendarKey(date.getTime()),
      inMonth: date.getMonth() === month,
      isToday: getStoryCalendarKey(date.getTime()) === getStoryCalendarKey(Date.now()),
    };
  });
}

function getCalendarMonthDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Date(validDate.getFullYear(), validDate.getMonth(), 1, 12);
}

function addCalendarMonths(value, delta) {
  const date = getCalendarMonthDate(value);
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
}

function getCalendarMonthValue(value = new Date()) {
  const date = getCalendarMonthDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarMonthOptions(center = new Date(), language = "en") {
  const locale = language === LANGUAGE_IT ? "it-IT" : "en-US";
  const base = getCalendarMonthDate(center);
  return Array.from({ length: 25 }).map((_, index) => {
    const date = addCalendarMonths(base, index - 12);
    return {
      value: getCalendarMonthValue(date),
      label: date.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    };
  });
}

function parseCalendarMonthValue(value = "") {
  const [year, month] = String(value).split("-").map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return getCalendarMonthDate(new Date());
  return new Date(year, month - 1, 1, 12);
}

function SystemDishlistIcon({ id, className = "h-5 w-5" }) {
  if (id === "saved") return <Trophy className={`${className} text-[#F2D46D]`} strokeWidth={2.1} />;
  if (id === "to_try") return <NotebookText className={`${className} text-[#38BDF8]`} strokeWidth={2.1} />;
  if (id === "uploaded") return <Upload className={`${className} text-[#F2A23A]`} strokeWidth={2.1} />;
  if (id === "all_dishes") return <ListChecks className={`${className} text-[#2BD36B]`} strokeWidth={2.1} />;
  return null;
}

function DishlistPreviewGrid({ dishlist, preview = [], darkMode = false, t = (value) => value }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Array.from({ length: 4 }).map((_, index) => {
        const dish = preview[index];
        if (!dish) {
          return (
            <div
              key={`${dishlist.id}-empty-${index}`}
              className={`aspect-square w-full rounded-[0.85rem] border ${darkMode ? "border-white/10 bg-white/6" : "border-black/10 bg-black/6"}`}
            />
          );
        }
        const isRestaurant = String(dish?.dishMode || "").toLowerCase() === "restaurant";
        const borderColor = isRestaurant ? "#E64646" : "#E4B43F";
        const accentClass = isRestaurant ? "restaurant-accent-border" : "default-accent-border";
        if (!hasDishMedia(dish)) {
          return (
            <div
              key={`${dishlist.id}-${dish.id}-${index}`}
              className={`no-accent-border flex aspect-square w-full items-end overflow-hidden rounded-[0.85rem] border-2 p-2 text-left text-[10px] font-bold leading-tight ${accentClass} ${
                darkMode ? "bg-[#171717] text-white" : "bg-[#FBF8F1] text-black"
              }`}
              style={{ borderColor }}
            >
              <span className="line-clamp-3">{dish.name || t("Untitled dish")}</span>
            </div>
          );
        }
        return (
          <div key={`${dishlist.id}-${dish.id}-${index}`} className="relative aspect-square w-full overflow-hidden rounded-[0.85rem]">
            <img
              src={getDishImageUrl(dish, "thumb")}
              alt={dish.name || dishlist.name}
              className={`no-accent-border h-full w-full rounded-[0.85rem] border-2 ${accentClass} object-cover`}
              style={{ borderColor }}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_DISH_IMAGE;
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function getProfileIdCandidates(routeId, userDoc) {
  const data = userDoc?.data?.() || userDoc || {};
  const rawAppleSub = String(data.appleSub || "").trim();
  const routeValue = String(routeId || "").trim();
  const routeAppleSub = routeValue.startsWith("apple:") ? routeValue.slice(6) : "";
  return uniqueNonEmpty([
    userDoc?.id,
    routeValue,
    data.uid,
    data.userId,
    data.appleUserId,
    data.authUid,
    rawAppleSub,
    rawAppleSub ? `apple:${rawAppleSub}` : "",
    routeAppleSub,
  ]);
}

function profileDocMatchesId(routeId, userDoc) {
  const data = userDoc?.data?.() || userDoc || {};
  const routeValue = String(routeId || "").trim();
  if (!routeValue) return false;
  const routeAppleSub = routeValue.startsWith("apple:") ? routeValue.slice(6) : "";
  const rawAppleSub = String(data.appleSub || "").trim();
  const actualIds = uniqueNonEmpty([
    userDoc?.id,
    data.uid,
    data.userId,
    data.appleUserId,
    data.authUid,
    rawAppleSub,
    rawAppleSub ? `apple:${rawAppleSub}` : "",
  ]);
  return actualIds.includes(routeValue) || Boolean(routeAppleSub && rawAppleSub === routeAppleSub);
}

function getProfileDocScore(routeId, userDoc) {
  const data = userDoc?.data?.() || {};
  const routeValue = String(routeId || "").trim();
  const hasArray = (value) => (Array.isArray(value) && value.length ? 1 : 0);
  return (
    (String(userDoc?.id || "") === routeValue ? 4 : 0) +
    (data.uid === routeValue ? 10 : 0) +
    (data.authUid === routeValue ? 10 : 0) +
    (data.userId === routeValue ? 8 : 0) +
    (data.appleUserId === routeValue ? 8 : 0) +
    (data.displayName ? 3 : 0) +
    (data.photoURL ? 2 : 0) +
    hasArray(data.followers) +
    hasArray(data.following) +
    hasArray(data.savedDishes) +
    hasArray(data.toTryDishes)
  );
}

function pickBestProfileDoc(routeId, docs = []) {
  return [...docs].sort((a, b) => getProfileDocScore(routeId, b) - getProfileDocScore(routeId, a))[0] || null;
}

function mergeUniqueById(groups = []) {
  return Array.from(
    new Map(
      groups
        .flat()
        .filter((item) => item?.id)
        .map((item) => [item.id, item])
    ).values()
  );
}

function mergeStoryStats(groups = []) {
  const merged = {};
  groups.forEach((group) => {
    Object.entries(group || {}).forEach(([dishId, data]) => {
      const existing = merged[dishId] || { count: 0, history: [], updatedAt: null };
      const nextHistory = Array.isArray(data?.history) ? data.history : [];
      merged[dishId] = {
        count: Math.max(existing.count || 0, Number(data?.count || 0)),
        history: Array.from(new Set([...(existing.history || []), ...nextHistory])),
        updatedAt: data?.updatedAt || existing.updatedAt || null,
      };
    });
  });
  return merged;
}

function collectCalendarDayKeysFromValues(values = []) {
  const keys = new Set();
  const addValue = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        keys.add(trimmed.slice(0, 10));
        return;
      }
    }
    const ms = getStoryCalendarMillis(value);
    if (ms) keys.add(getStoryCalendarKey(ms));
  };
  values.forEach((item) => {
    if (!item) return;
    if (typeof item !== "object") {
      addValue(item);
      return;
    }
    [
      item.dayKey,
      item.dateKey,
      item.storyDayKey,
      item.calendarDayKey,
      item.date,
      item.ateAt,
      item.ateAtMs,
      item.dateMs,
      item.pushedAtMs,
      item.pushedAtISO,
      item.publishedAtMs,
      item.publishedAtISO,
      item.createdAt,
      item.updatedAt,
    ].forEach(addValue);
  });
  return keys;
}

export default function PublicProfile() {
  const { id } = useParams();
  const routeProfileId = decodeURIComponent(String(id || ""));
  const router = useRouter();
  const pathname = usePathname();
	  const { user } = useAuth();
	  const { t, darkMode, language } = useLanguage();
	  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const cachedPublicProfile = getSessionPageCache(`profile:public:${routeProfileId}`)?.value;
  const [profileUser, setProfileUser] = useState(() => cachedPublicProfile?.profileUser || null);
  const [savedDishes, setSavedDishes] = useState(() => cachedPublicProfile?.savedDishes || []);
  const [toTryDishes, setToTryDishes] = useState(() => cachedPublicProfile?.toTryDishes || []);
  const [customDishlists, setCustomDishlists] = useState(() => cachedPublicProfile?.customDishlists || []);
  const [profileAliasIds, setProfileAliasIds] = useState(() => cachedPublicProfile?.profileAliasIds || []);
  const [dishes, setDishes] = useState(() => cachedPublicProfile?.dishes || []);
  const [activeDishlistId, setActiveDishlistId] = useState("overview");
  const [dishlistSearchOpen, setDishlistSearchOpen] = useState(false);
  const [dishlistSearch, setDishlistSearch] = useState("");
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
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["all_dishes"]);
  const [activeStories, setActiveStories] = useState(() => cachedPublicProfile?.activeStories || []);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyPushStats, setStoryPushStats] = useState(() => cachedPublicProfile?.storyPushStats || {});
  const [leaderboardTakes, setLeaderboardTakes] = useState([]);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = usePersistentDishMode("dish-mode:profile", DISH_MODE_ALL);
  const [profileMapOpen, setProfileMapOpen] = useState(false);
  const [profileCalendarOpen, setProfileCalendarOpen] = useState(false);
  const [profileCalendarSelectedDay, setProfileCalendarSelectedDay] = useState(() => getStoryCalendarKey(Date.now()));
  const [profileCalendarMonthDate, setProfileCalendarMonthDate] = useState(() => getCalendarMonthDate(new Date()));
  const dishlistDetailSwipeRef = useRef(null);
  const profileCalendarMonthSwipeRef = useRef(null);
  const viewedAllStories =
    activeStories.length > 0 &&
    activeStories.every((story) => !user?.uid || (story.viewedBy || []).includes(user.uid));
  const avatarTone = getAvatarTone(profileUser?.displayName || "");
  const profilePhotoURL = normalizeProfilePhotoURL(profileUser?.photoURL || "");
  const profileIdCandidates = getProfileIdCandidates(routeProfileId, profileUser);
  const profileDocId = profileUser?.id || routeProfileId;
  const profileAliasKey = profileAliasIds.join("|");
  const canonicalProfileIds = profileAliasIds.length ? profileAliasIds : profileDocId ? [profileDocId] : [];
  const profileAuthUid =
    profileUser?.uid ||
    profileUser?.authUid ||
    profileUser?.appleUserId ||
    (profileUser?.appleSub ? `apple:${profileUser.appleSub}` : "") ||
    profileDocId;
  const isViewingOwnProfile = Boolean(user?.uid && profileIdCandidates.includes(user.uid));

	  useEffect(() => {
    if (!routeProfileId) return;
    let cancelled = false;
    const cacheKey = `profile:public:${routeProfileId}`;
    const cachedProfile = getSessionPageCache(cacheKey)?.value;
    if (cachedProfile) {
      setProfileUser(cachedProfile.profileUser || null);
      setProfileAliasIds(cachedProfile.profileAliasIds || []);
      setDishes(cachedProfile.dishes || []);
      setSavedDishes(cachedProfile.savedDishes || []);
      setToTryDishes(cachedProfile.toTryDishes || []);
      setCustomDishlists(cachedProfile.customDishlists || []);
      setActiveStories(cachedProfile.activeStories || []);
      setStoryPushStats(cachedProfile.storyPushStats || {});
      setProfileLoadFailed(false);
      return undefined;
    }

    (async () => {
      setProfileLoadFailed(false);
      const loadUserDoc = async () => {
        const matches = [];
        try {
          const direct = await getDoc(doc(db, "users", routeProfileId));
          if (direct.exists()) matches.push(direct);
        } catch (error) {
          console.error("Direct profile fetch failed:", error);
        }
        if (!matches.length) {
          try {
            const snapshot = await getDocs(collection(db, "users"));
            snapshot.docs.forEach((docSnap) => {
              if (profileDocMatchesId(routeProfileId, docSnap)) matches.push(docSnap);
            });
          } catch (error) {
            console.error("Public profile alias scan failed:", error);
          }
        }
        return {
          best: pickBestProfileDoc(routeProfileId, matches),
          aliases: uniqueNonEmpty([routeProfileId, ...matches.flatMap((docSnap) => getProfileIdCandidates(routeProfileId, docSnap))]),
        };
      };

      const { best: userDoc, aliases } = await loadUserDoc();
      if (cancelled) return;

      if (!userDoc?.exists?.()) {
        setProfileUser(null);
        setProfileAliasIds([]);
        setProfileLoadFailed(true);
        return;
      }

      const nextProfileUser = { id: userDoc.id, ...userDoc.data() };
      const candidateIds = aliases.length ? aliases : getProfileIdCandidates(routeProfileId, userDoc);
      setProfileAliasIds(candidateIds);
      setProfileUser(nextProfileUser);
      setProfileLoadFailed(false);

      const results = await Promise.allSettled([
        getUploadedDishesForUserAliases(candidateIds),
        Promise.all(candidateIds.map((candidateId) => getSavedDishesFromFirestore(candidateId))),
        Promise.all(candidateIds.map((candidateId) => getToTryDishesFromFirestore(candidateId))),
        Promise.all(candidateIds.map((candidateId) => getCustomDishlistsForUser(candidateId))),
        Promise.all(candidateIds.map((candidateId) => getActiveStoriesForUser(candidateId))),
        Promise.all(candidateIds.map((candidateId) => getStoryPushStatsForUser(candidateId))),
      ]);

      if (cancelled) return;

      const [dishesRes, savedRes, toTryRes, customRes, storiesRes, statsRes] = results;
      setDishes(dishesRes.status === "fulfilled" ? mergeUniqueById([dishesRes.value]) : []);
      setSavedDishes(savedRes.status === "fulfilled" ? mergeUniqueById(savedRes.value) : []);
      setToTryDishes(toTryRes.status === "fulfilled" ? mergeUniqueById(toTryRes.value) : []);
      setCustomDishlists(customRes.status === "fulfilled" ? mergeUniqueById(customRes.value) : []);
      setActiveStories(storiesRes.status === "fulfilled" ? mergeUniqueById(storiesRes.value) : []);
      setStoryPushStats(statsRes.status === "fulfilled" ? mergeStoryStats(statsRes.value) : {});
    })();

    return () => {
      cancelled = true;
    };
	  }, [routeProfileId]);

  useEffect(() => {
    if (!routeProfileId || profileLoadFailed || !profileUser) return;
    setSessionPageCache(`profile:public:${routeProfileId}`, {
      profileUser,
      profileAliasIds,
      dishes,
      savedDishes,
      toTryDishes,
      customDishlists,
      activeStories,
      storyPushStats,
    });
  }, [
    activeStories,
    customDishlists,
    dishes,
    profileAliasIds,
    profileLoadFailed,
    profileUser,
    routeProfileId,
    savedDishes,
    storyPushStats,
    toTryDishes,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!canonicalProfileIds.length) {
      setLeaderboardTakes([]);
      return undefined;
    }
    (async () => {
      try {
        const takes = await getLeaderboardAnswersForUser(canonicalProfileIds, false);
        if (!cancelled) setLeaderboardTakes(takes);
      } catch (error) {
        console.error("Failed to load public profile leaderboard takes:", error);
        if (!cancelled) setLeaderboardTakes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileAliasKey, profileDocId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setIsFollowing(false);
      return undefined;
    }
    (async () => {
      try {
        const currentUserSnap = await getDoc(doc(db, "users", user.uid));
        const following = Array.isArray(currentUserSnap.data()?.following) ? currentUserSnap.data().following : [];
        const nextIsFollowing =
          profileIdCandidates.some((candidateId) => following.includes(candidateId)) ||
          Boolean(profileUser?.followers?.includes(user.uid));
        if (!cancelled) setIsFollowing(nextIsFollowing);
      } catch {
        if (!cancelled) setIsFollowing(Boolean(profileUser?.followers?.includes(user.uid)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileIdCandidates, profileUser?.followers, user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryDishlistId = params.get("list");
    if (!queryDishlistId) return;
    setActiveDishlistId(queryDishlistId);
  }, []);

  useEffect(() => {
    if (activeDishlistId === "overview" || activeDishlistId === "saved" || activeDishlistId === "to_try" || activeDishlistId === "all_dishes" || activeDishlistId === "uploaded") return;
    if (customDishlists.some((dishlist) => dishlist.id === activeDishlistId)) return;
    setActiveDishlistId("overview");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("list");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [activeDishlistId, customDishlists, pathname, router]);

  useEffect(() => {
    setDishlistSearchOpen(false);
    setDishlistSearch("");
  }, [activeDishlistId]);

  const selectDishlist = (dishlistId) => {
    setActiveDishlistId(dishlistId);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (dishlistId === "overview") {
      params.delete("list");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
      return;
    } else {
      params.set("list", dishlistId);
    }
    const query = params.toString();
    window.history.pushState({ dishlistId }, "", query ? `${pathname}?${query}` : pathname);
  };

  const handleDishlistDetailPointerDown = (event) => {
    if (showingDishlistOverview) return;
    dishlistDetailSwipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleDishlistDetailPointerUp = (event) => {
    const start = dishlistDetailSwipeRef.current;
    dishlistDetailSwipeRef.current = null;
    if (!start || showingDishlistOverview) return;
    const deltaX = event.clientX - start.x;
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 120 && deltaY < 80) {
      event.preventDefault();
      event.stopPropagation();
      selectDishlist("overview");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || activeDishlistId === "overview") return undefined;
    const handlePopState = () => {
      setActiveDishlistId("overview");
      const params = new URLSearchParams(window.location.search);
      params.delete("list");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
    };
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let didReturn = false;

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (event) => {
      if (didReturn) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      const elapsed = Date.now() - startTime;
      if (deltaX > 90 && deltaY < 90 && elapsed < 900) {
        event.preventDefault();
        selectDishlist("overview");
      }
    };
    const handleTouchMove = (event) => {
      if (didReturn) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      if (deltaX > 42 && deltaY < 70) {
        didReturn = true;
        event.preventDefault();
        selectDishlist("overview");
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    window.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
      window.removeEventListener("touchend", handleTouchEnd, true);
    };
  }, [activeDishlistId, pathname]);

  const buildProfileReturnTo = () => {
    return activeDishlistId && activeDishlistId !== "overview"
      ? `${pathname}?list=${encodeURIComponent(activeDishlistId)}`
      : pathname;
  };

  // Follow/Unfollow handler
  const handleFollow = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    const userRef = doc(db, "users", profileDocId);
    const currentUserRef = doc(db, "users", user.uid);
    const currentFollowers = profileUser.followers || [];
    const currentUserSnap = await getDoc(currentUserRef);
    const currentFollowing = Array.isArray(currentUserSnap.data()?.following) ? currentUserSnap.data().following : [];
    const newFollowers = isFollowing
      ? currentFollowers.filter(f => f !== user.uid)
      : [...currentFollowers, user.uid];
    const newFollowing = isFollowing
      ? currentFollowing.filter((followId) => !profileIdCandidates.includes(followId))
      : Array.from(new Set([...currentFollowing, profileDocId]));
    await updateDoc(userRef, {
      followers: newFollowers,
      [`followersSince.${user.uid}`]: isFollowing ? null : Date.now(),
    });
    await updateDoc(currentUserRef, {
      following: newFollowing,
      [`followingSince.${profileDocId}`]: isFollowing ? null : Date.now(),
    });
    setProfileUser((prev) => (prev ? { ...prev, followers: newFollowers } : prev));
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
        (dishlist) => dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      setSelectedDishlistIds(["all_dishes"]);
    } finally {
      setDishlistsLoading(false);
    }
  };

  const handleDishlistSelect = async () => {
    if (!user?.uid || !dishlistPickerDish?.id || selectedDishlistIds.length === 0) return;
    const persistDishlistIds = selectedDishlistIds.filter((dishlistId) => dishlistId !== "all_dishes");
    const results = await Promise.all(
      persistDishlistIds.map((dishlistId) =>
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
        .map((snap) => ({ ...snap.data(), id: snap.id }));
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
    const sourceDishlist =
      source === "uploaded"
        ? allDishlists.find((dishlist) => dishlist.id === "uploaded")
        : source === "all_dishes"
          ? allDishlists.find((dishlist) => dishlist.id === "all_dishes")
          : source === "to_try"
            ? allDishlists.find((dishlist) => dishlist.id === "to_try")
            : source === "saved"
              ? allDishlists.find((dishlist) => dishlist.id === "saved")
              : customDishlist;
    const pool = (sourceDishlist?.dishes || []).filter((dish) => dishModeMatches(dish, selectedDishMode));
    if (!pool.length) {
      alert(t("No dishes to shuffle."));
      return;
    }
    const shuffledPool = pool
      .slice()
      .sort(() => Math.random() - 0.5)
      .filter((dish) => dish?.id);
    const randomDish = shuffledPool[0];
    const returnTo = encodeURIComponent(buildProfileReturnTo());
    const encodedDeckIds = encodeURIComponent(shuffledPool.map((dish) => dish.id).join(","));
    if (customDishlist) {
      router.push(`/dish/${randomDish.id}?source=dishlist&listId=${customDishlist.id}&mode=shuffle&profileId=${encodeURIComponent(profileDocId)}&returnTo=${returnTo}&deckIds=${encodedDeckIds}`);
      return;
    }
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle&profileId=${encodeURIComponent(profileDocId)}&returnTo=${returnTo}&deckIds=${encodedDeckIds}`);
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
    await markStoryViewed(profileDocId, story.id, user.uid);
    setActiveStories((prev) =>
      prev.map((item) =>
        item.id === story.id
          ? { ...item, viewedBy: Array.from(new Set([...(item.viewedBy || []), user.uid])) }
          : item
      )
    );
  };

  const getStoryPushCount = (dish) => Number(storyPushStats[dish?.id]?.count || 0);
  const getDishTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const getAddedTime = (dish) =>
    Math.max(
      getDishTimeMs(dish?.addedAt),
      getDishTimeMs(dish?.savedAt),
      getDishTimeMs(dish?.updatedAt),
      getDishTimeMs(dish?.createdAt)
    );
  const sortDishlistDishes = (dishesList, dishlistId = "") =>
    [...(dishesList || [])].sort((a, b) => {
      if (dishlistId === "uploaded") {
        return getDishTimeMs(b?.createdAt) - getDishTimeMs(a?.createdAt);
      }
      if (dishlistId === "to_try") {
        return getAddedTime(b) - getAddedTime(a);
      }
      if (dishlistId === "all_dishes") {
        return Number(b?.saves || 0) - Number(a?.saves || 0) || getAddedTime(b) - getAddedTime(a);
      }
      return (
        getStoryPushCount(b) - getStoryPushCount(a) ||
        Number(b?.saves || 0) - Number(a?.saves || 0) ||
        getAddedTime(b) - getAddedTime(a)
      );
    });
  const normalizeProfileDishlist = (dishlist) => {
    const dishes = sortDishlistDishes(dishlist?.dishes || [], dishlist?.id || "");
    return {
      ...dishlist,
      dishes,
      dishIds: dishes.map((dish) => dish.id).filter(Boolean),
      count: dishes.length,
    };
  };
  const allDishesCollection = Array.from(
    new Map(
      [...dishes, ...savedDishes, ...toTryDishes, ...customDishlists.flatMap((dishlist) => dishlist.dishes || [])]
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );
  const savedDishIds = new Set(savedDishes.map((dish) => dish?.id).filter(Boolean));
  const toTryCollection = Array.from(
    new Map(
      toTryDishes
        .filter((dish) => dish?.id && !savedDishIds.has(dish.id))
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );

  const localDishlists = [
    { id: "saved", name: "Classici", type: "system", dishes: savedDishes, count: savedDishes.length },
    { id: "to_try", name: "Voglie", type: "system", dishes: toTryCollection, count: toTryCollection.length },
    { id: "uploaded", name: "Miei", type: "system", dishes, count: dishes.length },
    {
      id: "all_dishes",
      name: "Tutto",
      type: "system",
      dishes: allDishesCollection,
      count: allDishesCollection.length,
    },
    ...customDishlists.map((dishlist) => ({
      ...dishlist,
      dishes: dishlist.dishes || [],
    })),
  ].map(normalizeProfileDishlist);
  const allDishlists = localDishlists.map(normalizeProfileDishlist);
  const allDishesForRepresentativeTags = allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
  const profileRepresentativeTags = resolveRepresentativeTags(profileUser?.representativeTags, allDishesForRepresentativeTags);

  const showingDishlistOverview = activeDishlistId === "overview";
  const dishlistSearchTerm = dishlistSearch.trim().toLowerCase();
  const dishMatchesSearch = (dish) => {
    if (!dishlistSearchTerm) return true;
    return [
      dish?.name,
      dish?.description,
      dish?.restaurantName,
      dish?.placeName,
      dish?.taggedUser,
      ...(Array.isArray(dish?.tags) ? dish.tags : []),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(dishlistSearchTerm));
  };
  const getVisibleDishlistDishes = (dishlist) =>
    orderDishesForProfileList((dishlist?.dishes || []).filter((dish) => dishModeMatches(dish, selectedDishMode)));
  const getDishlistPreviewDishes = (dishlist) => sortDishlistDishes(dishlist?.dishes || [], dishlist?.id || "").slice(0, 4);
  const unfilteredActiveDishlist =
    showingDishlistOverview ? null : allDishlists.find((dishlist) => dishlist.id === activeDishlistId) || null;
  const activeDishlist = unfilteredActiveDishlist
    ? {
        ...unfilteredActiveDishlist,
        dishes: getVisibleDishlistDishes(unfilteredActiveDishlist),
      }
    : null;
  const searchedActiveDishlistDishes = activeDishlist?.dishes?.filter(dishMatchesSearch) || [];
  const allDishesCount = allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.count || 0;
  const uploadedRestaurantGroups = useMemo(
    () => getRestaurantDishGroups(dishes),
    [dishes]
  );
  const storyCalendarDays = useMemo(() => {
    const dishById = new Map();
    allDishlists.forEach((dishlist) => {
      (dishlist.dishes || []).forEach((dish) => {
        if (dish?.id && !dishById.has(dish.id)) dishById.set(dish.id, dish);
      });
    });
    dishes.forEach((dish) => {
      if (dish?.id && !dishById.has(dish.id)) dishById.set(dish.id, dish);
    });

    const entries = [];
    Object.entries(storyPushStats || {}).forEach(([dishId, stats]) => {
      const dish = dishById.get(dishId) || { id: dishId };
      const history = Array.isArray(stats?.history) ? stats.history : [];
      const fallbackMs = getStoryCalendarMillis(stats?.lastPushedAtMs || stats?.lastPushedAtISO || stats?.updatedAt || stats?.createdAt);
      const entriesToRead = history.length ? history : fallbackMs ? [{ pushedAtMs: fallbackMs }] : [];
      entriesToRead.forEach((entry, index) => {
        const ms = getStoryCalendarMillis(entry?.pushedAtMs || entry?.pushedAtISO || entry?.createdAt || entry?.updatedAt || entry?.publishedAtMs || entry?.publishedAtISO);
        if (!ms) return;
        entries.push({
          id: `${dishId}-${ms}-${index}`,
          dayKey: getStoryCalendarKey(ms),
          ms,
          dishId,
          name: dish.name || entry?.name || "Untitled dish",
          imageDish: dish,
        });
      });
    });

    activeStories.forEach((story) => {
      const ms = getStoryCalendarMillis(story.ateAtMs || story.pushedAtMs || story.pushedAtISO || story.createdAt || story.updatedAt);
      if (!ms) return;
      entries.push({
        id: `active-${story.id || story.dishId || ms}`,
        dayKey: getStoryCalendarKey(ms),
        ms,
        dishId: story.dishId || story.id || "",
        name: story.name || story.dishName || "Untitled dish",
        imageDish: story,
      });
    });

    const byDay = new Map();
    entries
      .filter((entry) => entry.dayKey)
      .sort((a, b) => b.ms - a.ms)
      .forEach((entry) => {
        if (!byDay.has(entry.dayKey)) {
          byDay.set(entry.dayKey, { key: entry.dayKey, ms: entry.ms, items: [] });
        }
        const day = byDay.get(entry.dayKey);
        if (!day.items.some((item) => item.id === entry.id || (item.dishId && item.dishId === entry.dishId && item.ms === entry.ms))) {
          day.items.push(entry);
        }
      });

    return Array.from(byDay.values()).sort((a, b) => b.ms - a.ms);
  }, [activeStories, allDishlists, dishes, storyPushStats]);
  const storyCalendarByDay = useMemo(
    () => new Map(storyCalendarDays.map((day) => [day.key, day.items])),
    [storyCalendarDays]
  );
  const loggedCalendarDayKeys = useMemo(() => {
    const keys = new Set(storyCalendarDays.map((day) => day.key).filter(Boolean));
    collectCalendarDayKeysFromValues(activeStories).forEach((key) => keys.add(key));
    Object.values(storyPushStats || {}).forEach((stats) => {
      collectCalendarDayKeysFromValues([
        stats,
        ...(Array.isArray(stats?.history) ? stats.history : []),
      ]).forEach((key) => keys.add(key));
    });
    return keys;
  }, [activeStories, storyCalendarDays, storyPushStats]);
  const calendarPreviewCells = useMemo(() => getCalendarMonthPreviewCells(new Date()), []);
  const profileCalendarMonthCells = useMemo(
    () => getCalendarMonthPreviewCells(profileCalendarMonthDate),
    [profileCalendarMonthDate]
  );
  const profileCalendarMonthOptions = useMemo(
    () => getCalendarMonthOptions(profileCalendarMonthDate, language),
    [language, profileCalendarMonthDate]
  );
  const profileCalendarSelectedItems = storyCalendarByDay.get(profileCalendarSelectedDay) || [];
  const changeProfileCalendarMonth = (delta) => {
    setProfileCalendarMonthDate((prev) => addCalendarMonths(prev, delta));
  };
  const selectProfileCalendarDay = (dayKey) => {
    setProfileCalendarSelectedDay(dayKey);
    setProfileCalendarMonthDate(getCalendarMonthDate(new Date(`${dayKey}T12:00:00`)));
  };
  const handleProfileCalendarMonthPointerDown = (event) => {
    profileCalendarMonthSwipeRef.current = { x: event.clientX, y: event.clientY };
  };
  const handleProfileCalendarMonthPointerUp = (event) => {
    const start = profileCalendarMonthSwipeRef.current;
    profileCalendarMonthSwipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    changeProfileCalendarMonth(dx < 0 ? 1 : -1);
  };

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
        className="pointer-events-auto inline-flex items-center gap-1.5 text-left"
      >
        <Users size={13} strokeWidth={2.2} />
        <span>{Math.max(0, Number(dish.saves || 0))}</span>
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
    <div className="bottom-nav-spacer h-[100dvh] overflow-x-hidden overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 relative">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
          <div className="flex items-center justify-start">
            <AppBackButton fallback="/dishlists" />
          </div>
          <div className="flex min-w-0 items-center justify-center">
            {!isViewingOwnProfile ? (
              <button
                onClick={handleFollow}
                className={`people-follow-button no-accent-border inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[0.78rem] border px-2.5 text-[10.5px] font-bold leading-none shadow-[0_7px_16px_rgba(0,0,0,0.08)] transition active:scale-[0.98] ${
                  darkMode
                    ? isFollowing
                      ? "border-white/10 bg-white/[0.055] text-white/62 shadow-none"
                      : "border-[#2BD36B]/35 bg-[#142217] text-[#86E8A3]"
                    : isFollowing
                      ? "border-black/8 bg-[#F4F1EA] text-black/52 shadow-none"
                      : "border-[#C9E8CF] bg-[#F0FAF2] text-[#177A3D]"
                }`}
              >
                {isFollowing ? <UserCheck size={12} strokeWidth={2.3} /> : <UserPlus size={12} strokeWidth={2.3} />}
                {isFollowing ? t("Unfollow") : t("Follow")}
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-end" />
          <div className="flex h-[2.4rem] w-[2.4rem] items-center justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  setShowAuthPrompt(true);
                  return;
                }
                const targetUser = {
                  id: profileAuthUid,
                  uid: profileAuthUid,
                  displayName: profileUser?.displayName || "",
                  photoURL: profilePhotoURL,
                };
                const conversationId =
                  (await getOrCreateConversation(user, targetUser)) || getConversationId(user.uid, profileAuthUid);
                if (conversationId) {
                  router.push(`/directs/${conversationId}`);
                }
              }}
              className="top-action-btn relative shrink-0"
              aria-label="Directs"
            >
              <Send size={18} />
              {hasUnreadDirects ? <span className="no-accent-border absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
            </button>
          </div>
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
                <div
                  className="no-accent-border w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden"
                  style={profilePhotoURL ? undefined : { backgroundColor: avatarTone.bg }}
                >
                  {profilePhotoURL ? (
                    <img
                      src={profilePhotoURL}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span style={{ color: avatarTone.text }}>{profileUser.displayName?.[0] || "U"}</span>
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="flex-1 min-h-20 flex flex-col justify-start py-0.5">
            <div className="ml-2">
              <h1 className="text-[1.8rem] leading-none font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
              {profileRepresentativeTags.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profileRepresentativeTags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold leading-none ${
                        darkMode ? getDarkTagChipClass(tag, true) : getTagChipClass(tag, true)
                      }`}
                    >
                      {t(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileUser.followers?.length || 0))}</div>
                <button
                  onClick={() => openConnections("followers")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Followers")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileUser.following?.length || 0))}</div>
                <button
                  onClick={() => openConnections("following")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Following")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(dishes.length || 0))}</div>
                <button
                  onClick={() => selectDishlist("uploaded")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Uploaded")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(allDishesCount || 0))}</div>
                <button
                  onClick={() => selectDishlist("all_dishes")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("dishes")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {profileUser.bio ? (
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/68 whitespace-pre-wrap">{profileUser.bio}</p>
        ) : null}

      </div>

      {showingDishlistOverview ? (
        <div className="mx-auto mb-4 w-full max-w-3xl px-2">
          <div className="mb-2 flex items-center gap-2 leading-none">
            <span className={`truncate text-[1.02rem] font-bold ${darkMode ? "text-white" : "text-black"}`}>{t("Restaurant map")}</span>
            <RestaurantMapIcon className="h-[1.05rem] w-[1.05rem] shrink-0 text-[#E64646]" strokeWidth={2.05} />
          </div>
          <button
            type="button"
            onClick={() => setProfileMapOpen(true)}
            className={`relative block h-[7.25rem] w-full overflow-hidden rounded-[1.35rem] border text-left shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition active:scale-[0.98] ${
              darkMode ? "border-white/10 bg-[#121212]" : "border-black/10 bg-[#F2EFE8]"
            }`}
            aria-label="Open map"
          >
            <MapPreview groups={uploadedRestaurantGroups} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          </button>
        </div>
      ) : null}

      {showingDishlistOverview ? (
        <ProfileTakesStrip takes={leaderboardTakes} darkMode={darkMode} t={t} />
      ) : null}

      {showingDishlistOverview ? (
        <div className="mx-auto w-full max-w-3xl px-2 pb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ...allDishlists.filter((dishlist) => dishlist.type === "system"),
              ...allDishlists.filter((dishlist) => dishlist.type !== "system"),
            ].map((dishlist) => {
              const isMap = dishlist.type === "map";
              const preview = getDishlistPreviewDishes(dishlist);
              return (
                <button
                  key={dishlist.id}
                  type="button"
                  onClick={() => (isMap ? setProfileMapOpen(true) : selectDishlist(dishlist.id))}
                  className={`rounded-[1.5rem] border p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.08)] ${
                    darkMode ? "border-white/10 bg-[#151515]" : "border-black/10 bg-white"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className={`min-w-0 truncate text-[1rem] font-bold ${darkMode ? "text-white" : "text-black"}`}>{t(dishlist.name)}</div>
                    <SystemDishlistIcon id={dishlist.id} className="h-[1.1rem] w-[1.1rem] shrink-0" />
                  </div>
                  {isMap ? (
                    <div className={`relative grid aspect-square place-items-center overflow-hidden rounded-[1rem] border ${
                      darkMode ? "border-white/10 bg-[#0C1711]" : "border-black/10 bg-[#EAF6E9]"
                    }`}>
                      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
                      <RestaurantMapIcon className="relative h-10 w-10 text-[#E64646]" strokeWidth={2.05} />
                    </div>
                  ) : (
                    <DishlistPreviewGrid dishlist={dishlist} preview={preview} darkMode={darkMode} t={t} />
                  )}
                  <div className={`mt-2 text-xs ${darkMode ? "text-white/48" : "text-black/48"}`}>{Number(dishlist.count || 0)} {t("dishes")}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : activeDishlist ? (
        <div
          className="mx-auto w-full max-w-3xl px-2 pb-4"
          onPointerDown={handleDishlistDetailPointerDown}
          onPointerUp={handleDishlistDetailPointerUp}
          onPointerCancel={() => {
            dishlistDetailSwipeRef.current = null;
          }}
        >
	          <div
	            className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
	          >
	            <button
	              type="button"
              onClick={() => selectDishlist("overview")}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                darkMode ? "border-white/14 bg-[#161616] text-white" : "border-black/12 bg-white text-black"
              }`}
              aria-label={t("Back")}
	            >
	              <ChevronLeft size={16} />
	            </button>
	            <DishModeFilterButton value={selectedDishMode} onSelect={setSelectedDishMode} />
	            <button
	              type="button"
	              onClick={() => {
	                setDishlistSearchOpen((open) => !open);
	                if (dishlistSearchOpen) setDishlistSearch("");
	              }}
	              className={`inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full border text-sm font-semibold ${
	                darkMode ? "border-white/14 bg-[#161616] text-white" : "border-black/12 bg-white text-black"
	              }`}
	              aria-label={t("Search dishes")}
	            >
	              {dishlistSearchOpen ? <X size={16} /> : <Search size={16} />}
	            </button>
	          </div>
	          {dishlistSearchOpen ? (
	            <div
	              className="mb-3"
	              onPointerDown={(event) => event.stopPropagation()}
	              onPointerUp={(event) => event.stopPropagation()}
	              onClick={(event) => event.stopPropagation()}
	            >
	              <div className={`flex h-11 items-center gap-2 rounded-[1.15rem] border px-3 ${
	                darkMode ? "border-white/12 bg-white/8 text-white" : "border-black/10 bg-white text-black"
	              }`}>
	                <Search size={16} className={darkMode ? "text-white/45" : "text-black/40"} />
	                <input
	                  autoFocus
	                  type="search"
	                  value={dishlistSearch}
	                  onChange={(event) => setDishlistSearch(event.target.value)}
	                  placeholder={t("Search dishes...")}
	                  className={`min-w-0 flex-1 bg-transparent text-base outline-none ${
	                    darkMode ? "placeholder:text-white/35" : "placeholder:text-black/35"
	                  }`}
	                />
	              </div>
	            </div>
	          ) : null}
	          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-xl font-semibold">
              {activeDishlist?.name || "Tutto"}
              <SystemDishlistIcon id={activeDishlist?.id} className="h-5 w-5" />
            </h2>
            <button
              onClick={() => openShuffleDeck(activeDishlist?.id || "all_dishes")}
              className="profile-shuffle-btn inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
	              disabled={searchedActiveDishlistDishes.length === 0}
            >
              <Shuffle size={14} />
              {t("Shuffle")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
	        {searchedActiveDishlistDishes.length === 0 ? (
	          <div className={`col-span-2 h-32 flex items-center justify-center ${darkMode ? "text-white/72" : "rounded-xl bg-[#f0f0ea] text-gray-500"}`}>
	            {dishlistSearchTerm ? t("No matching dishes.") : t("No dishes here.")}
	          </div>
	        ) : (
	          <AnimatePresence initial={false}>
	            {searchedActiveDishlistDishes.map((dish, index) => {
              if (isTextOnlyDish(dish)) {
                return (
                  <motion.div
                    key={`${activeDishlist?.id || "list"}-${dish.id || index}`}
                    className={`pressable-card relative overflow-hidden rounded-[1.15rem] border-2 px-3 py-3 shadow-md ${
                      String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"
                    } ${darkMode ? "bg-[#171717] text-white" : "bg-white text-black"}`}
                  >
                    <div className="truncate text-[15px] font-bold leading-tight">{dish.name || "Untitled dish"}</div>
                  </motion.div>
                );
              }
              return (
              <motion.div
                key={`${activeDishlist?.id || "list"}-${dish.id || index}`}
                className={`pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative border-2 ${String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"}`}
              >
                <Link
                  href={(() => {
	                    const deckParam = encodeURIComponent(searchedActiveDishlistDishes.map((item) => item.id).filter(Boolean).join(","));
                    const returnParam = encodeURIComponent(buildProfileReturnTo());
                    return activeDishlist?.type === "custom"
                      ? `/dish/${dish.id}?source=dishlist&listId=${activeDishlist.id}&mode=single&profileId=${encodeURIComponent(profileDocId)}&returnTo=${returnParam}&deckIds=${deckParam}`
                      : `/dish/${dish.id}?source=${activeDishlist?.id || "all_dishes"}&mode=single&profileId=${encodeURIComponent(profileDocId)}&returnTo=${returnParam}&deckIds=${deckParam}`;
                  })()}
                  className="absolute inset-0 z-10"
                >
                  <span className="sr-only">Open dish card</span>
                </Link>
                <DishRatingBadge dish={dish} />
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
              );
            })}
          </AnimatePresence>
        )}
          </div>
        </div>
      ) : (
        <div className={`mx-auto flex h-32 w-full max-w-3xl items-center justify-center px-2 text-sm font-semibold ${darkMode ? "text-white/60" : "text-black/50"}`}>
          {t("Loading...")}
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
                      href={user?.uid === u.id ? "/profile" : `/profile/${encodeURIComponent(u.id)}`}
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
      />
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={profileUser.displayName || "User"}
        ownerPhotoURL={profilePhotoURL}
        onViewed={handleStoryViewed}
        currentUser={user}
      />
      <DishModeFilterModal
        open={dishModeFilterOpen}
        value={selectedDishMode}
        onClose={() => setDishModeFilterOpen(false)}
        onSelect={(mode) => {
          setSelectedDishMode(mode);
          setDishModeFilterOpen(false);
        }}
      />
      <AnimatePresence>
        {profileCalendarOpen ? (
          <motion.div
            className="fixed inset-0 z-[88] flex items-start justify-center bg-black/45 px-4 pb-[5.75rem] pt-[5.35rem] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileCalendarOpen(false)}
          >
            <motion.div
              className={`mx-auto flex max-h-full w-full max-w-[30rem] flex-col overflow-y-auto overscroll-contain rounded-[1.35rem] border p-3.5 shadow-2xl ${
                darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-[#FAF7F0] text-black"
              }`}
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/42" : "text-black/38"}`}>
                    {t("What you ate")}
                  </div>
                  <h3 className={`mt-1.5 text-[1.35rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {t("Calendar")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileCalendarOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${darkMode ? "border-white/12 bg-white/8 text-white/70" : "border-black/10 bg-white text-black/55"}`}
                  aria-label="Close food calendar"
                >
                  <X size={16} />
                </button>
              </div>
              <div className={`rounded-[1rem] border p-2 ${darkMode ? "border-white/10 bg-white/5" : "border-black/8 bg-white/86"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => changeProfileCalendarMonth(-1)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/7 text-white/70" : "border-black/8 bg-white text-black/55"}`}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <select
                    value={getCalendarMonthValue(profileCalendarMonthDate)}
                    onChange={(event) => setProfileCalendarMonthDate(parseCalendarMonthValue(event.target.value))}
                    className={`min-w-0 flex-1 rounded-full border px-3 py-1.5 text-center text-sm font-bold capitalize outline-none ${
                      darkMode ? "border-white/10 bg-[#171717] text-white" : "border-black/8 bg-white text-black"
                    }`}
                    aria-label="Choose month"
                  >
                    {profileCalendarMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => changeProfileCalendarMonth(1)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${darkMode ? "border-white/10 bg-white/7 text-white/70" : "border-black/8 bg-white text-black/55"}`}
                    aria-label="Next month"
                  >
                    <ChevronLeft className="rotate-180" size={15} />
                  </button>
                </div>
                <div
                  onPointerDown={handleProfileCalendarMonthPointerDown}
                  onPointerUp={handleProfileCalendarMonthPointerUp}
                  onPointerCancel={() => {
                    profileCalendarMonthSwipeRef.current = null;
                  }}
                >
                  <div className={`mb-1 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-black uppercase ${darkMode ? "text-white/38" : "text-black/35"}`}>
                    {["L", "M", "M", "G", "V", "S", "D"].map((day, index) => (
                      <span key={`${day}-${index}`}>{day}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {profileCalendarMonthCells.map((cell) => {
                      const items = storyCalendarByDay.get(cell.dayKey) || [];
                      const hasItems = loggedCalendarDayKeys.has(cell.dayKey);
                      const selected = cell.dayKey === profileCalendarSelectedDay;
                      return (
                        <button
                          key={cell.dayKey}
                          type="button"
                          onClick={() => selectProfileCalendarDay(cell.dayKey)}
                          style={hasItems ? { borderColor: "#F0A623", borderWidth: 2, borderStyle: "solid", boxShadow: "inset 0 0 0 1px #F0A623" } : undefined}
                          data-logged-day={hasItems ? "true" : undefined}
                          className={`relative flex h-10 items-center justify-center rounded-[0.65rem] border text-sm font-black ${
                            hasItems
                              ? selected
                                ? "bg-[#F0A623] text-black"
                                : darkMode
                                  ? "bg-[#171717] text-white"
                                  : "bg-white text-black"
                              : cell.isToday
                                ? "border-[#2BD36B] text-[#168944] shadow-[0_0_10px_rgba(43,211,107,0.22)]"
                                : selected
                                  ? darkMode ? "border-white bg-white text-black" : "border-black bg-black text-white"
                                  : cell.inMonth
                                    ? darkMode ? "border-white/8 bg-[#171717] text-white/78" : "border-black/8 bg-white text-black/72"
                                    : darkMode ? "border-white/[0.04] bg-white/[0.03] text-white/20" : "border-black/[0.04] bg-black/[0.02] text-black/20"
                          }`}
                        >
                          {cell.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={`mt-3 rounded-[1rem] border p-3 ${darkMode ? "border-white/10 bg-white/5" : "border-black/8 bg-white/86"}`}>
                <div className={`mb-3 text-xs font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/48" : "text-black/45"}`}>
                  {new Date(`${profileCalendarSelectedDay}T12:00:00`).toLocaleDateString(language === LANGUAGE_IT ? "it-IT" : "en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                {profileCalendarSelectedItems.length ? (
                  <div className="space-y-2">
                    {profileCalendarSelectedItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/dish/${item.dishId}?source=uploaded&mode=single&profileId=${encodeURIComponent(profileDocId)}&returnTo=${encodeURIComponent(`/profile/${encodeURIComponent(profileDocId)}`)}`}
                        className={`flex items-center gap-3 rounded-[1rem] p-3 ${darkMode ? "bg-black/24" : "bg-[#F7F2E8]"}`}
                      >
                        <img
                          src={getDishImageUrl(item.imageDish, "thumb")}
                          alt={item.name}
                          className="h-16 w-16 shrink-0 rounded-[0.85rem] object-cover"
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_DISH_IMAGE;
                          }}
                        />
                        <div className="min-w-0">
                          <div className={`truncate text-base font-semibold ${darkMode ? "text-white" : "text-black"}`}>{item.name}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={`flex h-20 items-center justify-center rounded-[1rem] text-center text-sm ${darkMode ? "bg-black/20 text-white/45" : "bg-[#F7F2E8] text-black/45"}`}>
                    {t("No calendar entries that day.")}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        {profileMapOpen ? (
          <motion.div
            className="fixed inset-0 z-[88] flex items-start justify-center bg-black/45 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(var(--app-top-nav-offset)+0.55rem)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileMapOpen(false)}
          >
            <motion.div
              className="mx-auto flex h-[calc(100dvh-var(--app-top-nav-offset)-env(safe-area-inset-bottom,0px)-2rem)] max-h-[calc(100dvh-var(--app-top-nav-offset)-env(safe-area-inset-bottom,0px)-2rem)] w-full max-w-[46rem] flex-col overflow-hidden"
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-3 px-1 text-white">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Profile map
                  </div>
                  <h3 className="mt-1.5 text-[1.45rem] leading-none font-semibold text-white">
                    Restaurants {profileUser?.displayName || "this user"} pinned
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileMapOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-white/12 text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md"
                  aria-label="Close profile map"
                >
                  <X size={16} />
                </button>
              </div>
              <RestaurantMapView
                groups={uploadedRestaurantGroups}
                className="h-full min-h-0 flex-1 max-h-none"
                emptyTitle="No restaurant dishes yet"
                emptyText="Restaurant-mode dishes with a selected place will show up here."
                dishHrefBuilder={(dish) => `/dish/${dish.id}?source=uploaded&mode=single&profileId=${encodeURIComponent(profileDocId)}&returnTo=${encodeURIComponent(`/profile/${encodeURIComponent(profileDocId)}?list=uploaded`)}`}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
