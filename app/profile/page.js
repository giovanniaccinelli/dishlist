"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCustomDishlist,
  deleteCustomDishlist,
  getCustomDishlistsForUser,
  uploadDishImageVariants,
  uploadProfileImage,
  deleteImageByUrl,
  saveDishToFirestore,
  getUploadedDishesForUserAliases,
  getAllDishlistsForUser,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  removeDishFromAllUsers,
  deleteDishAndImage,
  updateOwnerNameForDishes,
  getUsersWhoSavedDish,
  getActiveStoriesForUser,
  markStoryViewed,
  deleteStory,
  removeDishFromToTry,
  removeDishFromCustomDishlist,
  removeSavedDishFromUser,
  saveDishToSelectedDishlist,
  getStoryPushStatsForUser,
  getPopularCustomDishlistNames,
  getLeaderboardAnswersForUser,
  getLeaderboardQuestions,
  createLeaderboardQuestion,
  updateLeaderboardQuestion,
  deleteLeaderboardQuestion,
  updateCustomDishlistName,
  publishDishAsStory,
  getAvatarTone,
  isDisplayNameTaken,
  normalizeProfilePhotoURL,
} from "../lib/firebaseHelpers";
import { dispatchPushEvent } from "../lib/pushClient";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import AppToast from "../../components/AppToast";
import { auth, db } from "../lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { CalendarDays, ChevronLeft, ListChecks, Minus, MoreHorizontal, NotebookText, Pencil, Plus, Search, Send, Settings, Shuffle, Trophy, Trash2, Upload, Users, X } from "lucide-react";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "../lib/tags";
import { PROFILE_REPRESENTATIVE_TAG_LIMIT, normalizeRepresentativeTags, resolveRepresentativeTags } from "../lib/profileTags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import { hasDishMedia, isTextOnlyDish, orderDishesForProfileList } from "../lib/dishContent";
import SaversModal from "../../components/SaversModal";
import StoryViewerModal from "../../components/StoryViewerModal";
import RestaurantMapView from "../../components/RestaurantMapView";
import DishlistPickerModal from "../../components/DishlistPickerModal";
import DishRatingBadge from "../../components/DishRatingBadge";
import ProfileTakesStrip from "../../components/ProfileTakesStrip";
import MapPreview from "../../components/MapPreview";
import IngredientBulletTextarea from "../../components/IngredientBulletTextarea";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import {
  dishModeMatches,
  DISH_MODE_ALL,
  DISH_MODE_COOKING,
  DISH_MODE_RESTAURANT,
  DishModeFilterButton,
  DishModeFilterModal,
  RestaurantMapIcon,
  usePersistentDishMode,
} from "../../components/DishModeControls";
import { getRestaurantDishGroups } from "../lib/restaurants";
import { LANGUAGE_EN, LANGUAGE_IT, useLanguage } from "../../components/LanguageProvider";
import { clearSessionPageCache, getSessionPageCache, setSessionPageCache } from "../lib/sessionPageCache";

const STORY_CHOOSER_STEPS = [
  { label: "Name", color: "#E64646" },
  { label: "Details", color: "#F59E0B" },
  { label: "Recipe", color: "#23C268" },
  { label: "Story", color: "#38BDF8" },
];

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

function getStoryCalendarMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function getStoryCalendarKey(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarTimelineCells(days = [], selectedDayKey = getStoryCalendarKey(Date.now())) {
  const todayMs = new Date(`${getStoryCalendarKey(Date.now())}T12:00:00`).getTime();
  const selectedMs = new Date(`${selectedDayKey}T12:00:00`).getTime();
  const entryMs = days.map((day) => Number(day.ms || 0)).filter((ms) => Number.isFinite(ms) && ms > 0);
  const defaultStart = todayMs - 119 * 86400000;
  const defaultEnd = todayMs + 90 * 86400000;
  const minMs = Math.min(defaultStart, todayMs, Number.isFinite(selectedMs) ? selectedMs : todayMs, ...entryMs);
  const maxMs = Math.max(defaultEnd, todayMs, Number.isFinite(selectedMs) ? selectedMs : todayMs, ...entryMs);
  const start = new Date(minMs);
  const end = new Date(maxMs);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return Array.from({ length: totalDays }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dayKey: getStoryCalendarKey(date.getTime()),
      inMonth: true,
      isToday: getStoryCalendarKey(date.getTime()) === getStoryCalendarKey(Date.now()),
    };
  });
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

async function getMealCalendarEntriesForUserIds(userIds = []) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const snapshots = await Promise.all(
    ids.map((userId) => getDocs(collection(db, "users", userId, "mealCalendar")))
  );
  return snapshots.flatMap((snap) =>
    snap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const ateAtMs = Number(data.ateAtMs || 0) || getStoryCalendarMillis(data.createdAt);
      return {
        id: docSnap.id,
        name: data.name || data.title || "",
        dayKey: data.dayKey || getStoryCalendarKey(ateAtMs),
        ms: ateAtMs,
        createdAt: data.createdAt || null,
        calendarOnly: true,
      };
    })
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

function profileDocMatchesAccount(user, userDoc) {
  if (profileDocMatchesId(user?.uid, userDoc)) return true;
  const data = userDoc?.data?.() || {};
  const authEmail = String(user?.email || "").trim().toLowerCase();
  const docEmail = String(data.email || "").trim().toLowerCase();
  return Boolean(authEmail && docEmail && authEmail === docEmail);
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

export default function Profile() {
  const { user, loading, deleteAccount } = useAuth();
  const { language, setLanguage, darkMode, setDarkMode, t } = useLanguage();
	  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
	  const router = useRouter();
	  const pathname = usePathname();
  const cachedOwnProfile = user?.uid ? getSessionPageCache(`profile:own:${user.uid}`)?.value : null;

	  const [isModalOpen, setIsModalOpen] = useState(false);
	  const [editProfileModal, setEditProfileModal] = useState(false);
  const [uploadedDishes, setUploadedDishes] = useState(() => cachedOwnProfile?.uploadedDishes || []);
  const [savedDishes, setSavedDishes] = useState(() => cachedOwnProfile?.savedDishes || []);
  const [toTryDishes, setToTryDishes] = useState(() => cachedOwnProfile?.toTryDishes || []);
  const [customDishlists, setCustomDishlists] = useState(() => cachedOwnProfile?.customDishlists || []);
  const [profileOwnerId, setProfileOwnerId] = useState(() => cachedOwnProfile?.profileOwnerId || "");
  const [profileAliasIds, setProfileAliasIds] = useState(() => cachedOwnProfile?.profileAliasIds || []);
  const [profileUser, setProfileUser] = useState(() => cachedOwnProfile?.profileUser || null);
  const [profileContentReady, setProfileContentReady] = useState(() => Boolean(cachedOwnProfile));
  const [profileMeta, setProfileMeta] = useState(() => cachedOwnProfile?.profileMeta || { followers: [], following: [], savedDishes: [], bio: "", representativeTags: null });
  const [activeDishlistId, setActiveDishlistId] = useState("overview");
  const [dishlistSearchOpen, setDishlistSearchOpen] = useState(false);
  const [dishlistSearch, setDishlistSearch] = useState("");
  const [dishlistsOpen, setDishlistsOpen] = useState(false);
  const [dishlistsEditMode, setDishlistsEditMode] = useState(false);
  const [dishlistDeleteTarget, setDishlistDeleteTarget] = useState(null);
  const [dishlistRenameTarget, setDishlistRenameTarget] = useState(null);
  const [dishlistRenameValue, setDishlistRenameValue] = useState("");
  const [createDishlistOpen, setCreateDishlistOpen] = useState(false);
  const [newDishlistName, setNewDishlistName] = useState("");
  const [createDishlistStep, setCreateDishlistStep] = useState(0);
  const [popularDishlistNames, setPopularDishlistNames] = useState([]);
  const [selectedDishIds, setSelectedDishIds] = useState([]);
  const [createSourceDishlistId, setCreateSourceDishlistId] = useState("saved");
  const [createDishSearch, setCreateDishSearch] = useState("");
  const [creatingDishlist, setCreatingDishlist] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishRecipeIngredients, setDishRecipeIngredients] = useState("");
  const [dishRecipeMethod, setDishRecipeMethod] = useState("");
  const [dishTags, setDishTags] = useState([]);
  const [dishIsPublic, setDishIsPublic] = useState(true);
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [newBio, setNewBio] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(user?.photoURL || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTitle, setConnectionsTitle] = useState("");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsUsers, setConnectionsUsers] = useState([]);
  const [profileOptionsOpen, setProfileOptionsOpen] = useState(false);
  const [representativeTagsDraft, setRepresentativeTagsDraft] = useState([]);
  const [representativeTagsSaving, setRepresentativeTagsSaving] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [activeStories, setActiveStories] = useState(() => cachedOwnProfile?.activeStories || []);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyActionOpen, setStoryActionOpen] = useState(false);
  const [storyPushStats, setStoryPushStats] = useState(() => cachedOwnProfile?.storyPushStats || {});
  const [profileCalendarOpen, setProfileCalendarOpen] = useState(false);
  const [profileCalendarSelectedDay, setProfileCalendarSelectedDay] = useState(() => getStoryCalendarKey(Date.now()));
  const [profileCalendarVisibleDay, setProfileCalendarVisibleDay] = useState(() => getStoryCalendarKey(Date.now()));
  const [profileCalendarMonthDate, setProfileCalendarMonthDate] = useState(() => getCalendarMonthDate(new Date()));
  const [mealCalendarEntries, setMealCalendarEntries] = useState(() => cachedOwnProfile?.mealCalendarEntries || []);
  const [mealCalendarEntryOpen, setMealCalendarEntryOpen] = useState(false);
  const [mealCalendarEntryName, setMealCalendarEntryName] = useState("");
  const [mealCalendarEntrySaving, setMealCalendarEntrySaving] = useState(false);
  const [leaderboardTakes, setLeaderboardTakes] = useState(() => cachedOwnProfile?.leaderboardTakes || []);
  const [leaderboardAdminOpen, setLeaderboardAdminOpen] = useState(false);
  const [leaderboardAdminPassword, setLeaderboardAdminPassword] = useState("");
  const [leaderboardQuestionTitle, setLeaderboardQuestionTitle] = useState("");
  const [leaderboardQuestionLabel, setLeaderboardQuestionLabel] = useState("IN TREND");
  const [leaderboardQuestionAccent, setLeaderboardQuestionAccent] = useState("red");
  const [leaderboardQuestionDishMode, setLeaderboardQuestionDishMode] = useState("restaurant");
  const [leaderboardQuestionEditingId, setLeaderboardQuestionEditingId] = useState("");
  const [leaderboardAdminQuestions, setLeaderboardAdminQuestions] = useState([]);
  const [leaderboardQuestionSaving, setLeaderboardQuestionSaving] = useState(false);
  const [dishCardActionTarget, setDishCardActionTarget] = useState(null);
  const [profileMapOpen, setProfileMapOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [removePreviewTarget, setRemovePreviewTarget] = useState(null);
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlistPickerLists, setDishlistPickerLists] = useState([]);
  const [dishlistPickerLoading, setDishlistPickerLoading] = useState(false);
  const [dishlistPickerSelectedIds, setDishlistPickerSelectedIds] = useState([]);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = usePersistentDishMode("dish-mode:profile", DISH_MODE_ALL);
  const profileOptionsRef = useRef(null);
  const profileCalendarRailRef = useRef(null);
  const profileCalendarMonthSwipeRef = useRef(null);
  const dishlistDetailSwipeRef = useRef(null);
  const dishActionPointerGuardRef = useRef({ dishId: "", until: 0 });
  const effectiveDisplayName = profileUser?.displayName || profileMeta.displayName || user?.displayName || "My Profile";
  const effectiveProfilePhotoURL = normalizeProfilePhotoURL(
    profileUser?.photoURL || (typeof profileMeta.photoURL === "string" ? profileMeta.photoURL : user?.photoURL || "")
  );
  const hasStories = activeStories.length > 0;
  const avatarTone = getAvatarTone(effectiveDisplayName);
  const profileIdCandidates = getProfileIdCandidates(user?.uid, profileUser);
  const profileDocId = profileOwnerId || profileUser?.id || user?.uid || "";
  const profileAliasKey = profileAliasIds.join("|");
  const canonicalProfileIds = profileAliasIds.length ? profileAliasIds : profileDocId ? [profileDocId] : [];
  const selectedRepresentativeTags = normalizeRepresentativeTags(profileMeta.representativeTags);
  const handleDishModeSelect = (nextMode) => {
    const normalized =
      nextMode === DISH_MODE_COOKING || nextMode === DISH_MODE_RESTAURANT || nextMode === DISH_MODE_ALL
        ? nextMode
        : DISH_MODE_ALL;
    setSelectedDishMode(normalized);
  };
  const refreshCustomDishlists = async (ownerId = user?.uid) => {
    if (!ownerId) return [];
    const lists = await getCustomDishlistsForUser(ownerId);
    setCustomDishlists(lists);
    return lists;
  };
  const openMealCalendarEntry = (dayKey = getStoryCalendarKey(Date.now())) => {
    setProfileCalendarSelectedDay(dayKey);
    setProfileCalendarMonthDate(getCalendarMonthDate(new Date(`${dayKey}T12:00:00`)));
    setMealCalendarEntryName("");
    setMealCalendarEntryOpen(true);
  };
  const saveMealCalendarEntry = async () => {
    const name = mealCalendarEntryName.trim();
    if (!name || !user?.uid || mealCalendarEntrySaving) return;
    setMealCalendarEntrySaving(true);
    try {
      const dayKey = profileCalendarSelectedDay || getStoryCalendarKey(Date.now());
      const ateAtMs = new Date(`${dayKey}T12:00:00`).getTime();
      const docRef = await addDoc(collection(db, "users", user.uid, "mealCalendar"), {
        name,
        dayKey,
        ateAtMs: Number.isFinite(ateAtMs) ? ateAtMs : Date.now(),
        createdAt: serverTimestamp(),
      });
      setMealCalendarEntries((prev) => [
        {
          id: docRef.id,
          name,
          dayKey,
          ms: Number.isFinite(ateAtMs) ? ateAtMs : Date.now(),
          createdAt: null,
          calendarOnly: true,
        },
        ...prev,
      ]);
      setMealCalendarEntryOpen(false);
      setMealCalendarEntryName("");
      setToast(t("Saved"));
      setToastVariant("success");
      setTimeout(() => setToast(""), 1200);
    } catch (error) {
      console.error("Failed to save calendar entry:", error);
      setToast(t("Something went wrong"));
      setToastVariant("error");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setMealCalendarEntrySaving(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

	  useEffect(() => {
    if (!user) {
      setProfileContentReady(false);
      return undefined;
    }

    let cancelled = false;
    const cacheKey = `profile:own:${user.uid}`;
    const cachedProfile = getSessionPageCache(cacheKey)?.value;
    if (cachedProfile) {
      setProfileAliasIds(cachedProfile.profileAliasIds || [user.uid]);
      setProfileOwnerId(cachedProfile.profileOwnerId || user.uid);
      setProfileUser(cachedProfile.profileUser || null);
      setProfileMeta(cachedProfile.profileMeta || { followers: [], following: [], savedDishes: [], bio: "", representativeTags: null });
      setUploadedDishes(cachedProfile.uploadedDishes || []);
      setSavedDishes(cachedProfile.savedDishes || []);
      setToTryDishes(cachedProfile.toTryDishes || []);
      setCustomDishlists(cachedProfile.customDishlists || []);
      setActiveStories(cachedProfile.activeStories || []);
      setStoryPushStats(cachedProfile.storyPushStats || {});
      setMealCalendarEntries(cachedProfile.mealCalendarEntries || []);
      setLeaderboardTakes(cachedProfile.leaderboardTakes || []);
      setProfileContentReady(true);
    } else {
      setProfileContentReady(false);
    }
    (async () => {
      try {
        const loadUserDoc = async () => {
          const matches = [];
          try {
            const direct = await getDoc(doc(db, "users", user.uid));
            if (direct.exists()) matches.push(direct);
          } catch (error) {
            console.error("Direct own-profile fetch failed:", error);
          }
          if (!matches.length) {
            try {
              const snapshot = await getDocs(collection(db, "users"));
              snapshot.docs.forEach((docSnap) => {
                if (profileDocMatchesAccount(user, docSnap)) matches.push(docSnap);
              });
            } catch (error) {
              console.error("Own-profile alias scan failed:", error);
            }
          }
          return {
            best: pickBestProfileDoc(user.uid, matches),
            aliases: uniqueNonEmpty([user.uid, ...matches.flatMap((docSnap) => getProfileIdCandidates(user.uid, docSnap))]),
          };
        };

        const { best: userDoc, aliases } = await loadUserDoc();
        const nextProfileUser = userDoc?.exists?.() ? { id: userDoc.id, ...userDoc.data() } : null;
        if (cancelled) return;
        setProfileAliasIds(aliases.length ? aliases : [user.uid]);
        setProfileOwnerId(nextProfileUser?.id || user.uid);
        setProfileUser(nextProfileUser);
        if (nextProfileUser) {
          setProfileMeta((prev) => ({
            ...prev,
            followers: Array.isArray(nextProfileUser.followers) ? nextProfileUser.followers : [],
            following: Array.isArray(nextProfileUser.following) ? nextProfileUser.following : [],
            savedDishes: Array.isArray(nextProfileUser.savedDishes) ? nextProfileUser.savedDishes : [],
            displayName: nextProfileUser.displayName || "",
            photoURL: nextProfileUser.photoURL || "",
            bio: nextProfileUser.bio || "",
            representativeTags: normalizeRepresentativeTags(nextProfileUser.representativeTags),
          }));
        }
        setProfileContentReady(true);
        const candidateIds = aliases.length ? aliases : getProfileIdCandidates(user.uid, userDoc);
        const results = await Promise.allSettled([
          getUploadedDishesForUserAliases(candidateIds),
          Promise.all(candidateIds.map((candidateId) => getSavedDishesFromFirestore(candidateId))),
          Promise.all(candidateIds.map((candidateId) => getToTryDishesFromFirestore(candidateId))),
          Promise.all(candidateIds.map((candidateId) => getCustomDishlistsForUser(candidateId))),
          Promise.all(candidateIds.map((candidateId) => getActiveStoriesForUser(candidateId))),
          Promise.all(candidateIds.map((candidateId) => getStoryPushStatsForUser(candidateId))),
          getMealCalendarEntriesForUserIds(candidateIds),
          getLeaderboardAnswersForUser(candidateIds, true),
        ]);
        const [uploadedRes, savedRes, toTryRes, customRes, storiesRes, statsRes, mealCalendarRes, takesRes] = results;
        if (cancelled) return;
        if (uploadedRes.status === "fulfilled") {
          setUploadedDishes(mergeUniqueById([uploadedRes.value]));
        }
        setSavedDishes(savedRes.status === "fulfilled" ? mergeUniqueById(savedRes.value) : []);
        setToTryDishes(toTryRes.status === "fulfilled" ? mergeUniqueById(toTryRes.value) : []);
        setCustomDishlists(customRes.status === "fulfilled" ? mergeUniqueById(customRes.value) : []);
        setActiveStories(storiesRes.status === "fulfilled" ? mergeUniqueById(storiesRes.value) : []);
        setStoryPushStats(statsRes.status === "fulfilled" ? mergeStoryStats(statsRes.value) : {});
        setMealCalendarEntries(mealCalendarRes.status === "fulfilled" ? mealCalendarRes.value : []);
        setLeaderboardTakes(takesRes.status === "fulfilled" ? takesRes.value : []);
      } catch (error) {
        console.error("Failed to load own profile:", error);
        if (!cancelled) setProfileContentReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
	  }, [user]);

  useEffect(() => {
    if (!user?.uid || !profileContentReady) return;
    setSessionPageCache(`profile:own:${user.uid}`, {
      profileAliasIds,
      profileOwnerId,
      profileUser,
      profileMeta,
      uploadedDishes,
      savedDishes,
      toTryDishes,
      customDishlists,
      activeStories,
      storyPushStats,
      mealCalendarEntries,
      leaderboardTakes,
    });
  }, [
    activeStories,
    customDishlists,
    leaderboardTakes,
    mealCalendarEntries,
    profileAliasIds,
    profileContentReady,
    profileMeta,
    profileOwnerId,
    profileUser,
    savedDishes,
    storyPushStats,
    toTryDishes,
    uploadedDishes,
    user?.uid,
  ]);

  useEffect(() => {
    if (!user?.uid || !profileAliasIds.length) return;
    let cancelled = false;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;
        if (userSnap.exists()) {
          const data = userSnap.data() || {};
          setProfileOwnerId((prev) => prev || userSnap.id);
          setProfileMeta((prev) => ({
            ...prev,
            followers: Array.isArray(data.followers) ? data.followers : [],
            following: Array.isArray(data.following) ? data.following : [],
            savedDishes: Array.isArray(data.savedDishes) ? data.savedDishes : [],
            displayName: data.displayName || "",
            photoURL: data.photoURL || "",
            bio: data.bio || "",
            representativeTags: normalizeRepresentativeTags(data.representativeTags),
          }));
        }
      } catch (err) {
        console.error("Failed to hydrate profile counts:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, profileAliasKey]);

  const loadOwnUploadedDishes = async () => {
    if (!user?.uid) return [];
    const userSnap = await getDoc(doc(db, "users", user.uid));
    return getUploadedDishesForUserAliases(getProfileIdCandidates(user.uid, userSnap));
  };


  useEffect(() => {
    if (!editProfileModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editProfileModal]);

  useEffect(() => {
    if (!editProfileModal) return;
    setNewName(user?.displayName || "");
    setNewBio(profileMeta.bio || "");
    setNewPhotoFile(null);
    setRemovePhoto(false);
    setNewPhotoPreview(effectiveProfilePhotoURL);
  }, [editProfileModal, user?.displayName, effectiveProfilePhotoURL, profileMeta.bio]);

  useEffect(() => {
    if (!profileOptionsOpen) return;
    setRepresentativeTagsDraft(selectedRepresentativeTags);
  }, [profileOptionsOpen, profileMeta.representativeTags]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("settings") !== "1") return;
    setProfileOptionsOpen(true);
    params.delete("settings");
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/profile?${query}` : "/profile");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendarEntry") !== "1") return;
    setProfileCalendarOpen(true);
    openMealCalendarEntry(getStoryCalendarKey(Date.now()));
    params.delete("calendarEntry");
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/profile?${query}` : "/profile");
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setProfileMeta({
        followers: data.followers || [],
        following: data.following || [],
        savedDishes: data.savedDishes || [],
        displayName: data.displayName || "",
        photoURL: data.photoURL || "",
        bio: data.bio || "",
        representativeTags: normalizeRepresentativeTags(data.representativeTags),
      });
      setProfileUser((prev) => (prev ? { ...prev, ...data, id: prev.id || user.uid } : { ...data, id: user.uid }));
    });

    const savedRef = collection(db, "users", user.uid, "saved");
    const unsubscribeSaved = onSnapshot(savedRef, async () => {
      const saved = await getSavedDishesFromFirestore(user.uid);
      setSavedDishes(saved);
    });

    const toTryRef = collection(db, "users", user.uid, "toTry");
    const unsubscribeToTry = onSnapshot(toTryRef, async () => {
      const items = await getToTryDishesFromFirestore(user.uid);
      setToTryDishes(items);
    });

    const storiesRef = collection(db, "users", user.uid, "stories");
    const unsubscribeStories = onSnapshot(storiesRef, async () => {
      const stories = await getActiveStoriesForUser(user.uid);
      setActiveStories(stories);
    });

    const storyPushesRef = collection(db, "users", user.uid, "storyPushes");
    const unsubscribeStoryPushes = onSnapshot(storyPushesRef, async () => {
      const stats = await getStoryPushStatsForUser(user.uid);
      setStoryPushStats(stats);
    });

    const mealCalendarRef = collection(db, "users", user.uid, "mealCalendar");
    const unsubscribeMealCalendar = onSnapshot(mealCalendarRef, async () => {
      const entries = await getMealCalendarEntriesForUserIds([user.uid]);
      setMealCalendarEntries(entries);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSaved();
      unsubscribeToTry();
      unsubscribeStories();
      unsubscribeStoryPushes();
      unsubscribeMealCalendar();
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryDishlistId = params.get("list");
    if (!queryDishlistId) return;
    setSelectedDishMode(DISH_MODE_ALL);
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
  }, [activeDishlistId, customDishlists]);

  useEffect(() => {
    setDishlistSearchOpen(false);
    setDishlistSearch("");
  }, [activeDishlistId]);

  useEffect(() => {
    if (!createDishlistOpen || createDishlistStep !== 0) return;
    getPopularCustomDishlistNames().then(setPopularDishlistNames);
  }, [createDishlistOpen, createDishlistStep]);

  const selectDishlist = (dishlistId) => {
    if (dishlistId !== "overview") setSelectedDishMode(DISH_MODE_ALL);
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

  const getProfileAddTargetListId = () => {
    if (!activeDishlist?.id) return "to_try";
    if (activeDishlist.id === "all_dishes") return "to_try";
    return activeDishlist.id;
  };

  const handleStoryViewed = async (story) => {
    if (!user?.uid || !story?.id) return;
    await markStoryViewed(user.uid, story.id, user.uid);
  };

  const handleDeleteStory = async (story) => {
    if (!user?.uid || !story?.id) return false;
    const ok = await deleteStory(user.uid, story.id);
    if (!ok) return false;
    const nextStories = activeStories.filter((item) => item.id !== story.id);
    setActiveStories(nextStories);
    if (nextStories.length === 0) setStoriesOpen(false);
    return nextStories.length === 0;
  };

  const handleImageChange = (file) => {
    setDishImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageChange(file);
  };

  const handlePost = async () => {
    if (!dishName) {
      setToastVariant("error");
      setToast("Dish name is required");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setLoadingUpload(true);
    try {
      let imageFields = { imageURL: "", cardURL: "", thumbURL: "", mediaType: "image", mediaMimeType: "" };
      if (dishImage) {
        imageFields = await uploadDishImageVariants(dishImage, user.uid);
        if (!imageFields.imageURL) throw new Error("Failed to upload image.");
      }
      const dishId = await saveDishToFirestore({
        name: dishName,
        description: dishDescription || "",
        dishMode: DISH_MODE_COOKING,
        recipeIngredients: dishRecipeIngredients || "",
        recipeMethod: dishRecipeMethod || "",
        tags: dishTags,
        rating: 0,
        isPublic: dishIsPublic,
        ...imageFields,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        ownerPhotoURL: effectiveProfilePhotoURL || "",
        createdAt: new Date(),
      });
      clearSessionPageCache("feed:");
      clearSessionPageCache("explore:");
      clearSessionPageCache("people:");
      clearSessionPageCache("profile:");
      if (dishId) {
        await dispatchPushEvent("dish_posted", {
          ownerId: user.uid,
          dishId,
          dishName: dishName || "",
        });
      }
      setUploadedDishes((prev) =>
        mergeUniqueById([
          [
            {
              id: dishId,
              name: dishName,
              description: dishDescription || "",
              dishMode: DISH_MODE_COOKING,
              recipeIngredients: dishRecipeIngredients || "",
              recipeMethod: dishRecipeMethod || "",
              rating: 0,
              tags: dishTags,
              isPublic: dishIsPublic,
              ...imageFields,
              owner: user.uid,
              ownerName: user.displayName || "Anonymous",
              ownerPhotoURL: effectiveProfilePhotoURL || "",
              createdAt: new Date(),
            },
          ],
          prev,
        ])
      );
      setDishName("");
      setDishDescription("");
      setDishRecipeIngredients("");
      setDishRecipeMethod("");
      setDishTags([]);
      setDishIsPublic(true);
      setDishImage(null);
      setPreview(null);
      setIsModalOpen(false);
      setToastVariant("success");
      setToast("Dish uploaded");
      setTimeout(() => setToast(""), 1200);
    } catch {
      setToastVariant("error");
      setToast("Upload failed");
      setTimeout(() => setToast(""), 1400);
    }
    setLoadingUpload(false);
  };

  const handleDeleteDish = async (dish) => {
    await deleteDishAndImage(
      dish.id,
      dish.imageURL || dish.imageUrl || dish.image_url || dish.image
    );
    await removeDishFromAllUsers(dish.id);
    const refreshedUploaded = await loadOwnUploadedDishes();
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setUploadedDishes(refreshedUploaded);
    setSavedDishes(refreshedSaved);
    setToastVariant("success");
    setToast("Dish deleted");
    setTimeout(() => setToast(""), 1200);
  };

  const handleAddDishCardToStory = async (dish) => {
    if (!user?.uid || !dish?.id) return;
    const guard = dishActionPointerGuardRef.current;
    if (guard?.dishId === dish.id && Date.now() < Number(guard.until || 0)) {
      return;
    }
    const ok = await publishDishAsStory(user.uid, dish);
    if (ok) {
      getStoryPushStatsForUser(user.uid)
        .then((stats) => setStoryPushStats(stats))
        .catch((err) => console.warn("Failed to refresh story push stats:", err));
    }
    setDishCardActionTarget(null);
    setToastVariant(ok ? "success" : "error");
    setToast(ok ? "Story posted" : "Story failed");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRemoveSavedDish = async (dish) => {
    const ok = await removeSavedDishFromUser(user.uid, dish.id);
    if (!ok) return;
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setSavedDishes(refreshedSaved);
    setToastVariant("success");
    setToast("Removed from DishList");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRemoveToTryDish = async (dish) => {
    const ok = await removeDishFromToTry(user.uid, dish.id);
    if (!ok) return;
    const refreshed = await getToTryDishesFromFirestore(user.uid);
    setToTryDishes(refreshed);
    setToastVariant("success");
    setToast("Removed from To Try");
    setTimeout(() => setToast(""), 1200);
  };

  const handleEditProfile = async () => {
    if (!user?.uid || savingProfile) return;
    const cleanedName = newName.trim() || user.displayName || "Unnamed";
    const cleanedBio = newBio.trim();
    setSavingProfile(true);
    try {
      if (await isDisplayNameTaken(cleanedName, user.uid)) {
        throw new Error("That display name is already taken.");
      }
      const currentPhotoURL = profileMeta.photoURL || user?.photoURL || "";
      let nextPhotoURL = currentPhotoURL;

      if (removePhoto) {
        nextPhotoURL = "";
      }
      if (newPhotoFile) {
        nextPhotoURL = await uploadProfileImage(newPhotoFile, user.uid);
      }

      const currentAuthUser = auth.currentUser;
      if (!currentAuthUser) throw new Error("No authenticated user.");

      await updateProfile(currentAuthUser, {
        displayName: cleanedName,
        photoURL: nextPhotoURL ? nextPhotoURL : null,
      });
      await currentAuthUser.reload();

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: cleanedName,
          displayNameLower: cleanedName.toLowerCase(),
          photoURL: nextPhotoURL || "",
          bio: cleanedBio,
          email: currentAuthUser.email || user.email || "",
        },
        { merge: true }
      );

      setProfileMeta((prev) => ({
        ...prev,
        displayName: cleanedName,
        photoURL: nextPhotoURL || "",
        bio: cleanedBio,
      }));
      setNewName(cleanedName);
      setNewPhotoPreview(nextPhotoURL || "");
      setEditProfileModal(false);
      setNewPhotoFile(null);
      setRemovePhoto(false);
      setToastVariant("success");
      setToast("Profile updated");
      setTimeout(() => setToast(""), 1200);

      updateOwnerNameForDishes(user.uid, cleanedName, nextPhotoURL || "").catch((err) => {
        console.warn("Failed to update owner metadata on dishes:", err);
      });

      if ((newPhotoFile || removePhoto) && currentPhotoURL && currentPhotoURL !== nextPhotoURL) {
        deleteImageByUrl(currentPhotoURL).catch((err) => {
          console.warn("Failed to delete old profile image:", err);
        });
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setToastVariant("error");
      setToast(err?.message || "Profile update failed");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveRepresentativeTags = async () => {
    if (!user?.uid || representativeTagsSaving) return;
    const cleanedTags = normalizeRepresentativeTags(representativeTagsDraft);
    setRepresentativeTagsSaving(true);
    setProfileMeta((prev) => ({ ...prev, representativeTags: cleanedTags }));
    try {
      const targetProfileIds = Array.from(new Set([user.uid, profileDocId].filter(Boolean)));
      await Promise.all(targetProfileIds.map((targetId) => setDoc(doc(db, "users", targetId), { representativeTags: cleanedTags }, { merge: true })));
      setToastVariant("success");
      setToast("Tags saved");
      setTimeout(() => setToast(""), 1200);
    } catch (err) {
      console.error("Failed to update representative tags:", err);
      setToastVariant("error");
      setToast("Could not update tags");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setRepresentativeTagsSaving(false);
    }
  };

  const toggleRepresentativeTag = (tag) => {
    if (!TAG_OPTIONS.includes(tag)) return;
    setRepresentativeTagsDraft((prev) => {
      const cleaned = normalizeRepresentativeTags(prev);
      const active = cleaned.includes(tag);
      if (active) return cleaned.filter((item) => item !== tag);
      if (cleaned.length >= PROFILE_REPRESENTATIVE_TAG_LIMIT) return cleaned;
      return [...cleaned, tag];
    });
  };

  const loadLeaderboardAdminQuestions = async () => {
    if (leaderboardAdminPassword !== "cravy1723") {
      setToastVariant("error");
      setToast(t("Wrong password"));
      setTimeout(() => setToast(""), 1400);
      return;
    }
    const questions = await getLeaderboardQuestions(50);
    setLeaderboardAdminQuestions(questions);
  };

  useEffect(() => {
    if (!leaderboardAdminOpen || leaderboardAdminPassword !== "cravy1723") return;
    loadLeaderboardAdminQuestions();
  }, [leaderboardAdminOpen, leaderboardAdminPassword]);

  const handleCreateLeaderboardQuestion = async () => {
    const title = leaderboardQuestionTitle.trim();
    if (!user?.uid || leaderboardQuestionSaving) return;
    if (leaderboardAdminPassword !== "cravy1723") {
      setToastVariant("error");
      setToast(t("Wrong password"));
      setTimeout(() => setToast(""), 1400);
      return;
    }
    if (!title) {
      setToastVariant("error");
      setToast(t("Write a question"));
      setTimeout(() => setToast(""), 1400);
      return;
    }
    setLeaderboardQuestionSaving(true);
    try {
      const payload = {
        title,
        label: leaderboardQuestionLabel.trim() || "IN TREND",
        accent: leaderboardQuestionAccent,
        dishMode: leaderboardQuestionDishMode,
      };
      if (leaderboardQuestionEditingId) {
        const ok = await updateLeaderboardQuestion(leaderboardQuestionEditingId, user.uid, payload);
        if (!ok) throw new Error("Question was not updated.");
      } else {
        const questionId = await createLeaderboardQuestion(user.uid, payload);
        if (!questionId) throw new Error("Question was not created.");
      }
      setLeaderboardQuestionTitle("");
      setLeaderboardQuestionLabel("IN TREND");
      setLeaderboardQuestionAccent("red");
      setLeaderboardQuestionDishMode("restaurant");
      setLeaderboardQuestionEditingId("");
      await loadLeaderboardAdminQuestions();
      setToastVariant("success");
      setToast(t(leaderboardQuestionEditingId ? "Leaderboard question updated" : "Leaderboard question published"));
      setTimeout(() => setToast(""), 1300);
    } catch (error) {
      console.error("Failed to create leaderboard question:", error);
      setToastVariant("error");
      setToast(t("Could not publish question"));
      setTimeout(() => setToast(""), 1500);
    } finally {
      setLeaderboardQuestionSaving(false);
    }
  };

  const handleDeleteLeaderboardQuestion = async (questionId) => {
    if (!user?.uid || !questionId || leaderboardAdminPassword !== "cravy1723") return;
    const ok = await deleteLeaderboardQuestion(questionId, user.uid);
    if (ok) {
      if (leaderboardQuestionEditingId === questionId) {
        setLeaderboardQuestionEditingId("");
        setLeaderboardQuestionTitle("");
        setLeaderboardQuestionLabel("IN TREND");
        setLeaderboardQuestionAccent("red");
        setLeaderboardQuestionDishMode("restaurant");
      }
      await loadLeaderboardAdminQuestions();
      setToastVariant("success");
      setToast(t("Question deleted"));
      setTimeout(() => setToast(""), 1300);
    } else {
      setToastVariant("error");
      setToast(t("Could not delete question"));
      setTimeout(() => setToast(""), 1500);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid || deletingAccount) return;
    setDeleteAccountError("");
    setDeletingAccount(true);
    try {
      await deleteAccount({ password: deletePassword });
      setDeleteAccountModal(false);
      alert("Your account has been deleted.");
      router.replace("/");
    } catch (err) {
      console.error("Failed to delete account:", err);
      setDeleteAccountError(err?.message || "Could not delete account. Please sign in again and retry.");
    } finally {
      setDeletingAccount(false);
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
      alert("No dishes to shuffle.");
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
      router.push(`/dish/${randomDish.id}?source=dishlist&listId=${customDishlist.id}&mode=shuffle&returnTo=${returnTo}&deckIds=${encodedDeckIds}`);
      return;
    }
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle&returnTo=${returnTo}&deckIds=${encodedDeckIds}`);
  };

  const removeDishFromProfileOnly = async (dish) => {
    const customMemberships = customDishlists.filter((dishlist) =>
      (dishlist.dishes || []).some((item) => item.id === dish.id)
    );
    await Promise.all(customMemberships.map((dishlist) => removeDishFromCustomDishlist(user.uid, dishlist.id, dish.id)));
    const savedMembership = savedDishes.some((item) => item.id === dish.id);
    const toTryMembership = toTryDishes.some((item) => item.id === dish.id);
    if (savedMembership) await removeSavedDishFromUser(user.uid, dish.id);
    if (toTryMembership) await removeDishFromToTry(user.uid, dish.id);
    if (dish.owner === user.uid) {
      await deleteDishAndImage(
        dish.id,
        dish.imageURL || dish.imageUrl || dish.image_url || dish.image
      );
      await removeDishFromAllUsers(dish.id);
    }
    const [refreshedUploaded, refreshedSaved, refreshedToTry] = await Promise.all([
      loadOwnUploadedDishes(),
      getSavedDishesFromFirestore(user.uid),
      getToTryDishesFromFirestore(user.uid),
    ]);
    setUploadedDishes(refreshedUploaded);
    setSavedDishes(refreshedSaved);
    setToTryDishes(refreshedToTry);
    await refreshCustomDishlists(user.uid);
  };

  const handleDishPreviewRemove = (dish, source) => {
    setRemovePreviewTarget({ dish, source });
  };

  const handleOpenDishlistPicker = async (dish) => {
    if (!user?.uid || !dish?.id) return;
    setDishlistPickerDish(dish);
    setDishlistPickerOpen(true);
    setDishlistPickerLoading(true);
    try {
      const lists = (await getAllDishlistsForUser(user.uid)).filter(
        (dishlist) => dishlist.id !== "all_dishes" && dishlist.id !== "uploaded"
      );
      const memberships = lists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dish.id))
        .map((dishlist) => dishlist.id);
      setDishlistPickerLists(lists);
      setDishlistPickerSelectedIds(memberships);
    } finally {
      setDishlistPickerLoading(false);
    }
  };

  const handleConfirmDishlistPicker = async () => {
    if (!user?.uid || !dishlistPickerDish?.id) return;
    const selectedSet = new Set(dishlistPickerSelectedIds);
    const persistDishlistIds = dishlistPickerSelectedIds.filter(
      (dishlistId) => !(dishlistId === "to_try" && selectedSet.has("saved"))
    );
    const currentIds = new Set(
      dishlistPickerLists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dishlistPickerDish.id))
        .map((dishlist) => dishlist.id)
    );
    const nextIds = new Set(persistDishlistIds);
    const addResults = await Promise.all(
      persistDishlistIds.map((dishlistId) =>
        saveDishToSelectedDishlist(user.uid, dishlistId, dishlistPickerDish)
      )
    );
    const removeResults = await Promise.all(
      Array.from(currentIds)
        .filter((dishlistId) => !nextIds.has(dishlistId))
        .map((dishlistId) => {
          if (dishlistId === "saved") return removeSavedDishFromUser(user.uid, dishlistPickerDish.id);
          if (dishlistId === "to_try") return removeDishFromToTry(user.uid, dishlistPickerDish.id);
          return removeDishFromCustomDishlist(user.uid, dishlistId, dishlistPickerDish.id);
        })
    );
    const ok = addResults.every(Boolean) && removeResults.every(Boolean);
    setToast(ok ? "Added to DishList" : "Save failed");
    setTimeout(() => setToast(""), 1200);
    if (ok) {
      setDishlistPickerOpen(false);
      setDishlistPickerDish(null);
      setDishlistPickerLists([]);
      setDishlistPickerSelectedIds([]);
      const [saved, toTry, custom] = await Promise.all([
        getSavedDishesFromFirestore(user.uid),
        getToTryDishesFromFirestore(user.uid),
        getCustomDishlistsForUser(user.uid),
      ]);
      setSavedDishes(saved);
      setToTryDishes(toTry);
      setCustomDishlists(custom);
    }
  };

  const confirmDishPreviewRemove = async (scope) => {
    const target = removePreviewTarget;
    if (!target?.dish) return;
    const { dish, source } = target;
    if (scope === "profile") {
      await removeDishFromProfileOnly(dish);
      setToastVariant("success");
      setToast("Removed from profile");
      setTimeout(() => setToast(""), 1200);
      setRemovePreviewTarget(null);
      return;
    }
    if (source === "saved") {
      await handleRemoveSavedDish(dish);
      setRemovePreviewTarget(null);
      return;
    }
    if (source === "uploaded") {
      await handleDeleteDish(dish);
      setRemovePreviewTarget(null);
      return;
    }
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    if (customDishlist) {
      const ok = await removeDishFromCustomDishlist(user.uid, customDishlist.id, dish.id);
      if (ok) {
        await refreshCustomDishlists(user.uid);
        setToastVariant("success");
        setToast("Removed from dishlist");
        setTimeout(() => setToast(""), 1200);
      }
      setRemovePreviewTarget(null);
      return;
    }
    const allDishesMembership = [
      savedDishes.some((item) => item.id === dish.id) ? "saved" : null,
      ...customDishlists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dish.id))
        .map((dishlist) => dishlist.id),
      dish.owner === user.uid ? "uploaded" : null,
    ].filter(Boolean);
    const firstMembership = allDishesMembership[0];
    if (firstMembership === "saved") {
      await handleRemoveSavedDish(dish);
    } else if (firstMembership === "uploaded") {
      await handleDeleteDish(dish);
    } else if (firstMembership) {
      const ok = await removeDishFromCustomDishlist(user.uid, firstMembership, dish.id);
      if (ok) {
        await refreshCustomDishlists(user.uid);
        setToastVariant("success");
        setToast("Removed from dishlist");
        setTimeout(() => setToast(""), 1200);
      }
    }
    setRemovePreviewTarget(null);
  };

  const openConnections = async (type) => {
    if (!user) return;
    const rawIds = type === "followers" ? profileMeta.followers || [] : profileMeta.following || [];
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
      [...uploadedDishes, ...savedDishes, ...toTryDishes, ...customDishlists.flatMap((dishlist) => dishlist.dishes || [])]
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
    { id: "saved", name: "Your Classics", type: "system", dishes: savedDishes, count: savedDishes.length },
    { id: "to_try", name: "To Try", type: "system", dishes: toTryCollection, count: toTryCollection.length },
    { id: "uploaded", name: "Uploaded", type: "system", dishes: uploadedDishes, count: uploadedDishes.length },
    {
      id: "all_dishes",
      name: "All dishes",
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
  const profileRepresentativeTags =
    profileMeta.representativeTags === null
      ? []
      : resolveRepresentativeTags(profileMeta.representativeTags, allDishesForRepresentativeTags);

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
  const getVisibleDishlistDishes = (dishlist) => {
    const sourceDishes = Array.isArray(dishlist?.dishes) ? dishlist.dishes : [];
    const filteredDishes = sourceDishes.filter((dish) => dishModeMatches(dish, selectedDishMode));
    return orderDishesForProfileList(filteredDishes);
  };
  const getDishlistPreviewDishes = (dishlist) => sortDishlistDishes(dishlist?.dishes || [], dishlist?.id || "").slice(0, 4);
  const unfilteredActiveDishlist =
    showingDishlistOverview ? null : allDishlists.find((dishlist) => dishlist.id === activeDishlistId) || allDishlists[0] || null;
  const activeDishlist = unfilteredActiveDishlist
    ? {
        ...unfilteredActiveDishlist,
        dishes: getVisibleDishlistDishes(unfilteredActiveDishlist),
      }
    : null;
  const visibleLeaderboardTakes = (Array.isArray(leaderboardTakes) ? leaderboardTakes : []).filter((take) => {
    if (selectedDishMode === DISH_MODE_ALL) return true;
    const mode = take?.questionDishMode === "home" ? DISH_MODE_COOKING : DISH_MODE_RESTAURANT;
    return mode === selectedDishMode;
  });
  const searchedActiveDishlistDishes = activeDishlist?.dishes?.filter(dishMatchesSearch) || [];
  const allDishesCount = allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.count || 0;
  const profileCounts = useMemo(
    () => ({
      followers: profileMeta.followers?.length || 0,
      following: profileMeta.following?.length || 0,
      uploaded: uploadedDishes.length,
      dishes: allDishesCount,
    }),
    [allDishesCount, profileMeta.followers, profileMeta.following, uploadedDishes.length]
  );
  
  const uploadedRestaurantGroups = useMemo(
    () => getRestaurantDishGroups(uploadedDishes),
    [uploadedDishes]
  );

  const storyCalendarDays = useMemo(() => {
    const dishById = new Map();
    allDishlists.forEach((dishlist) => {
      (dishlist.dishes || []).forEach((dish) => {
        if (dish?.id && !dishById.has(dish.id)) dishById.set(dish.id, dish);
      });
    });
    uploadedDishes.forEach((dish) => {
      if (dish?.id && !dishById.has(dish.id)) dishById.set(dish.id, dish);
    });

    const entries = [];
    Object.entries(storyPushStats || {}).forEach(([dishId, stats]) => {
      const dish = dishById.get(dishId) || { id: dishId };
      (stats?.history || []).forEach((entry, index) => {
        const ms = getStoryCalendarMillis(entry?.pushedAtMs || entry?.pushedAtISO);
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
      const ms = getStoryCalendarMillis(story.createdAt) || getStoryCalendarMillis(story.pushedAtMs);
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

    mealCalendarEntries.forEach((entry) => {
      const ms = Number(entry.ms || entry.ateAtMs || 0) || getStoryCalendarMillis(entry.createdAt) || Date.now();
      const dayKey = entry.dayKey || getStoryCalendarKey(ms);
      if (!dayKey) return;
      entries.push({
        id: `manual-${entry.id || `${dayKey}-${entry.name}`}`,
        dayKey,
        ms,
        dishId: "",
        name: entry.name || "Untitled",
        imageDish: null,
        calendarOnly: true,
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
  }, [activeStories, allDishlists, mealCalendarEntries, storyPushStats, uploadedDishes]);

  const storyCalendarByDay = useMemo(
    () => new Map(storyCalendarDays.map((day) => [day.key, day.items])),
    [storyCalendarDays]
  );
  const profileCalendarCells = useMemo(
    () => getCalendarTimelineCells(storyCalendarDays, profileCalendarSelectedDay),
    [profileCalendarSelectedDay, storyCalendarDays]
  );
  const updateProfileCalendarVisibleMonth = () => {
    const rail = profileCalendarRailRef.current;
    if (!rail) return;
    const railRect = rail.getBoundingClientRect();
    const railCenter = railRect.left + railRect.width / 2;
    let closestDay = "";
    let closestDistance = Infinity;
    Array.from(rail.querySelectorAll("[data-calendar-day]")).forEach((node) => {
      const rect = node.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - railCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestDay = node.getAttribute("data-calendar-day") || "";
      }
    });
    if (closestDay) setProfileCalendarVisibleDay(closestDay);
  };
  useEffect(() => {
    if (!profileCalendarOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const rail = profileCalendarRailRef.current;
      const todayButton = rail?.querySelector(`[data-calendar-day="${getStoryCalendarKey(Date.now())}"]`);
      if (todayButton) {
        todayButton.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
        setProfileCalendarVisibleDay(getStoryCalendarKey(Date.now()));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [profileCalendarOpen, profileCalendarCells.length]);
  const profileCalendarSelectedDate = useMemo(
    () => new Date(`${profileCalendarSelectedDay}T12:00:00`),
    [profileCalendarSelectedDay]
  );
  const profileCalendarVisibleDate = useMemo(
    () => new Date(`${profileCalendarVisibleDay || profileCalendarSelectedDay}T12:00:00`),
    [profileCalendarSelectedDay, profileCalendarVisibleDay]
  );
  const profileCalendarMonthLabel = useMemo(
    () =>
      profileCalendarVisibleDate.toLocaleDateString(language === LANGUAGE_IT ? "it-IT" : "en-US", {
        month: "long",
        year: "numeric",
      }),
    [language, profileCalendarVisibleDate]
  );
  const profileCalendarSelectedItems = storyCalendarByDay.get(profileCalendarSelectedDay) || [];
  const calendarDaysWithEntries = storyCalendarDays.length;
  const profileCalendarMonthCells = useMemo(
    () => getCalendarMonthPreviewCells(profileCalendarMonthDate),
    [profileCalendarMonthDate]
  );
  const profileCalendarMonthOptions = useMemo(
    () => getCalendarMonthOptions(profileCalendarMonthDate, language),
    [language, profileCalendarMonthDate]
  );
  const changeProfileCalendarMonth = (delta) => {
    setProfileCalendarMonthDate((prev) => addCalendarMonths(prev, delta));
  };
  const selectProfileCalendarDay = (dayKey) => {
    setProfileCalendarSelectedDay(dayKey);
    setProfileCalendarVisibleDay(dayKey);
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
  const calendarPreviewCells = useMemo(() => {
    return getCalendarMonthPreviewCells(new Date());
  }, []);

  const selectedCreateDishes = Array.from(
    new Map(
      allDishlists
        .flatMap((dishlist) => dishlist.dishes || [])
        .filter((dish) => selectedDishIds.includes(dish.id))
        .map((dish) => [dish.id, dish])
  ).values()
  );
  const createSourceDishlist =
    allDishlists.find((dishlist) => dishlist.id === createSourceDishlistId) || allDishlists[0] || null;
  const createDishSearchTerm = createDishSearch.trim().toLowerCase();
  const createDishSearchPool =
    allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
  const visibleCreateDishes = createDishSearchTerm
    ? createDishSearchPool.filter((dish) => (dish?.name || "").toLowerCase().includes(createDishSearchTerm))
    : createSourceDishlist?.dishes || [];

  const toggleDishSelection = (dish) => {
    if (!dish?.id) return;
    setSelectedDishIds((prev) =>
      prev.includes(dish.id) ? prev.filter((id) => id !== dish.id) : [...prev, dish.id]
    );
  };

  const handleOpenCreateDishlist = () => {
    setDishlistsOpen(false);
    setDishlistsEditMode(false);
    setCreateDishlistStep(0);
    setNewDishlistName("");
    setSelectedDishIds([]);
    setCreateSourceDishlistId(allDishlists[0]?.id || "all_dishes");
    setCreateDishSearch("");
    setCreateDishlistOpen(true);
  };

  const getRemovalTargetMeta = (source) => {
    if (source === "saved") {
      return {
        label: "Your Classics",
        description: "Remove it from Your Classics only",
        buttonClass: "border-[#D8C66A] bg-[#FFFBE7]",
        iconClass: "border-[#D0B74A] bg-[#D0B74A] text-white",
      };
    }
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    if (customDishlist) {
      return {
        label: customDishlist.name || "Dishlist",
        description: `Remove it from ${customDishlist.name || "this dishlist"} only`,
        buttonClass: "border-[#8FD7AE] bg-[#F3FFF7]",
        iconClass: "border-[#2F9B5F] bg-[#2F9B5F] text-white",
      };
    }
    return null;
  };

  const handleCreateDishlist = async () => {
    if (!user?.uid || creatingDishlist) return;
    if (!newDishlistName.trim()) return;
    setCreatingDishlist(true);
    try {
      const dishlistId = await createCustomDishlist(user.uid, newDishlistName, selectedCreateDishes);
      await refreshCustomDishlists(user.uid);
      if (dishlistId) {
        selectDishlist(dishlistId);
      }
      setCreateDishlistOpen(false);
      setToastVariant("success");
      setToast("Dishlist created");
      setTimeout(() => setToast(""), 1200);
    } catch (err) {
      console.error("Failed to create dishlist:", err);
      setToastVariant("error");
      setToast("Dishlist creation failed");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setCreatingDishlist(false);
    }
  };

  const handleDeleteDishlist = async () => {
    if (!user?.uid || !dishlistDeleteTarget?.id) return;
    const deleted = await deleteCustomDishlist(user.uid, dishlistDeleteTarget.id);
    if (!deleted) {
      setToastVariant("error");
      setToast("Dishlist deletion failed");
      setTimeout(() => setToast(""), 1400);
      return;
    }
    await refreshCustomDishlists(user.uid);
    if (activeDishlistId === dishlistDeleteTarget.id) {
      selectDishlist("overview");
    }
    setDishlistDeleteTarget(null);
    setDishlistsEditMode(false);
    setToastVariant("success");
    setToast("Dishlist deleted");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRenameDishlist = async () => {
    if (!user?.uid || !dishlistRenameTarget?.id || !dishlistRenameValue.trim()) return;
    const renamed = await updateCustomDishlistName(user.uid, dishlistRenameTarget.id, dishlistRenameValue);
    if (!renamed) {
      setToastVariant("error");
      setToast("Dishlist rename failed");
      setTimeout(() => setToast(""), 1400);
      return;
    }
    await refreshCustomDishlists(user.uid);
    setDishlistRenameTarget(null);
    setDishlistRenameValue("");
    setToastVariant("success");
    setToast("Dishlist renamed");
    setTimeout(() => setToast(""), 1200);
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


  if (loading) {
    return <FullScreenLoading title="Loading profile" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Redirecting to login...
      </div>
    );
  }

  const DishGrid = ({ title, dishes, allowDelete, source, showHeader = true, onRemovePreview, emptyText }) => (
    <>
      {showHeader && title ? (
        <div className="mt-4 mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={() => openShuffleDeck(source)}
            className="profile-shuffle-btn inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
            disabled={dishes.length === 0}
          >
            <Shuffle size={14} />
            Shuffle
          </button>
        </div>
      ) : null}
	      <div className="grid grid-cols-2 gap-3">
	        {dishes.length === 0 ? (
	          <div className={`col-span-2 h-32 flex items-center justify-center ${darkMode ? "text-white/72" : "rounded-xl bg-[#f0f0ea] text-gray-500"}`}>
	            {emptyText || t("No dishes here.")}
	          </div>
	        ) : (
          <AnimatePresence initial={false}>
            {dishes.map((dish, index) => {
              const textOnly = isTextOnlyDish(dish);
              const canEditTextOnly = profileIdCandidates.includes(dish?.owner);
              if (textOnly) {
                return (
                  <motion.div
                    key={`${dish.id}-${index}`}
                    className={`pressable-card relative overflow-hidden rounded-[1.15rem] border-2 px-3 py-3 shadow-md ${
                      String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"
                    } ${darkMode ? "bg-[#171717] text-white" : "bg-white text-black"}`}
                  >
                    <div className="truncate text-[15px] font-bold leading-tight">{dish.name || "Untitled dish"}</div>
                    {canEditTextOnly ? (
                      <button
                        type="button"
                        onClick={() => {
                          const returnParam = encodeURIComponent(buildProfileReturnTo());
                          router.push(`/dish/${dish.id}?source=uploaded&mode=single&edit=1&returnTo=${returnParam}`);
                        }}
                        className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                          darkMode ? "border-white/12 bg-white/8 text-white" : "border-black/10 bg-black/5 text-black"
                        }`}
                      >
                        {t("Edit dish")}
                      </button>
                    ) : null}
                  </motion.div>
                );
              }
              return (
              <motion.div
                key={`${dish.id}-${index}`}
                className={`pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative group border-2 ${String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"}`}
              >
                <Link
                  href={(() => {
                    const deckParam = encodeURIComponent(dishes.map((item) => item.id).filter(Boolean).join(","));
                    const returnParam = encodeURIComponent(buildProfileReturnTo());
                    return source === "dishlist" || activeDishlist?.type === "custom"
                      ? `/dish/${dish.id}?source=dishlist&listId=${activeDishlist?.id}&mode=single&returnTo=${returnParam}&deckIds=${deckParam}`
                      : `/dish/${dish.id}?source=${source}&mode=single&returnTo=${returnParam}&deckIds=${deckParam}`;
                  })()}
                  className="absolute inset-0 z-10"
                >
                  <span className="sr-only">Open dish</span>
                </Link>
                <DishRatingBadge dish={dish} />
                {(() => {
                  const imageSrc = getDishImageUrl(dish, "thumb");
                  return (
                    <img
                      src={imageSrc}
                      alt={dish.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_DISH_IMAGE;
                      }}
                    />
                  );
                })()}
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5 text-white pointer-events-none flex flex-col justify-end gap-1">
                  <div className="text-[17px] font-bold leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                    {dish.name || "Untitled dish"}
                  </div>
                  {renderDishCounters(dish)}
                </div>
                {(allowDelete || onRemovePreview || profileIdCandidates.includes(dish?.owner)) && (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dishActionPointerGuardRef.current = { dishId: dish?.id || "", until: Date.now() + 450 };
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dishActionPointerGuardRef.current = { dishId: dish?.id || "", until: Date.now() + 450 };
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDishCardActionTarget({
                        dish,
                        allowDelete,
                        onRemovePreview,
                        source,
                        listId: activeDishlist?.type === "custom" ? activeDishlist.id : activeDishlist?.id,
                      });
                    }}
                    className={`absolute top-2 right-2 z-30 flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition ${
                      darkMode ? "border-white/12 bg-black/70 text-white" : "border-black/8 bg-white/92 text-black"
                    }`}
                    aria-label="Dish actions"
                  >
                    <MoreHorizontal size={18} strokeWidth={2.4} />
                  </button>
                )}
              </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </>
  );

  const toggleTag = (tag) => {
    setDishTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 6) return prev;
      return [...prev, tag];
    });
  };

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 mb-1 grid grid-cols-[104px_1fr_104px] items-center px-4 pb-1.5 relative">
        <div className="flex min-w-[104px] items-center justify-start" />
        <div className="flex items-center justify-center" />
        <div ref={profileOptionsRef} className="relative z-20 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              router.push("/directs");
            }}
            className="top-action-btn relative"
            aria-label={t("Directs")}
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </button>
          <button
            type="button"
            onClick={() => setProfileOptionsOpen(true)}
            className="top-action-btn"
            aria-label={t("Profile options")}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
      <div className="mb-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (hasStories) setStoriesOpen(true);
              }}
              className={`no-accent-border h-20 w-20 rounded-full p-[4px] ${hasStories ? "bg-[#2BD36B]" : "bg-transparent"}`}
              aria-label="Open your stories"
            >
              <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[3px]">
                <div
                  className="no-accent-border w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden"
                  style={effectiveProfilePhotoURL ? undefined : { backgroundColor: avatarTone.bg }}
                >
                  {effectiveProfilePhotoURL ? (
                    <img
                      src={effectiveProfilePhotoURL}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span style={{ color: avatarTone.text }}>{effectiveDisplayName?.[0] || "U"}</span>
                  )}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStoryActionOpen(true)}
              className="no-accent-border absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-black text-white border-2 border-[#F6F6F2] flex items-center justify-center shadow-md"
              aria-label="Add story"
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="flex-1 min-h-20 flex flex-col justify-start py-0.5">
            <div className="ml-2">
              <h1 className="text-[1.8rem] leading-none font-bold tracking-tight">{effectiveDisplayName || t("My Profile")}</h1>
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
                <div key={`followers-${profileCounts.followers}`} data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileCounts.followers) || 0)}</div>
                <button
                  onClick={() => openConnections("followers")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Followers")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div key={`following-${profileCounts.following}`} data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileCounts.following) || 0)}</div>
                <button
                  onClick={() => openConnections("following")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Following")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div key={`uploaded-${profileCounts.uploaded}`} data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileCounts.uploaded) || 0)}</div>
                <button
                  onClick={() => selectDishlist("uploaded")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Uploaded")}
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div key={`dishes-${profileCounts.dishes}`} data-no-translate="true" className="text-[1.28rem] font-bold leading-none">{Math.max(0, Number(profileCounts.dishes) || 0)}</div>
                <button
                  onClick={() => selectDishlist("all_dishes")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  {t("Dishes")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {profileMeta.bio ? (
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/68 whitespace-pre-wrap">{profileMeta.bio}</p>
        ) : null}
      </div>

      {!profileContentReady ? (
        <div className="mx-auto w-full max-w-3xl px-2 pb-4">
          <div className={`mb-4 h-20 animate-pulse rounded-[1.35rem] ${darkMode ? "bg-white/8" : "bg-black/6"}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className={`min-h-[11.4rem] animate-pulse rounded-[1.5rem] border ${
                  darkMode ? "border-white/8 bg-white/6" : "border-black/8 bg-black/5"
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {showingDishlistOverview ? (
            <div className="mx-auto mb-4 grid w-full max-w-3xl grid-cols-2 gap-3 px-2">
              <div>
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
              <div>
                <div className="mb-2 flex items-center gap-2 leading-none">
                  <span className={`truncate text-[1.02rem] font-bold ${darkMode ? "text-white" : "text-black"}`}>{t("Calendar")}</span>
                  <CalendarDays className={`h-[1.05rem] w-[1.05rem] shrink-0 ${darkMode ? "text-white/72" : "text-black/72"}`} strokeWidth={2.05} />
                </div>
                <button
                  type="button"
                  onClick={() => setProfileCalendarOpen(true)}
                  className={`relative block h-[7.25rem] w-full overflow-hidden rounded-[1.35rem] border text-left shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition active:scale-[0.98] ${
                    darkMode ? "border-white/10 bg-[#181818]" : "border-black/10 bg-[#FBFAF6]"
                  }`}
                  aria-label="Open calendar"
                >
                  <div className="relative flex h-full flex-col">
                    <div className="relative h-6 border-b border-[#C78400]/35 bg-[#F0A623]">
                      <div className="absolute left-0 right-0 top-1/2 flex -translate-y-1/2 justify-center gap-8">
                        {[0, 1].map((item) => (
                          <span
                            key={item}
                            className={`h-3 w-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.24)] ${
                              darkMode ? "bg-[#181818]" : "bg-[#FBFAF6]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-7 gap-1.5 p-3">
                      {calendarPreviewCells.slice(0, 28).map((cell) => {
                        const hasItems = Boolean(storyCalendarByDay.get(cell.dayKey)?.length);
                        return (
                          <div
                            key={cell.dayKey}
                            className={`relative rounded-[0.32rem] ${
                              cell.isToday
                                ? "border border-[#F0A623] bg-transparent"
                                : darkMode ? "bg-white/12" : "bg-black/8"
                            }`}
                          >
                            {hasItems ? <span className="absolute bottom-1 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#F0A623]" /> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          {showingDishlistOverview ? (
            <ProfileTakesStrip takes={visibleLeaderboardTakes} darkMode={darkMode} t={t} />
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
                <button
                  type="button"
                  onClick={handleOpenCreateDishlist}
                  className={`min-h-[11.4rem] rounded-[1.5rem] border-2 border-dashed border-[#45C47A]/55 p-3 text-left ${
                    darkMode ? "bg-[#12351F]" : "bg-[#F3FFF7]"
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#63D892]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1FA463] text-white">
                      <Plus size={22} />
                    </div>
                    <div className="text-sm font-semibold">{t("Create dishlist")}</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div
              onPointerDown={handleDishlistDetailPointerDown}
              onPointerUp={handleDishlistDetailPointerUp}
              onPointerCancel={() => {
                dishlistDetailSwipeRef.current = null;
              }}
            >
              <div
                className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2"
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
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <DishModeFilterButton value={selectedDishMode} onSelect={handleDishModeSelect} />
                </div>
	                <div className="flex justify-end">
	                  {activeDishlist?.type === "custom" ? (
	                    <button
                      type="button"
                      onClick={() => {
                        setDishlistRenameTarget(activeDishlist);
                        setDishlistRenameValue(activeDishlist.name || "");
                      }}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${
                        darkMode ? "border-white/14 bg-[#161616] text-white" : "border-black/12 bg-white text-black"
                      }`}
                      aria-label="Edit dishlist"
                    >
                      <Pencil size={16} />
	                    </button>
	                  ) : (
	                    null
	                  )}
                    <button
                      type="button"
                      onClick={() => {
                        setDishlistSearchOpen((open) => !open);
                        if (dishlistSearchOpen) setDishlistSearch("");
                      }}
                      className={`ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full border ${
                        darkMode ? "border-white/14 bg-[#161616] text-white" : "border-black/12 bg-white text-black"
                      }`}
                      aria-label={t("Search dishes")}
                    >
                      {dishlistSearchOpen ? <X size={16} /> : <Search size={16} />}
                    </button>
	                </div>
	              </div>
                {dishlistSearchOpen ? (
                  <div
                    className="mb-3 px-2"
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
	              <DishGrid
                title={
                  <span className="inline-flex items-center gap-2">
                    {activeDishlist?.name || "All dishes"}
                    <SystemDishlistIcon id={activeDishlist?.id} className="h-5 w-5" />
                  </span>
                }
	                dishes={searchedActiveDishlistDishes}
	                allowDelete={false}
	                source={activeDishlist?.id || "all_dishes"}
	                onRemovePreview={(dish) => handleDishPreviewRemove(dish, activeDishlist?.type === "custom" ? activeDishlist.id : activeDishlist?.id)}
	                emptyText={dishlistSearchTerm ? t("No matching dishes.") : t("No dishes here.")}
	              />
            </div>
          )}
        </>
      )}

      {/* Add Dish button */}
      <motion.button
        onClick={() => router.push(`/upload?targetList=${encodeURIComponent(getProfileAddTargetListId())}`)}
        className="bottom-nav-floating-action add-action-btn fixed right-6 w-16 h-16 text-[40px] z-50"
        disabled={loadingUpload}
        aria-label="Add dish"
      >
        <Plus size={26} strokeWidth={2.1} />
      </motion.button>

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 my-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <h2 className="text-2xl font-semibold mb-4 text-black">Add New Dish</h2>
              <input
                type="text"
                placeholder="Dish name"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                className="w-full p-3 rounded-full bg-[#F6F6F2] text-black mb-3 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                disabled={loadingUpload}
              />
              <textarea
                placeholder="Description"
                value={dishDescription}
                onChange={(e) => setDishDescription(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={3}
                disabled={loadingUpload}
              />
              <IngredientBulletTextarea
                placeholder="Recipe ingredients"
                value={dishRecipeIngredients}
                onChange={setDishRecipeIngredients}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-3 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={3}
                disabled={loadingUpload}
              />
              <textarea
                placeholder="Recipe method"
                value={dishRecipeMethod}
                onChange={(e) => setDishRecipeMethod(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={4}
                disabled={loadingUpload}
              />
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-black">Tags</p>
                  <p className="text-xs text-black/60">{dishTags.length}/6</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => {
                    const active = dishTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs border transition ${getTagChipClass(tag, active)}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDishIsPublic((value) => !value)}
                disabled={loadingUpload}
                className={`dish-public-toggle ${dishIsPublic ? "dish-public-toggle--active" : ""} mb-4 flex w-full items-center justify-between gap-4 px-4 py-3 text-left`}
                aria-pressed={dishIsPublic}
              >
                <span>
                  <span className={`block text-sm font-black ${darkMode ? "text-white" : "text-black"}`}>{t("Public dish")}</span>
                  <span className={`mt-0.5 block text-xs font-semibold ${darkMode ? "text-white/58" : "text-black/54"}`}>
                    {dishIsPublic ? t("Visible in feed") : t("Hidden from feed")}
                  </span>
                </span>
                <span className="dish-public-toggle__switch no-accent-border shrink-0">
                  <span className="dish-public-toggle__knob no-accent-border" />
                </span>
              </button>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`w-full h-40 rounded-2xl border-2 border-dashed ${
                  dragActive ? "border-black bg-[#F6F6F2]" : "border-black/20"
                } flex items-center justify-center text-black/50 mb-4 cursor-pointer relative`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files[0])}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                  disabled={loadingUpload}
                />
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : loadingUpload ? (
                  "Uploading..."
                ) : (
                  "Drag & Drop or Click to Upload"
                )}
              </div>
              <div className="mb-4 rounded-2xl border border-black/10 bg-[#F6F6F2] p-3">
                <p className="text-sm text-black/70 mb-2">
                  If you don&apos;t have an image, search if the dish is already posted.
                </p>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push("/dishes");
                  }}
                  className="w-full bg-white border border-black/20 py-2 rounded-full text-sm font-semibold hover:bg-black/5 transition"
                  disabled={loadingUpload}
                >
                  Search Existing Dishes
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePost}
                className="w-full bg-black text-white py-3 rounded-full font-semibold hover:opacity-90 transition"
                disabled={loadingUpload}
              >
                {loadingUpload ? "Uploading..." : "Post Dish"}
              </motion.button>
              <button
                onClick={() => {
                  if (!loadingUpload) setIsModalOpen(false);
                }}
                className="mt-3 w-full bg-white border border-black/20 py-2 rounded-full hover:bg-black/5 transition text-black"
                disabled={loadingUpload}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {profileOptionsOpen && (
          <motion.div
            className={`fixed inset-0 z-[95] flex flex-col ${
              darkMode ? "bg-[#050505] text-white" : "bg-[#F8F6F0] text-black"
            }`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="app-top-nav flex items-center justify-between px-5 pb-3">
              <button
                type="button"
                onClick={() => setProfileOptionsOpen(false)}
                className={`no-accent-border flex h-11 w-11 items-center justify-center rounded-full ${
                  darkMode ? "bg-white/8 text-white" : "bg-white text-black"
                } shadow-[0_10px_28px_rgba(0,0,0,0.12)]`}
                aria-label="Close settings"
              >
                <X size={19} />
              </button>
              <h2 className="text-[1.45rem] font-semibold leading-none">{t("Settings")}</h2>
              <div className="h-11 w-11" />
            </div>
            <div className="bottom-nav-spacer flex-1 overflow-y-auto px-5 pb-8 pt-2">
              <button
                type="button"
                onClick={() => {
                  setProfileOptionsOpen(false);
                  setEditProfileModal(true);
                }}
                className={`no-accent-border mb-5 flex w-full items-center gap-4 rounded-[1.6rem] p-4 text-left ${
                  darkMode ? "bg-[#141414]" : "bg-white"
                } shadow-[0_14px_34px_rgba(0,0,0,0.10)]`}
              >
                <div className="h-16 w-16 overflow-hidden rounded-full bg-black/10">
                  {effectiveProfilePhotoURL ? (
                    <img src={effectiveProfilePhotoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                      {(user?.displayName?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1.05rem] font-semibold">{user?.displayName || "User"}</div>
                  <div className={`mt-1 text-sm ${darkMode ? "text-white/55" : "text-black/52"}`}>{t("Edit Profile")}</div>
                </div>
                <Pencil size={17} className={darkMode ? "text-white/55" : "text-black/45"} />
              </button>

              <section className="mb-5">
                <div className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "text-white/45" : "text-black/40"
                }`}>
                  {t("Language")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { code: LANGUAGE_EN, flag: "🇬🇧", label: t("English") },
                    { code: LANGUAGE_IT, flag: "🇮🇹", label: t("Italian") },
                  ].map((item) => {
                    const active = language === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setLanguage(item.code)}
                        className={`no-accent-border flex items-center gap-3 rounded-[1.45rem] p-4 text-left transition ${
                          active
                            ? darkMode
                              ? "bg-[#27200F] text-white ring-2 ring-[#FFC247]"
                              : "bg-[#FFF3C7] text-black ring-2 ring-[#D7A51E]"
                            : darkMode
                              ? "bg-[#141414] text-white/62"
                              : "bg-white text-black/62"
                        }`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-[1.45rem]">{item.flag}</span>
                        <span className="font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mb-5">
                <div className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "text-white/45" : "text-black/40"
                }`}>
                  {t("Appearance")}
                </div>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`no-accent-border flex w-full items-center justify-between rounded-[1.45rem] p-4 text-left ${
                    darkMode ? "bg-[#141414] text-white" : "bg-white text-black"
                  }`}
                >
                  <div>
                    <div className="font-semibold">{t("Dark mode")}</div>
                    <div className={`mt-1 text-sm ${darkMode ? "text-white/52" : "text-black/50"}`}>
                      {darkMode ? t("Dark mode") : t("Light mode")}
                    </div>
                  </div>
                  <span className={`no-accent-border flex h-8 w-14 items-center rounded-full p-1 transition ${
                    darkMode ? "bg-[#FFC247]" : "bg-black/14"
                  }`}>
                    <span className={`no-accent-border h-6 w-6 rounded-full shadow-sm transition ${darkMode ? "translate-x-6 bg-black" : "translate-x-0 bg-white"}`} />
                  </span>
                </button>
              </section>

              <section className="mb-5">
                <div className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "text-white/45" : "text-black/40"
                }`}>
                  {t("Representative tags")}
                </div>
                <div className={`no-accent-border rounded-[1.45rem] p-4 ${darkMode ? "bg-[#141414]" : "bg-white"}`}>
                  <div className={`text-sm leading-5 ${darkMode ? "text-white/58" : "text-black/54"}`}>
                    {t("Choose up to 3 tags for your profile. Leave empty to use your most common dish tags.")}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => {
                      const active = representativeTagsDraft.includes(tag);
                      const disabled = !active && representativeTagsDraft.length >= PROFILE_REPRESENTATIVE_TAG_LIMIT;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleRepresentativeTag(tag)}
                          disabled={disabled}
                          className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                            darkMode ? getDarkTagChipClass(tag, active) : getTagChipClass(tag, active)
                          } ${disabled ? "opacity-35" : ""}`}
                        >
                          {t(tag)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRepresentativeTagsDraft([])}
                    className={`mt-3 text-sm font-semibold ${darkMode ? "text-white/62" : "text-black/54"}`}
                  >
                    {t("Use automatic tags")}
                  </button>
                  <button
                    type="button"
                    onClick={saveRepresentativeTags}
                    disabled={representativeTagsSaving}
                    className={`mt-3 w-full rounded-full px-4 py-3 text-sm font-bold transition ${
                      darkMode ? "bg-[#2BD36B] text-black" : "bg-[#111111] text-white"
                    } ${representativeTagsSaving ? "opacity-60" : ""}`}
                  >
                    {representativeTagsSaving ? t("Saving...") : t("Save tags")}
                  </button>
                </div>
              </section>

              <section className="mb-5">
                <div className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "text-white/45" : "text-black/40"
                }`}>
                  {t("Leaderboard")}
                </div>
                <div className={`no-accent-border rounded-[1.45rem] p-4 ${darkMode ? "bg-[#141414]" : "bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t("Question manager")}</div>
                      <div className={`mt-1 text-sm ${darkMode ? "text-white/52" : "text-black/50"}`}>
                        {t("Create the questions shown in Explore.")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeaderboardAdminOpen(true)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                        darkMode ? "bg-white text-black" : "bg-black text-white"
                      }`}
                    >
                      {t("Open")}
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <div className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "text-white/45" : "text-black/40"
                }`}>
                  {t("Account")}
                </div>
                <div className={`no-accent-border overflow-hidden rounded-[1.45rem] ${darkMode ? "bg-[#141414]" : "bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOptionsOpen(false);
                      handleLogout();
                    }}
                    className="no-accent-border flex w-full items-center justify-between px-4 py-4 text-left font-semibold"
                  >
                    {t("Log Out")}
                  </button>
                  <div className={darkMode ? "h-px bg-white/8" : "h-px bg-black/8"} />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOptionsOpen(false);
                      setDeletePassword("");
                      setDeleteAccountError("");
                      setDeleteAccountModal(true);
                    }}
                    className="no-accent-border flex w-full items-center justify-between px-4 py-4 text-left font-semibold text-[#E64646]"
                  >
                    {t("Delete Account")}
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Manager */}
      <AnimatePresence>
        {leaderboardAdminOpen && (
          <motion.div
            className={`fixed inset-0 z-[110] flex flex-col ${darkMode ? "bg-[#050505] text-white" : "bg-[#F8F6F0] text-black"}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="app-top-nav flex items-center justify-between px-5 pb-3">
              <button
                type="button"
                onClick={() => setLeaderboardAdminOpen(false)}
                className={`no-accent-border flex h-11 w-11 items-center justify-center rounded-full ${darkMode ? "bg-white/8 text-white" : "bg-white text-black"}`}
                aria-label="Close leaderboard manager"
              >
                <X size={19} />
              </button>
              <h2 className="text-[1.25rem] font-bold leading-none">{t("Question manager")}</h2>
              <div className="h-11 w-11" />
            </div>

            <div className="bottom-nav-spacer flex-1 overflow-y-auto px-5 pb-8 pt-2">
              <input
                type="password"
                value={leaderboardAdminPassword}
                onChange={(event) => setLeaderboardAdminPassword(event.target.value)}
                placeholder={t("Admin password")}
                className={`mb-4 w-full rounded-[1.1rem] border px-4 py-3 text-[16px] outline-none ${
                  darkMode ? "border-white/10 bg-[#111111] text-white placeholder:text-white/35" : "border-black/10 bg-white text-black placeholder:text-black/35"
                }`}
              />

              {leaderboardAdminPassword === "cravy1723" ? (
                <div className="space-y-4">
                  <section className={`rounded-[1.35rem] border p-4 ${darkMode ? "border-white/10 bg-[#111111]" : "border-black/10 bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[1rem] font-black">{t("Edit existing questions")}</div>
                      <button
                        type="button"
                        onClick={loadLeaderboardAdminQuestions}
                        className={`rounded-full border px-3 py-1.5 text-xs font-black ${darkMode ? "border-white/12 text-white" : "border-black/12 text-black"}`}
                      >
                        {t("Refresh")}
                      </button>
                    </div>
                    {leaderboardAdminQuestions.length ? (
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {leaderboardAdminQuestions.map((question) => {
                          const active = leaderboardQuestionEditingId === question.id;
                          return (
                            <div
                              key={question.id}
                              className={`rounded-[1rem] border p-3 ${active ? "border-[#E64646] bg-[#2A1414] text-white" : darkMode ? "border-white/10 bg-[#080808] text-white" : "border-black/10 bg-[#F5F2EA] text-black"}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setLeaderboardQuestionEditingId(question.id);
                                  setLeaderboardQuestionTitle(question.title || "");
                                  setLeaderboardQuestionLabel(question.label || "IN TREND");
                                  setLeaderboardQuestionAccent(question.accent || "red");
                                  setLeaderboardQuestionDishMode(question.dishMode === "home" ? "home" : "restaurant");
                                }}
                                className="w-full text-left"
                              >
                                <div className="truncate text-sm font-black">{question.title}</div>
                                <div className="mt-1 text-xs opacity-60">{t(question.dishMode === "home" ? "Eat in" : "Eat out")} · {active ? t("Editing") : t("Tap to edit")}</div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLeaderboardQuestion(question.id)}
                                className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#E64646]/60 px-3 py-1.5 text-xs font-black text-[#E64646]"
                              >
                                <Trash2 size={13} />
                                {t("Delete")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{t("No questions yet")}</div>
                    )}
                  </section>

                  <section className={`rounded-[1.35rem] border p-4 ${darkMode ? "border-white/10 bg-[#111111]" : "border-black/10 bg-white"}`}>
                    <div className="mb-3 text-[1rem] font-black">{leaderboardQuestionEditingId ? t("Update question") : t("Create new question")}</div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={leaderboardQuestionTitle}
                        onChange={(event) => setLeaderboardQuestionTitle(event.target.value)}
                        placeholder={t("Question")}
                        className={`w-full rounded-[1rem] border px-4 py-3 text-[16px] outline-none ${
                          darkMode ? "border-white/10 bg-[#080808] text-white placeholder:text-white/35" : "border-black/10 bg-[#F5F2EA] text-black placeholder:text-black/35"
                        }`}
                      />
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="text"
                          value={leaderboardQuestionLabel}
                          onChange={(event) => setLeaderboardQuestionLabel(event.target.value)}
                          placeholder={t("Label")}
                          className={`min-w-0 rounded-[1rem] border px-4 py-3 text-[16px] outline-none ${
                            darkMode ? "border-white/10 bg-[#080808] text-white placeholder:text-white/35" : "border-black/10 bg-[#F5F2EA] text-black placeholder:text-black/35"
                          }`}
                        />
                        <select
                          value={leaderboardQuestionAccent}
                          onChange={(event) => setLeaderboardQuestionAccent(event.target.value)}
                          className={`rounded-[1rem] border px-3 py-3 text-[16px] outline-none ${darkMode ? "border-white/10 bg-[#080808] text-white" : "border-black/10 bg-[#F5F2EA] text-black"}`}
                        >
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="yellow">Yellow</option>
                          <option value="blue">Blue</option>
                          <option value="pink">Pink</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "restaurant", label: t("Eat out"), color: "#E64646" },
                          { id: "home", label: t("Eat in"), color: "#E4B43F" },
                        ].map((item) => {
                          const active = leaderboardQuestionDishMode === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setLeaderboardQuestionDishMode(item.id)}
                              className={`rounded-[1rem] border px-4 py-3 text-sm font-black transition ${darkMode ? "bg-[#080808] text-white" : "bg-[#F5F2EA] text-black"}`}
                              style={{
                                borderColor: active ? item.color : darkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
                                boxShadow: active ? `0 0 0 1px ${item.color}` : "none",
                                color: active ? item.color : undefined,
                              }}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateLeaderboardQuestion}
                        disabled={leaderboardQuestionSaving}
                        className={`w-full rounded-full px-4 py-3 text-sm font-black transition ${darkMode ? "bg-[#E64646] text-white" : "bg-[#E64646] text-white"} ${leaderboardQuestionSaving ? "opacity-60" : ""}`}
                      >
                        {leaderboardQuestionSaving ? t("Publishing...") : t(leaderboardQuestionEditingId ? "Update question" : "Publish question")}
                      </button>
                      {leaderboardQuestionEditingId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLeaderboardQuestionEditingId("");
                            setLeaderboardQuestionTitle("");
                            setLeaderboardQuestionLabel("IN TREND");
                            setLeaderboardQuestionAccent("red");
                            setLeaderboardQuestionDishMode("restaurant");
                          }}
                          className={`w-full rounded-full border px-4 py-3 text-sm font-black ${darkMode ? "border-white/12 bg-[#080808] text-white" : "border-black/12 bg-[#F5F2EA] text-black"}`}
                        >
                          {t("Create new question")}
                        </button>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : (
                <div className={`rounded-[1.35rem] border p-4 text-sm ${darkMode ? "border-white/10 bg-[#111111] text-white/55" : "border-black/10 bg-white text-black/55"}`}>
                  {t("Enter the admin password to manage leaderboard questions.")}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editProfileModal && (
          <motion.div
            className={`fixed inset-0 z-[96] flex flex-col overflow-hidden ${
              darkMode ? "bg-[#050505] text-white" : "bg-[#F8F6F0] text-black"
            }`}
            onClick={() => {
              setEditProfileModal(false);
              setRemovePhoto(false);
            }}
          >
            <motion.div
              className="flex h-full w-full flex-col overflow-hidden"
              initial={{ y: 26, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 26, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-top-nav flex items-center justify-between px-5 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileModal(false);
                    setRemovePhoto(false);
                  }}
                  className={`no-accent-border flex h-11 w-11 items-center justify-center rounded-full ${
                    darkMode ? "bg-white/8 text-white" : "bg-white text-black"
                  } shadow-[0_10px_28px_rgba(0,0,0,0.12)]`}
                  aria-label="Close"
                >
                  <X size={19} />
                </button>
                <h2 className="text-[1.35rem] font-semibold leading-none">{t("Edit profile")}</h2>
                <div className="h-11 w-11" />
              </div>

              <div className="bottom-nav-spacer flex-1 overflow-y-auto px-5 pb-8 pt-2">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  darkMode ? "bg-white/8 text-white/55" : "bg-black/6 text-black/45"
                }`}>
                  Profile
                </div>
                <h2 className="mt-3 text-[2rem] leading-none font-semibold">{t("Edit profile")}</h2>
                <p className={`mt-3 text-sm ${darkMode ? "text-white/58" : "text-black/58"}`}>{t("Update your name, photo and bio.")}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-white/72" : "text-black/72"}`}>{t("Display name")}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={`w-full rounded-full border px-4 py-3 focus:outline-none focus:ring-2 ${
                      darkMode ? "border-white/10 bg-[#141414] text-white focus:ring-white/10" : "border-black/10 bg-white px-4 py-3 text-black focus:ring-black/10"
                    }`}
                  />
                </div>

                <div className={`no-accent-border rounded-[1.6rem] p-4 ${darkMode ? "bg-[#141414]" : "bg-white"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <label className={`text-sm font-medium ${darkMode ? "text-white/72" : "text-black/72"}`}>{t("Profile picture")}</label>
                    {newPhotoPreview ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewPhotoFile(null);
                          setNewPhotoPreview("");
                          setRemovePhoto(true);
                        }}
                        className={`text-sm font-medium ${darkMode ? "text-white/58 hover:text-white" : "text-black/55 hover:text-black"}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`h-24 w-24 overflow-hidden rounded-full flex items-center justify-center text-2xl font-bold ${darkMode ? "bg-white/8" : "bg-black/5"}`}>
                      {newPhotoPreview ? (
                        <img
                          src={newPhotoPreview}
                          alt="Profile preview"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        newName?.[0] || user?.displayName?.[0] || "U"
                      )}
                    </div>
                    <label className={`no-accent-border inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-sm font-semibold shadow-[0_10px_22px_rgba(0,0,0,0.08)] ${
                      darkMode ? "bg-white text-black" : "bg-black text-white"
                    }`}>
                      {t("Change photo")}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewPhotoFile(file);
                          if (file) {
                            setNewPhotoPreview(URL.createObjectURL(file));
                            setRemovePhoto(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-white/72" : "text-black/72"}`}>Bio</label>
                  <textarea
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    rows={4}
                    placeholder="Add a short bio"
                    className={`w-full resize-none rounded-[1.5rem] border px-4 py-3 focus:outline-none focus:ring-2 ${
                      darkMode ? "border-white/10 bg-[#141414] text-white focus:ring-white/10" : "border-black/10 bg-white px-4 py-3 text-black focus:ring-black/10"
                    }`}
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileModal(false);
                    setRemovePhoto(false);
                  }}
                  className={`no-accent-border rounded-full px-5 py-3 font-medium ${
                    darkMode ? "bg-white/8 text-white/72" : "bg-white text-black/72"
                  }`}
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditProfile}
                  disabled={savingProfile}
                  className={`no-accent-border rounded-full px-6 py-3 font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.12)] ${
                    savingProfile ? "bg-white/10 text-white/40" : "bg-[#FFC247] text-black"
                  }`}
                >
                  {savingProfile ? "Saving..." : t("Save profile")}
                </motion.button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteAccountModal && (
          <motion.div
            className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (deletingAccount) return;
              setDeleteAccountModal(false);
              setDeletePassword("");
              setDeleteAccountError("");
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.22)]"
              initial={{ y: 18, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
                    Permanent
                  </div>
                  <h2 className="mt-3 text-[1.9rem] leading-none font-semibold text-black">Delete account</h2>
                  <p className="mt-3 text-sm leading-6 text-black/62">
                    This permanently deletes your profile, uploaded dishes, saved lists, stories, comments and direct messages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (deletingAccount) return;
                    setDeleteAccountModal(false);
                    setDeletePassword("");
                    setDeleteAccountError("");
                  }}
                  className="h-10 w-10 shrink-0 rounded-2xl border border-black/10 bg-black/[0.03] text-black/60"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {user?.providerData?.some((provider) => provider.providerId === "password") ? (
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium text-black/68">Confirm your password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-full border border-black/10 bg-black/[0.03] px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Password"
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-[1.25rem] bg-black/[0.04] px-4 py-3 text-sm text-black/62">
                  You may be asked to confirm your sign-in before deletion.
                </p>
              )}

              {deleteAccountError ? (
                <p className="mt-4 rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-600">{deleteAccountError}</p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (deletingAccount) return;
                    setDeleteAccountModal(false);
                    setDeletePassword("");
                    setDeleteAccountError("");
                  }}
                  className="flex-1 rounded-full border border-black/12 bg-white px-4 py-3 font-semibold text-black/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 rounded-full border border-red-600 bg-red-600 px-4 py-3 font-semibold text-white shadow-[0_16px_32px_rgba(220,38,38,0.22)] disabled:opacity-55"
                >
                  {deletingAccount ? "Deleting..." : "Delete forever"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      href={u.id === user.uid ? "/profile" : `/profile/${encodeURIComponent(u.id)}`}
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

      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
      <AnimatePresence>
        {dishlistsOpen && (
          <motion.div
            className="fixed inset-0 z-[88] overflow-y-auto"
            style={{
              background: darkMode ? "#050505" : "#FFF8EF",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishlistsOpen(false)}
          >
            <motion.div
              className={`min-h-screen w-full px-4 pb-28 pt-24 ${darkMode ? "text-white" : "text-black"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setDishlistsOpen(false);
                  setDishlistsEditMode(false);
                }}
                className={`fixed right-5 top-[calc(env(safe-area-inset-top,0px)+2.9rem)] z-[89] flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.08)] ${
                  darkMode ? "border-white/12 bg-[#202020] text-white" : "border-black/10 bg-white/92 text-black"
                }`}
                aria-label="Close dishlists"
              >
                <X size={18} />
              </button>
              <div className="mx-auto w-full max-w-3xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/38" : "text-black/38"}`}>
                    Dishlists
                  </div>
                  <h3 className={`mt-2 text-[1.9rem] leading-none font-bold ${darkMode ? "text-white" : "text-black"}`}>Your DishLists</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDishlistsEditMode((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    dishlistsEditMode
                      ? "border border-[#D56A6A] bg-[#FFF1F1] text-[#B34747]"
                      : darkMode
                        ? "border border-white/12 bg-[#202020] text-white/70"
                        : "border border-black/10 bg-white text-black/70"
                  }`}
                >
                  <Pencil size={14} />
                  {dishlistsEditMode ? "Done" : "Edit"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {allDishlists.map((dishlist) => {
                  const preview = getDishlistPreviewDishes(dishlist);
                  return (
                    <div key={dishlist.id} className={`rounded-[1.5rem] border p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.06)] ${
                      darkMode ? "border-white/10 bg-[#151515]" : "border-black/10 bg-white"
                    }`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            selectDishlist(dishlist.id);
                            setDishlistsOpen(false);
                            setDishlistsEditMode(false);
                          }}
                          className="no-accent-border min-w-0 flex-1 bg-transparent text-left"
                        >
                          <div className={`truncate pr-1 text-[1rem] font-bold ${darkMode ? "text-white" : "text-black"}`}>{dishlist.name}</div>
                        </button>
                        {dishlistsEditMode && dishlist.type === "custom" ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDishlistRenameTarget(dishlist);
                                setDishlistRenameValue(dishlist.name || "");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] bg-white text-black shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
                              aria-label={`Rename ${dishlist.name}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDishlistDeleteTarget(dishlist);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D56A6A] bg-[#D56A6A] text-white shadow-[0_10px_20px_rgba(213,106,106,0.24)]"
                              aria-label={`Delete ${dishlist.name}`}
                            >
                              <Minus size={15} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          selectDishlist(dishlist.id);
                          setDishlistsOpen(false);
                          setDishlistsEditMode(false);
                        }}
                        className="block w-full"
                      >
                        <DishlistPreviewGrid dishlist={dishlist} preview={preview} darkMode={darkMode} t={t} />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleOpenCreateDishlist}
                  className={`min-h-[11.4rem] rounded-[1.5rem] border-2 border-dashed border-[#2BD36B]/55 p-3 text-left ${
                    darkMode ? "bg-[#102817]" : "bg-[#F3FFF7]"
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#176A37]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2BD36B] text-white">
                      <Plus size={22} />
                    </div>
                    <div className="text-sm font-semibold">Create dishlist</div>
                  </div>
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {createDishlistOpen && (
          <motion.div
            className="fixed inset-0 z-[89] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (creatingDishlist) return;
              setCreateDishlistOpen(false);
            }}
          >
            <motion.div
              className={`w-full max-w-md rounded-[2rem] border p-4 shadow-[0_30px_80px_rgba(0,0,0,0.18)] ${
                darkMode ? "border-white/12 bg-[#111111] text-white" : "border-black/10 bg-white text-black"
              }`}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/42" : "text-black/38"}`}>
                    New Dishlist
                  </div>
                  <h3 className={`mt-2 text-[1.7rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {createDishlistStep === 0 ? "Name it" : "Add dishes"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateDishlistOpen(false)}
                  className={`text-sm ${darkMode ? "text-white/62" : "text-black/55"}`}
                >
                  Close
                </button>
              </div>

              {createDishlistStep === 0 ? (
                <>
                  <input
                    type="text"
                    value={newDishlistName}
                    onChange={(event) => setNewDishlistName(event.target.value)}
                    placeholder="Dishlist name"
                    className={`w-full rounded-full border px-4 py-3 focus:outline-none focus:ring-2 ${
                      darkMode ? "border-white/12 bg-[#1B1B1B] text-white placeholder:text-white/35 focus:ring-white/10" : "border-black/10 bg-[#F7F4ED] text-black focus:ring-black/10"
                    }`}
                  />
                  {popularDishlistNames.length ? (
                    <div className="mt-4">
                      <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/42" : "text-black/42"}`}>
                        Popular names
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {popularDishlistNames.map((name, index) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setNewDishlistName(name)}
                            className={[
                              "rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-[0_8px_18px_rgba(0,0,0,0.06)]",
                              darkMode
                                ? [
                                    "border-[#F0A623]/45 bg-[#2A1D08] text-[#FFD986]",
                                    "border-[#E64646]/42 bg-[#2B1010] text-[#FFB7B7]",
                                    "border-[#5FA8F2]/42 bg-[#0D2034] text-[#B9DAFF]",
                                    "border-[#B779FF]/42 bg-[#231333] text-[#E2C9FF]",
                                    "border-[#2BD36B]/42 bg-[#0D2717] text-[#B8F8CC]",
                                  ][index % 5]
                                : [
                                    "border-[#F0A623]/45 bg-[#FFF3C7] text-[#8A5A00]",
                                    "border-[#E64646]/36 bg-[#FFE7E7] text-[#A92F2F]",
                                    "border-[#5FA8F2]/38 bg-[#E8F3FF] text-[#195C9A]",
                                    "border-[#B779FF]/36 bg-[#F4EAFF] text-[#6B2AA0]",
                                    "border-[#2BD36B]/35 bg-[#EAFBF0] text-[#176A37]",
                                  ][index % 5],
                            ].join(" ")}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDishlistName.trim()) return;
                        setCreateDishlistStep(1);
                      }}
                      className="rounded-full border border-[#45C47A]/45 bg-[#1FA463] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(31,164,99,0.18)]"
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="max-h-[58vh] overflow-y-auto pr-1">
                    <div className={`mb-4 flex items-center gap-2 rounded-[1.15rem] border px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.04)] ${
                      darkMode ? "border-white/12 bg-[#1B1B1B]" : "border-black/10 bg-white"
                    }`}>
                      <Search size={16} className={`shrink-0 ${darkMode ? "text-white/42" : "text-black/40"}`} />
                      <input
                        type="text"
                        value={createDishSearch}
                        onChange={(e) => setCreateDishSearch(e.target.value)}
                        placeholder="Search your dishes"
                        className={`min-w-0 flex-1 bg-transparent text-base focus:outline-none ${darkMode ? "text-white placeholder:text-white/35" : "text-black placeholder:text-black/35"}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {allDishlists.map((dishlist) => {
                        const preview = getDishlistPreviewDishes(dishlist);
                        const selected = dishlist.id === createSourceDishlist?.id;
                        return (
                          <button
                            key={`create-${dishlist.id}`}
                            type="button"
                            onClick={() => setCreateSourceDishlistId(dishlist.id)}
                            className={`rounded-[1.35rem] border p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${
                              selected
                                ? darkMode
                                  ? "border-[#45C47A] bg-[#12351F] text-white"
                                  : "border-[#1FA463] bg-[#F4FFF7] text-black"
                                : darkMode
                                  ? "border-white/12 bg-[#1A1A1A] text-white"
                                  : "border-black/10 bg-white text-black"
                            }`}
                          >
                            <div className={`mb-2 truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>{dishlist.name}</div>
                            <DishlistPreviewGrid dishlist={dishlist} preview={preview} darkMode={darkMode} t={t} />
                          </button>
                        );
                      })}
                    </div>
                    {createSourceDishlist ? (
                      <div className="mt-5">
                        <div className={`mb-2 text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                          {createDishSearchTerm ? "Search results" : createSourceDishlist.name}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {visibleCreateDishes.map((dish) => {
                            const selected = selectedDishIds.includes(dish.id);
                            return (
                              <button
                                key={`${createSourceDishlist.id}-${dish.id}`}
                                type="button"
                                onClick={() => toggleDishSelection(dish)}
                                className={`overflow-hidden rounded-[1rem] border-2 text-left ${
                                  selected
                                    ? "border-[#45C47A] ring-2 ring-[#1FA463]/45"
                                    : String(dish?.dishMode || "").toLowerCase() === "restaurant"
                                      ? "restaurant-accent-border"
                                      : "default-accent-border"
                                }`}
                                style={selected ? { borderColor: "#45C47A", boxShadow: "0 0 0 3px rgba(31,164,99,0.26)" } : undefined}
                              >
                                <img
                                  src={getDishImageUrl(dish, "thumb")}
                                  alt={dish.name}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(event) => {
                                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                  }}
                                />
                                <div className={`px-2 py-1.5 text-[11px] font-semibold truncate ${darkMode ? "bg-[#151515] text-white" : "text-black"}`}>
                                  {dish.name || "Untitled dish"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {visibleCreateDishes.length === 0 ? (
                          <div className="mt-2 rounded-[1rem] border border-dashed border-black/10 bg-white/70 px-4 py-5 text-center text-sm text-black/50">
                            No matching dishes.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateDishlistStep(0)}
                      className="rounded-full border border-black/12 px-4 py-3 text-sm font-medium text-black/72"
                      disabled={creatingDishlist}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateDishlist}
                      disabled={creatingDishlist}
                      className="rounded-full border border-[#45C47A]/45 bg-[#1FA463] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(31,164,99,0.18)] disabled:opacity-60"
                    >
                      {creatingDishlist ? "Creating..." : `Create (${selectedCreateDishes.length})`}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dishlistDeleteTarget ? (
          <motion.div
            className="fixed inset-0 z-[91] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishlistDeleteTarget(null)}
          >
            <motion.div
              className={`w-full max-w-md rounded-[2rem] border px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
                darkMode
                  ? "border-white/12 bg-[#111111] text-white"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)]"
              }`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`mx-auto mb-4 h-1.5 w-12 rounded-full ${darkMode ? "bg-white/18" : "bg-black/12"}`} />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B34747]">
                    Delete Dishlist
                  </p>
                  <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                    Delete {dishlistDeleteTarget.name}?
                  </h3>
                  <p className="mt-1 text-sm text-black/55">
                    This removes the dishlist itself, but keeps the dishes in your profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishlistDeleteTarget(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/60"
                  aria-label="Close delete dishlist dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDishlistDeleteTarget(null)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDishlist}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C93A3A] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(201,58,58,0.25)]"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {dishlistRenameTarget ? (
          <motion.div
            className="fixed inset-0 z-[91] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setDishlistRenameTarget(null);
              setDishlistRenameValue("");
            }}
          >
            <motion.div
              className={`w-full max-w-md rounded-[2rem] border px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
                darkMode
                  ? "border-white/12 bg-[#111111] text-white"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)]"
              }`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`mx-auto mb-4 h-1.5 w-12 rounded-full ${darkMode ? "bg-white/18" : "bg-black/12"}`} />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                    {t("Rename Dishlist")}
                  </p>
                  <h3 className={`mt-1 text-[1.4rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                    {t("Edit the list name")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDishlistRenameTarget(null);
                    setDishlistRenameValue("");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/60"
                  aria-label="Close rename dishlist dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                value={dishlistRenameValue}
                onChange={(event) => setDishlistRenameValue(event.target.value)}
                placeholder={t("Dishlist name")}
                className={`w-full rounded-full border px-4 py-3 focus:outline-none focus:ring-2 ${
                  darkMode ? "border-white/12 bg-[#1B1B1B] text-white placeholder:text-white/35 focus:ring-white/10" : "border-black/10 bg-[#F7F4ED] text-black focus:ring-black/10"
                }`}
              />
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDishlistDeleteTarget(dishlistRenameTarget);
                    setDishlistRenameTarget(null);
                    setDishlistRenameValue("");
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    darkMode ? "border-[#E64646]/45 bg-[#2A1212] text-[#FFD5D5]" : "border-[#D56A6A] bg-[#FFF1F1] text-[#B34747]"
                  }`}
                >
                  {t("Delete")}
                </button>
                <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDishlistRenameTarget(null);
                    setDishlistRenameValue("");
                  }}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleRenameDishlist}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  <Pencil size={15} />
                  {t("Save")}
                </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={user?.displayName || "You"}
        ownerPhotoURL={effectiveProfilePhotoURL}
        onViewed={handleStoryViewed}
        canDelete
        onDelete={handleDeleteStory}
        currentUser={user}
      />
      <AnimatePresence>
        {removePreviewTarget ? (
          (() => {
            const removalMeta = getRemovalTargetMeta(removePreviewTarget.source);
            return (
          <motion.div
            className="fixed inset-0 z-[92] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRemovePreviewTarget(null)}
          >
            <motion.div
              className={`w-full max-w-md rounded-[2rem] border px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
                darkMode
                  ? "border-white/12 bg-[#111111] text-white"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)]"
              }`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`mx-auto mb-4 h-1.5 w-12 rounded-full ${darkMode ? "bg-white/18" : "bg-black/12"}`} />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B34747]">
                    {t("Remove Dish")}
                  </p>
                  <h3 className={`mt-1 text-[1.4rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                    {t("Choose how to remove it")}
                  </h3>
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}>{removePreviewTarget.dish?.name || "dish"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovePreviewTarget(null)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${darkMode ? "bg-white/8 text-white/70" : "bg-white text-black/60"}`}
                  aria-label="Close remove options"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {removalMeta ? (
                  <button
                    type="button"
                    onClick={() => confirmDishPreviewRemove("list")}
                    className={`flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${
                      darkMode ? "border-white/12 bg-[#181818] text-white" : removalMeta.buttonClass
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                        {t("Remove from")} {t(removalMeta.label)} {t("only")}
                      </div>
                      <div className={`mt-0.5 text-xs ${darkMode ? "text-white/48" : "text-black/48"}`}>{t(removalMeta.description)}</div>
                    </div>
                    <div className={`ml-4 flex h-9 w-9 items-center justify-center rounded-full border ${removalMeta.iconClass}`}>
                      <Minus size={16} />
                    </div>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => confirmDishPreviewRemove("profile")}
                  className={`flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${
                    darkMode ? "border-[#E64646]/55 bg-[#241111] text-white" : "border-[#D56A6A] bg-[#FFF1F1]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Remove from profile completely")}</div>
                    <div className={`mt-0.5 text-xs ${darkMode ? "text-white/48" : "text-black/48"}`}>{t("Delete it from your saved lists and profile")}</div>
                  </div>
                  <div className="ml-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#C93A3A] bg-[#C93A3A] text-white">
                    <Trash2 size={16} />
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
            );
          })()
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {dishCardActionTarget ? (
          <motion.div
            className="fixed inset-0 z-[93] bg-black/50 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishCardActionTarget(null)}
          >
            <motion.div
              className={`w-full max-w-md rounded-[1.7rem] border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)] ${
                darkMode ? "border-white/12 bg-[#111111] text-white" : "border-black/10 bg-white text-black"
              }`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-3">
                <img
                  src={getDishImageUrl(dishCardActionTarget.dish, "thumb")}
                  alt={dishCardActionTarget.dish?.name || "Dish"}
                  className="h-14 w-14 rounded-[1rem] object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold">{dishCardActionTarget.dish?.name || "Untitled dish"}</div>
                  <div className={`text-xs ${darkMode ? "text-white/50" : "text-black/50"}`}>{t("Dish actions")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDishCardActionTarget(null)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${darkMode ? "bg-white/10 text-white/70" : "bg-black/6 text-black/60"}`}
                  aria-label="Close dish actions"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleAddDishCardToStory(dishCardActionTarget.dish);
                  }}
                  className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                    darkMode ? "border-[#38BDF8]/45 bg-[#0D2634] text-white" : "border-[#38BDF8]/45 bg-[#EFFAFF] text-black"
                  }`}
                >
                  <span>{t("Add to story")}</span>
                  <StoryStatIcon size={17} />
                </button>
                {profileIdCandidates.includes(dishCardActionTarget.dish?.owner) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const returnParam = encodeURIComponent(buildProfileReturnTo());
                      const dishId = dishCardActionTarget.dish?.id;
                      setDishCardActionTarget(null);
                      router.push(`/dish/${dishId}?source=uploaded&mode=single&edit=1&returnTo=${returnParam}`);
                    }}
                    className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                      darkMode ? "border-white/12 bg-white/8 text-white" : "border-black/8 bg-black/4 text-black"
                    }`}
                  >
                    <span>{t("Edit dish")}</span>
                    <Pencil size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const target = dishCardActionTarget.dish;
                    setDishCardActionTarget(null);
                    handleOpenDishlistPicker(target);
                  }}
                  className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                    darkMode ? "border-[#2BD36B]/45 bg-[#102817] text-white" : "border-[#2BD36B]/45 bg-[#F4FFF7] text-black"
                  }`}
                >
                  <span>{t("Manage dishlists")}</span>
                  <ListChecks size={16} />
                </button>
                {dishCardActionTarget.onRemovePreview || dishCardActionTarget.allowDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = dishCardActionTarget;
                      setDishCardActionTarget(null);
                      if (target.onRemovePreview) {
                        target.onRemovePreview(target.dish);
                      } else if (target.allowDelete) {
                        handleDeleteDish(target.dish);
                      }
                    }}
                    className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                      darkMode ? "border-[#E64646]/45 bg-[#2A1212] text-[#FFD5D5]" : "border-[#E64646]/35 bg-[#FFF1F1] text-[#B34747]"
                    }`}
                  >
                    <span>{dishCardActionTarget.allowDelete ? t("Delete") : t("Remove")}</span>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AppToast message={toast} variant={toastVariant} />
      <AnimatePresence>
        {storyActionOpen && (
          <motion.div
            className="fixed inset-0 z-[90] overflow-y-auto bg-black/45 backdrop-blur-sm flex items-center justify-center p-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStoryActionOpen(false)}
          >
            <motion.div
              className={`no-accent-border my-auto w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-[2rem] p-4 shadow-2xl border ${
                darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-white"
              }`}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setStoryActionOpen(false)}
                  className={`text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/upload?story=1");
                  }}
                  className={`w-full min-h-[15.5rem] rounded-[2rem] px-8 py-8 text-left transition-transform hover:scale-[1.01] border-[3px] border-[#E64646] backdrop-blur-[6px] ${
                    darkMode ? "bg-[#251111] text-white shadow-[0_18px_40px_rgba(230,70,70,0.14)]" : "bg-[rgba(255,255,255,0.72)] text-black shadow-[0_18px_40px_rgba(230,70,70,0.12)]"
                  }`}
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[2.15rem] font-semibold leading-none">{t("Upload dish")}</p>
                        <p className={`mt-4 text-base ${darkMode ? "text-white/68" : "text-black/78"}`}>{t("Post directly to your story.")}</p>
                      </div>
                      <div className="size-16 rounded-[1.4rem] bg-[#E64646] text-white flex items-center justify-center shadow-md border-[2px] border-[#E64646]/55 shrink-0 aspect-square">
                        <Plus size={32} />
                      </div>
                    </div>
                    <div>
                      <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/50" : "text-black/55"}`}>
                        Steps
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {STORY_CHOOSER_STEPS.map((step) => (
                          <div key={step.label}>
                            <div className="mb-2 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                            <div className={`text-[0.72rem] font-medium ${darkMode ? "text-white/62" : "text-black/72"}`}>{step.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/dishes?storyPicker=1");
                  }}
                  className={`w-full min-h-[15.5rem] rounded-[2rem] border-[3px] border-[#F0A623] px-8 py-8 text-left transition-transform hover:scale-[1.01] backdrop-blur-[6px] ${
                    darkMode ? "bg-[#241A09] text-white shadow-[0_18px_40px_rgba(240,166,35,0.14)]" : "bg-[rgba(255,255,255,0.72)] shadow-[0_18px_40px_rgba(240,166,35,0.12)]"
                  }`}
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className={`text-[2.15rem] font-semibold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t("Find dish")}</p>
                        <p className={`mt-4 text-base ${darkMode ? "text-white/62" : "text-black/60"}`}>{t("Pick an existing dish for your story.")}</p>
                      </div>
                      <div className="size-16 rounded-[1.4rem] bg-[#F0A623] text-white flex items-center justify-center border-[2px] border-[#F0A623]/55 shadow-md shrink-0 aspect-square">
                        <Search size={30} />
                      </div>
                    </div>
                    <div>
                      <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/50" : "text-black/55"}`}>
                        Tags you can explore
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TAG_OPTIONS.slice(0, 10).map((tag) => (
                          <span
                            key={tag}
                            className={`px-3 py-1 rounded-full text-[11px] border ${darkMode ? getDarkTagChipClass(tag, true) : getTagChipClass(tag, true)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    setProfileCalendarOpen(true);
                    openMealCalendarEntry(getStoryCalendarKey(Date.now()));
                  }}
                  className={`w-full rounded-[1.45rem] border-2 px-5 py-4 text-left transition-transform hover:scale-[1.01] ${
                    darkMode
                      ? "border-white/14 bg-white/7 text-white"
                      : "border-black/10 bg-[#F7F5EF] text-black"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xl font-semibold leading-tight">{t("Calendar only")}</p>
                      <p className={`mt-1.5 text-sm leading-snug ${darkMode ? "text-white/58" : "text-black/58"}`}>
                        {t("This will not post a story.")}
                      </p>
                    </div>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] ${darkMode ? "bg-white/12 text-white" : "bg-black text-white"}`}>
                      <CalendarDays size={23} />
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
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
      <DishlistPickerModal
        open={dishlistPickerOpen}
        onClose={() => {
          setDishlistPickerOpen(false);
          setDishlistPickerDish(null);
          setDishlistPickerLists([]);
          setDishlistPickerSelectedIds([]);
        }}
        lists={dishlistPickerLists}
        dishName={dishlistPickerDish?.name || "dish"}
        mode="multiple"
        selectedIds={dishlistPickerSelectedIds}
        lockedIds={[]}
        onToggle={(dishlist) =>
          setDishlistPickerSelectedIds((prev) =>
            prev.includes(dishlist.id)
              ? prev.filter((id) => id !== dishlist.id)
              : [...prev, dishlist.id]
          )
        }
        onConfirm={handleConfirmDishlistPicker}
        confirmLabel={t("Save dish")}
        loading={dishlistPickerLoading}
      />
      <AnimatePresence>
        {profileCalendarOpen ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-black/45 px-4 pb-[5.75rem] pt-[5.35rem] backdrop-blur-sm"
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
              <div className="mb-2.5 flex items-center justify-between gap-3">
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
                      const selected = cell.dayKey === profileCalendarSelectedDay;
                      return (
                        <button
                          key={cell.dayKey}
                          type="button"
                          onClick={() => selectProfileCalendarDay(cell.dayKey)}
                          className={`relative flex h-10 items-center justify-center rounded-[0.65rem] border text-sm font-black ${
                            cell.isToday
                              ? "border-[#2BD36B] text-[#168944] shadow-[0_0_10px_rgba(43,211,107,0.22)]"
                              : selected
                                ? darkMode ? "border-white bg-white text-black" : "border-black bg-black text-white"
                                : cell.inMonth
                                  ? darkMode ? "border-white/8 bg-[#171717] text-white/78" : "border-black/8 bg-white text-black/72"
                                  : darkMode ? "border-white/[0.04] bg-white/[0.03] text-white/20" : "border-black/[0.04] bg-black/[0.02] text-black/20"
                          }`}
                        >
                          {cell.date.getDate()}
                          {items.length ? <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-[#E64646]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className={`mt-3 max-h-[22rem] min-h-[16rem] overflow-y-auto rounded-[1rem] border p-3 ${darkMode ? "border-white/10 bg-white/5" : "border-black/8 bg-white/86"}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className={`text-xs font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/48" : "text-black/45"}`}>
                    {new Date(`${profileCalendarSelectedDay}T12:00:00`).toLocaleDateString(language === LANGUAGE_IT ? "it-IT" : "en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => openMealCalendarEntry(profileCalendarSelectedDay)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                      darkMode ? "bg-white text-black" : "bg-black text-white"
                    }`}
                  >
                    {profileCalendarSelectedDay === getStoryCalendarKey(Date.now()) ? t("Add today") : t("Add")}
                  </button>
                </div>
                {profileCalendarSelectedItems.length ? (
                  <div className="space-y-2">
                    {profileCalendarSelectedItems.map((item) => {
                      const content = (
                        <>
                          {item.calendarOnly ? (
                            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-[1rem] ${darkMode ? "bg-white/10 text-white" : "bg-black/8 text-black"}`}>
                              <CalendarDays size={28} />
                            </div>
                          ) : (
                            <img
                              src={getDishImageUrl(item.imageDish, "thumb")}
                              alt={item.name}
                              className="h-20 w-20 shrink-0 rounded-[1rem] object-cover"
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_DISH_IMAGE;
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className={`truncate text-base font-semibold ${darkMode ? "text-white" : "text-black"}`}>{item.name}</div>
                            <div className={`mt-1 text-xs ${darkMode ? "text-white/45" : "text-black/45"}`}>
                              {item.calendarOnly
                                ? t("Calendar only")
                                : new Date(item.ms).toLocaleTimeString(language === LANGUAGE_IT ? "it-IT" : "en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                            </div>
                          </div>
                        </>
                      );
                      const rowClassName = `flex items-center gap-3 rounded-[1rem] p-3 ${darkMode ? "bg-black/24" : "bg-[#F7F2E8]"}`;
                      return item.calendarOnly || !item.dishId ? (
                        <div key={item.id} className={rowClassName}>
                          {content}
                        </div>
                      ) : (
                        <Link
                          key={item.id}
                          href={`/dish/${item.dishId}?source=uploaded&mode=single&returnTo=${encodeURIComponent("/profile")}`}
                          className={rowClassName}
                        >
                          {content}
                        </Link>
                      );
                    })}
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
        {mealCalendarEntryOpen ? (
          <motion.div
            className="fixed inset-0 z-[105] flex items-start justify-center overflow-y-auto bg-black/55 px-4 pb-[42dvh] pt-[12dvh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMealCalendarEntryOpen(false)}
          >
            <motion.div
              className={`w-full max-w-sm rounded-[1.5rem] border p-4 shadow-2xl ${
                darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-white text-black"
              }`}
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/42" : "text-black/38"}`}>
                    {new Date(`${profileCalendarSelectedDay}T12:00:00`).toLocaleDateString(language === LANGUAGE_IT ? "it-IT" : "en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight">{t("Write what you ate")}</h3>
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/54" : "text-black/54"}`}>
                    {t("This will not post a story.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMealCalendarEntryOpen(false)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/12 bg-white/8 text-white/70" : "border-black/10 bg-white text-black/55"}`}
                  aria-label="Close calendar entry"
                >
                  <X size={15} />
                </button>
              </div>
              <label className={`mb-2 block text-xs font-bold uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/45"}`}>
                {t("What did you eat?")}
              </label>
              <input
                value={mealCalendarEntryName}
                onChange={(event) => setMealCalendarEntryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveMealCalendarEntry();
                }}
                className={`w-full rounded-[1rem] border px-4 py-3 text-base font-semibold outline-none ${
                  darkMode ? "border-white/12 bg-white/8 text-white placeholder:text-white/28" : "border-black/10 bg-[#F7F5EF] text-black placeholder:text-black/28"
                }`}
                placeholder={t("Dish name")}
                autoFocus
              />
              <button
                type="button"
                disabled={!mealCalendarEntryName.trim() || mealCalendarEntrySaving}
                onClick={saveMealCalendarEntry}
                className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  darkMode ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {mealCalendarEntrySaving ? t("Saving...") : t("Save to calendar")}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
        {profileMapOpen ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileMapOpen(false)}
          >
            <motion.div
              className="restaurant-accent-border mx-auto flex h-[calc(100dvh-12rem)] max-h-[calc(100dvh-12rem)] w-full max-w-[25.5rem] flex-col overflow-hidden rounded-[1.6rem] border-2 bg-[#F6F6F2] p-3 shadow-2xl"
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                    Profile map
                  </div>
                  <h3 className="mt-2 text-[1.6rem] leading-none font-semibold text-black">
                    Restaurants you&apos;ve pinned
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileMapOpen(false)}
                  className="restaurant-accent-border flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-black/55"
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
                dishHrefBuilder={(dish) => `/dish/${dish.id}?source=uploaded&mode=single&returnTo=${encodeURIComponent("/profile?list=uploaded")}`}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
