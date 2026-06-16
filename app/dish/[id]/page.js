"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, CornerUpRight, Crop, ListChecks, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import SwipeDeck from "../../../components/SwipeDeck";
import BottomNav from "../../../components/BottomNav";
import { FullScreenLoading } from "../../../components/AppLoadingState";
import AppToast from "../../../components/AppToast";
import AppBackButton from "../../../components/AppBackButton";
import ImageFramingModal from "../../../components/ImageFramingModal";
import { getDishImageUrl, isDishVideo } from "../../lib/dishImage";
import {
  addDishToToTryList,
  deleteDishAndImage,
  deleteImageByUrl,
  getAllDishesFromFirestore,
  getAllDishlistsForUser,
  getCustomDishlistDishes,
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersWhoSavedDish,
  publishDishAsStory,
  removeDishFromAllUsers,
  removeDishFromCustomDishlist,
  removeDishFromToTry,
  removeSavedDishFromUser,
  saveDishToSelectedDishlist,
  getStoryPushStatsForUser,
  upgradeToMyDishlist,
  updateDishAndSavedCopies,
  uploadDishImageVariants,
} from "../../lib/firebaseHelpers";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "../../lib/tags";
import { suggestDishTagsFromName } from "../../lib/dishTagSuggestions";
import SaversModal from "../../../components/SaversModal";
import ShareModal from "../../../components/ShareModal";
import DishlistPickerModal from "../../../components/DishlistPickerModal";
import IngredientBulletTextarea from "../../../components/IngredientBulletTextarea";
import { CookingHomeIcon, DISH_MODE_COOKING, DISH_MODE_RESTAURANT, RestaurantForkKnifeIcon, RestaurantMapIcon } from "../../../components/DishModeControls";
import { RatingStars } from "../../../components/RatingStars";
import RestaurantPlacePicker from "../../../components/RestaurantPlacePicker";
import StoryMealTagModal from "../../../components/StoryMealTagModal";
import { useLanguage } from "../../../components/LanguageProvider";
import { clearSessionPageCache } from "../../lib/sessionPageCache";

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

const PRICE_CURRENCIES = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "Fr." },
  { code: "JPY", symbol: "¥" },
];

const EDIT_COMPOSER_STEPS = ["Modo", "Media", "Dettagli", "Tags", "Extra", "Review"];

export default function DishDetail() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { darkMode, language, t } = useLanguage();

  const source = searchParams.get("source") || "saved";
  const mode = searchParams.get("mode") || "single";
  const profileId = searchParams.get("profileId");
  const listId = searchParams.get("listId");
  const returnTo = searchParams.get("returnTo");
  const deckIds = searchParams.get("deckIds") || "";
  const openEditOnLoad = searchParams.get("edit") === "1";
  const dishId = Array.isArray(id) ? id[0] : id;
  const userId = user?.uid || null;
  const listOwnerId = profileId || userId;
  const [dish, setDish] = useState(null);
  const [deckList, setDeckList] = useState([]);
  const [removedDishIds, setRemovedDishIds] = useState(() => new Set());
  const [loadingDish, setLoadingDish] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDishLink, setEditDishLink] = useState("");
  const [editRecipeIngredients, setEditRecipeIngredients] = useState("");
  const [editRecipeMethod, setEditRecipeMethod] = useState("");
  const [editTaggedUser, setEditTaggedUser] = useState("");
  const [editTaggedUserId, setEditTaggedUserId] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [editRating, setEditRating] = useState(0);
  const [editPrice, setEditPrice] = useState("");
  const [editPriceCurrency, setEditPriceCurrency] = useState("EUR");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editDishMode, setEditDishMode] = useState(DISH_MODE_COOKING);
  const [editRestaurant, setEditRestaurant] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageFramingFile, setEditImageFramingFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [editMediaPickerOpen, setEditMediaPickerOpen] = useState(false);
  const [editTagUserPickerOpen, setEditTagUserPickerOpen] = useState(false);
  const [editTaggableUsers, setEditTaggableUsers] = useState([]);
  const [editTagUserSearch, setEditTagUserSearch] = useState("");
  const [editTagUsersLoading, setEditTagUsersLoading] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editComposerDetailsOpen, setEditComposerDetailsOpen] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pageToast, setPageToast] = useState("");
  const [pageToastVariant, setPageToastVariant] = useState("success");
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDish, setShareDish] = useState(null);
  const [storyPushStats, setStoryPushStats] = useState({});
  const [storyMealTagDish, setStoryMealTagDish] = useState(null);
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlistPickerDish, setDishlistPickerDish] = useState(null);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["all_dishes"]);
  const [lockedDishlistIds, setLockedDishlistIds] = useState([]);
  const [initialDeckIndex, setInitialDeckIndex] = useState(0);
  const [profileCardActionsDish, setProfileCardActionsDish] = useState(null);
  const activeDeckRef = useRef(null);
  const editPreviewObjectUrlRef = useRef("");
  const editLibraryInputRef = useRef(null);
  const editCameraInputRef = useRef(null);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const orderedDeckIds = useMemo(
    () =>
      deckIds
        .split(",")
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    [deckIds]
  );

  const applyDeckOrder = (items) => {
    const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!orderedDeckIds.length) return normalizedItems;
    const orderedSet = new Set(orderedDeckIds);
    const byId = new Map(normalizedItems.map((entry) => [entry.id, entry]));
    const ordered = orderedDeckIds.map((entryId) => byId.get(entryId)).filter(Boolean);
    return ordered.length
      ? ordered
      : normalizedItems.filter((entry) => orderedSet.has(entry.id));
  };

  useEffect(() => {
    if (!dishId) return;
    if (!listOwnerId && source !== "public") {
      setLoadingDish(false);
      return;
    }
    setRemovedDishIds(new Set());
    (async () => {
      let items = [];
      if (source === "public") {
        const all = await getAllDishesFromFirestore();
        const publicItems = all.filter((d) => d.isPublic !== false);
        items = applyDeckOrder(publicItems);
      } else if (source === "all_dishes") {
        const lists = await getAllDishlistsForUser(listOwnerId);
        items = lists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
      } else if (source === "dishlist" && listId) {
        items = await getCustomDishlistDishes(listOwnerId, listId);
      } else if (source === "uploaded") {
        items = await getDishesFromFirestore(listOwnerId);
      } else if (source === "to_try") {
        items = await getToTryDishesFromFirestore(listOwnerId);
      } else {
        items = await getSavedDishesFromFirestore(listOwnerId);
      }
      items = orderedDeckIds.length
        ? applyDeckOrder(items)
        : items
            .slice()
            .sort((a, b) => {
              const aTime = a?.createdAt?.seconds || 0;
              const bTime = b?.createdAt?.seconds || 0;
              return bTime - aTime;
            });
      const found = items.find((d) => d.id === dishId) || null;
      if (found) {
        setDish(found);
        if (listOwnerId) {
          const stats = await getStoryPushStatsForUser(listOwnerId);
          setStoryPushStats(stats);
        }
        const foundIndex = Math.max(
          items.findIndex((entry) => entry.id === dishId),
          0
        );
        setInitialDeckIndex(foundIndex);
        if (mode === "shuffle") {
          const others = items.filter((d) => d.id !== dishId);
          setDeckList([found, ...shuffleArray(others)]);
        } else if (Boolean(returnTo) && (source !== "public" || deckIds)) {
          setDeckList(items);
        } else {
          setDeckList([found]);
        }
        setLoadingDish(false);
        return;
      }
      const snap = await getDoc(doc(db, "dishes", dishId));
      const fallbackDish = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setDish(fallbackDish);
      setInitialDeckIndex(0);
      setDeckList(fallbackDish ? [fallbackDish] : []);
      if (listOwnerId) {
        const stats = await getStoryPushStatsForUser(listOwnerId);
        setStoryPushStats(stats);
      }
      setLoadingDish(false);
    })();
  }, [dishId, listOwnerId, source, mode, listId, returnTo, deckIds, orderedDeckIds]);

  const orderedList = useMemo(() => {
    if (!dish) return [];
    const base =
      mode === "single"
        ? Boolean(returnTo) && (source !== "public" || deckIds)
          ? deckList
          : [dish]
        : deckList;
    return base.filter((d) => !removedDishIds.has(d.id));
  }, [dish, deckList, mode, removedDishIds, returnTo, source, deckIds]);

  const handleRemove = async (dishToRemove) => {
    if (!userId) return false;
    if (source === "to_try") {
      const removed = await removeDishFromToTry(userId, dishToRemove.id);
      if (!removed) return false;
    } else if (source === "uploaded") {
      try {
        await deleteDishAndImage(
          dishToRemove.id,
          dishToRemove.imageURL || dishToRemove.imageUrl || dishToRemove.image_url || dishToRemove.image
        );
        await removeDishFromAllUsers(dishToRemove.id);
      } catch (err) {
        console.error("Failed to remove uploaded dish:", err);
        return false;
      }
    } else {
      const removed = await removeSavedDishFromUser(userId, dishToRemove.id);
      if (!removed) return false;
    }
    setRemovedDishIds((prev) => {
      const next = new Set(prev);
      next.add(dishToRemove.id);
      return next;
    });
    setDeckList((prev) => prev.filter((d) => d.id !== dishToRemove.id));
    return true;
  };

  const handleAdd = async (dishToAdd) => {
    if (!userId) {
      alert("Please sign in to save dishes.");
      return { skipToast: true };
    }
    setDishlistPickerDish(dishToAdd);
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(userId)).filter(
        (dishlist) => dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      setSelectedDishlistIds(["all_dishes"]);
      setLockedDishlistIds(["all_dishes"]);
    } finally {
      setDishlistsLoading(false);
    }
    return { skipToast: true };
  };

  const handleManageDishlists = async (dishToAdd) => {
    if (!userId || !dishToAdd?.id) return;
    setDishlistPickerDish(dishToAdd);
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(userId)).filter(
        (dishlist) => dishlist.id !== "all_dishes" && dishlist.id !== "uploaded"
      );
      const memberships = nextLists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dishToAdd.id))
        .map((dishlist) => dishlist.id);
      setDishlists(nextLists);
      setSelectedDishlistIds(memberships);
      setLockedDishlistIds([]);
    } finally {
      setDishlistsLoading(false);
    }
  };

  const handleUpgrade = async (dishToUpgrade) => {
    if (!userId) return false;
    return upgradeToMyDishlist(userId, dishToUpgrade);
  };

  const handleRightSwipeToTry = async (dishToAdd) => {
    if (!userId) return false;
    return addDishToToTryList(userId, dishToAdd.id, dishToAdd);
  };

  const handleResetDeck = async () => {
    if (returnTo && orderedList.length <= 1) {
      router.push(returnTo);
      return;
    }
    setLoadingDish(true);
    setRemovedDishIds(new Set());
    try {
      let items = [];
      if (source === "public") {
        const all = await getAllDishesFromFirestore();
        const publicItems = all.filter((d) => d.isPublic !== false);
        items = applyDeckOrder(publicItems);
      } else if (source === "all_dishes") {
        const lists = await getAllDishlistsForUser(listOwnerId);
        items = lists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
      } else if (source === "dishlist" && listId) {
        items = await getCustomDishlistDishes(listOwnerId, listId);
      } else if (source === "uploaded") {
        items = await getDishesFromFirestore(listOwnerId);
      } else if (source === "to_try") {
        items = await getToTryDishesFromFirestore(listOwnerId);
      } else {
        items = await getSavedDishesFromFirestore(listOwnerId);
      }
      items = orderedDeckIds.length
        ? applyDeckOrder(items)
        : items
            .slice()
            .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      const found = items.find((d) => d.id === dishId) || items[0] || null;
      if (found) {
        setDish(found);
        if (mode === "shuffle") {
          const others = items.filter((d) => d.id !== found.id);
          setDeckList([found, ...shuffleArray(others)]);
        } else if (Boolean(returnTo) && (source !== "public" || deckIds)) {
          setDeckList(items);
        } else {
          setDeckList([found]);
        }
      } else {
        setDish(null);
        setDeckList([]);
      }
    } finally {
      setLoadingDish(false);
    }
  };

  const isPublicSource = source === "public";
  const enableProfileDeckNavigation = Boolean(returnTo) && mode === "single" && (!isPublicSource || Boolean(deckIds));
  const isToTrySource = source === "to_try";
  const isSavedSource = source === "saved";
  const isSavedListSource = source === "saved" || source === "all_dishes" || source === "dishlist" || source === "custom";
  const canManageOwnDish = Boolean(userId && orderedList.some((item) => item?.owner === userId));
  const isForeignProfileContext = Boolean(profileId && profileId !== userId);
  const shouldUsePublicActions = isPublicSource || isForeignProfileContext;
  const shouldUseStoryActions =
    !shouldUsePublicActions && (canManageOwnDish || ((isSavedListSource || isToTrySource) && !isForeignProfileContext));
  const getSecondaryActionLabel = (dishCard) => {
    if (dishCard?.owner === userId && !isForeignProfileContext && !isPublicSource) return "Edit";
    if (isToTrySource && !isForeignProfileContext) return "Move to DishList";
    return undefined;
  };
  const getSecondaryActionClassName = (dishCard) => {
    if (dishCard?.owner === userId && !isForeignProfileContext && !isPublicSource) {
      return "inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/75 bg-black/22 text-white backdrop-blur-sm shadow-[0_10px_22px_rgba(0,0,0,0.18)]";
    }
    if (isToTrySource && !isForeignProfileContext) {
      return "max-w-[132px] px-4 py-3 rounded-[1.2rem] bg-[#1FA463] text-white border border-[#45C47A]/45 text-xs font-bold uppercase tracking-[0.08em] shadow-[0_12px_26px_rgba(31,164,99,0.2)] leading-none text-center";
    }
    return undefined;
  };
  const getSecondaryActionToast = (dishCard) => {
    if (dishCard?.owner === userId && !isForeignProfileContext && !isPublicSource) return undefined;
    if (isToTrySource && !isForeignProfileContext) return "Moved to DishList";
    return undefined;
  };
  const backFallback = (() => {
    if (returnTo) {
      return returnTo;
    }
    const params = new URLSearchParams();
    if (source === "dishlist" && listId) {
      params.set("list", listId);
    } else if (source && source !== "public") {
      params.set("list", source);
    }
    if (profileId) {
      return `/profile/${profileId}${params.toString() ? `?${params.toString()}` : ""}`;
    }
    return `/profile${params.toString() ? `?${params.toString()}` : ""}`;
  })();

  const toggleEditTag = (tag) => {
    setEditTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 6) return prev;
      return [...prev, tag];
    });
  };

  useEffect(() => {
    if (!editTagUserPickerOpen) return undefined;
    let active = true;
    (async () => {
      setEditTagUsersLoading(true);
      try {
        const snap = await getDocs(collection(db, "users"));
        const usersList = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((candidate) => candidate.id !== user?.uid);
        if (active) setEditTaggableUsers(usersList);
      } finally {
        if (active) setEditTagUsersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editTagUserPickerOpen, user?.uid]);

  const filteredEditTaggableUsers = editTaggableUsers.filter((candidate) =>
    (candidate.displayName || "").toLowerCase().includes(editTagUserSearch.trim().toLowerCase())
  );

  const clearEditPreviewObjectUrl = () => {
    if (!editPreviewObjectUrlRef.current) return;
    URL.revokeObjectURL(editPreviewObjectUrlRef.current);
    editPreviewObjectUrlRef.current = "";
  };

  const applyEditMediaFile = (file) => {
    if (!file) return;
    clearEditPreviewObjectUrl();
    const nextPreview = URL.createObjectURL(file);
    editPreviewObjectUrlRef.current = nextPreview;
    setEditImageFile(file);
    setEditPreview(nextPreview);
  };

  const handleEditImageChange = (file) => {
    if (!file) return;
    setEditMediaPickerOpen(false);
    if (file.type?.startsWith("image/")) {
      setEditImageFramingFile(file);
      return;
    }
    applyEditMediaFile(file);
  };

  const openEditLibraryPicker = () => {
    setEditMediaPickerOpen(false);
    if (editLibraryInputRef.current) {
      editLibraryInputRef.current.value = "";
    }
    editLibraryInputRef.current?.click();
  };

  const openEditCameraPicker = () => {
    setEditMediaPickerOpen(false);
    if (editCameraInputRef.current) {
      editCameraInputRef.current.value = "";
    }
    editCameraInputRef.current?.click();
  };

  const openCurrentImageFraming = async () => {
    const currentImageUrl = editPreview || getDishImageUrl(editingDish);
    if (!currentImageUrl || editImageFile?.type?.startsWith("video/") || isDishVideo(editingDish)) return;
    setEditMediaPickerOpen(false);
    try {
      const canFetchDirectly = currentImageUrl.startsWith("blob:") || currentImageUrl.startsWith("data:");
      const sourceUrl = canFetchDirectly
        ? currentImageUrl
        : `/api/image-proxy?url=${encodeURIComponent(currentImageUrl)}`;
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Could not load current image.");
      const blob = await response.blob();
      const type = blob.type || "image/jpeg";
      const extension = type.includes("png") ? "png" : "jpg";
      const baseName = editName.trim() || "dish";
      setEditImageFramingFile(new File([blob], `${baseName}-current.${extension}`, { type }));
    } catch (err) {
      console.error("Failed to open current image for framing:", err);
      setPageToastVariant("error");
      setPageToast("Could not open current photo");
      setTimeout(() => setPageToast(""), 1400);
    }
  };

  const openEditModal = (dishToEdit) => {
    if (!dishToEdit || dishToEdit?.owner !== userId) return;
    clearEditPreviewObjectUrl();
    setEditingDish(dishToEdit);
    setEditName(dishToEdit?.name || "");
    setEditDescription(dishToEdit?.description || "");
    setEditDishLink(dishToEdit?.dishLink || "");
    setEditTaggedUser(dishToEdit?.taggedUserName || "");
    setEditTaggedUserId(dishToEdit?.taggedUserId || "");
    setEditRating(Number(dishToEdit?.rating || 0));
    setEditPrice(dishToEdit?.price || dishToEdit?.priceAmount || dishToEdit?.restaurantPrice ? String(dishToEdit.price || dishToEdit.priceAmount || dishToEdit.restaurantPrice) : "");
    setEditPriceCurrency(dishToEdit?.priceCurrency || dishToEdit?.currency || "EUR");
    setEditRecipeIngredients(dishToEdit?.recipeIngredients || "");
    setEditRecipeMethod(dishToEdit?.recipeMethod || "");
    const normalizedTags = Array.isArray(dishToEdit?.tags)
      ? Array.from(
          new Set(
            dishToEdit.tags
              .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
              .filter(Boolean)
          )
        ).slice(0, 6)
      : [];
    setEditTags(normalizedTags);
    setEditIsPublic(dishToEdit?.isPublic !== false);
    setEditDishMode(dishToEdit?.dishMode || DISH_MODE_COOKING);
    setEditRestaurant(dishToEdit?.restaurant || null);
    setEditImageFile(null);
    setEditImageFramingFile(null);
    setEditMediaPickerOpen(false);
    setEditTagUserPickerOpen(false);
    setEditTagUserSearch("");
    setEditComposerDetailsOpen(true);
    setEditPreview(
      dishToEdit?.imageURL || dishToEdit?.imageUrl || dishToEdit?.image_url || dishToEdit?.image || ""
    );
    setEditStep(0);
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditingDish(null);
    setEditImageFramingFile(null);
    setEditMediaPickerOpen(false);
    setEditTagUserPickerOpen(false);
    setEditTagUserSearch("");
    clearEditPreviewObjectUrl();
    if (openEditOnLoad && returnTo) {
      router.push(returnTo);
    }
  };

  useEffect(() => {
    return () => {
      clearEditPreviewObjectUrl();
    };
  }, []);

  useEffect(() => {
    if (!openEditOnLoad || editOpen || loadingDish || !dish || dish.owner !== userId) return;
    openEditModal(dish);
  }, [dish, editOpen, loadingDish, openEditOnLoad, userId]);

  useEffect(() => {
    if (editOpen && editDishMode !== DISH_MODE_RESTAURANT && editRating !== 0) {
      setEditRating(0);
    }
  }, [editDishMode, editOpen, editRating]);

  useEffect(() => {
    if (!editOpen || editStep !== 3 || savingEdit) return undefined;
    const name = editName.trim();
    if (!name || editTags.length > 0) return undefined;
    let active = true;
    (async () => {
      const suggestedTags = await suggestDishTagsFromName(name, editDishMode);
      if (!active || !suggestedTags.length) return;
      setEditTags((prev) => (prev.length ? prev : suggestedTags.slice(0, 6)));
    })();
    return () => {
      active = false;
    };
  }, [editDishMode, editName, editOpen, editStep, editTags.length, savingEdit]);

  const handleSaveEdit = async () => {
    if (!editingDish?.id || !userId) return;
    if (editingDish.owner !== userId) {
      alert("You can only edit your own uploaded dishes.");
      return;
    }
    if (!editName.trim()) {
      alert("Dish name is required.");
      return;
    }
    if (editDishMode === DISH_MODE_RESTAURANT && !editRestaurant?.placeId) {
      alert(t("Restaurant is required"));
      return;
    }

    setSavingEdit(true);
    try {
      let nextImageURL =
        editingDish.imageURL || editingDish.imageUrl || editingDish.image_url || editingDish.image || "";
      let nextCardURL = editingDish.cardURL || "";
      let nextThumbURL = editingDish.thumbURL || editingDish.thumbnailURL || "";
      let nextMediaType =
        editingDish.mediaType ||
        (editingDish.mediaMimeType?.startsWith("video/") ? "video" : "image");
      let nextMediaMimeType = editingDish.mediaMimeType || "";
      if (editImageFile) {
        const uploaded = await uploadDishImageVariants(editImageFile, userId);
        if (uploaded.imageURL) {
          if (nextImageURL && nextImageURL !== uploaded.imageURL) {
            await deleteImageByUrl(nextImageURL);
          }
          nextImageURL = uploaded.imageURL;
          nextCardURL = uploaded.cardURL;
          nextThumbURL = uploaded.thumbURL;
          nextMediaType = uploaded.mediaType || nextMediaType;
          nextMediaMimeType = uploaded.mediaMimeType || nextMediaMimeType;
        }
      }

      const normalizedEditPrice = Number(String(editPrice).replace(/[^\d.,]/g, "").replace(",", "."));
      const editPricePayload = Number.isFinite(normalizedEditPrice) && normalizedEditPrice > 0
        ? normalizedEditPrice
        : null;
      const updates = {
        name: editName.trim(),
        description: editDescription.trim(),
        dishLink: editDishLink.trim(),
        taggedUserName: editTaggedUser.trim(),
        taggedUserId: editTaggedUserId || "",
        recipeIngredients: editDishMode === DISH_MODE_RESTAURANT ? "" : editRecipeIngredients.trim(),
        recipeMethod: editDishMode === DISH_MODE_RESTAURANT ? "" : editRecipeMethod.trim(),
        tags: editTags,
        rating: editDishMode === DISH_MODE_RESTAURANT ? editRating : 0,
        price: editPricePayload,
        priceAmount: editPricePayload,
        restaurantPrice: editPricePayload,
        priceCurrency: editPricePayload ? editPriceCurrency : "",
        currency: editPricePayload ? editPriceCurrency : "",
        isPublic: editIsPublic,
        dishMode: editDishMode,
        restaurant: editDishMode === DISH_MODE_RESTAURANT ? editRestaurant : null,
        imageURL: nextImageURL || "",
        cardURL: nextCardURL || nextImageURL || "",
        thumbURL: nextThumbURL || nextCardURL || nextImageURL || "",
        mediaType: nextMediaType,
        mediaMimeType: nextMediaMimeType,
      };

      await updateDishAndSavedCopies(editingDish.id, updates);
      clearSessionPageCache("feed:");
      clearSessionPageCache("explore:");
      clearSessionPageCache("people:");
      clearSessionPageCache("profile:");

      setDish((prev) => (prev?.id === editingDish.id ? { ...prev, ...updates } : prev));
      setDeckList((prev) =>
        prev.map((item) => (item.id === editingDish.id ? { ...item, ...updates } : item))
      );

      setEditOpen(false);
      setEditingDish(null);
      setEditImageFramingFile(null);
      setEditMediaPickerOpen(false);
      setEditTagUserPickerOpen(false);
      setEditTagUserSearch("");
      clearEditPreviewObjectUrl();
      setPageToastVariant("success");
      setPageToast("Dish updated");
      setTimeout(() => setPageToast(""), 1200);
      if (openEditOnLoad && returnTo) {
        router.push(returnTo);
      }
    } catch (err) {
      console.error("Failed to update dish:", err);
      setPageToastVariant("error");
      setPageToast("Update failed");
      setTimeout(() => setPageToast(""), 1200);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEditedDish = async () => {
    if (!editingDish?.id || !userId) return;
    if (!confirm("Delete this dish?")) return;
    try {
      await deleteDishAndImage(
        editingDish.id,
        editingDish.imageURL || editingDish.imageUrl || editingDish.image_url || editingDish.image
      );
      await removeDishFromAllUsers(editingDish.id);
      setRemovedDishIds((prev) => {
        const next = new Set(prev);
        next.add(editingDish.id);
        return next;
      });
      setDeckList((prev) => prev.filter((item) => item.id !== editingDish.id));
      setDish((prev) => (prev?.id === editingDish.id ? null : prev));
      setEditOpen(false);
      setEditingDish(null);
      setPageToastVariant("success");
      setPageToast("Dish deleted");
      setTimeout(() => setPageToast(""), 1200);
      if (deckList.length <= 1) {
        router.back();
      }
    } catch (err) {
      console.error("Failed to delete dish:", err);
      alert("Failed to delete dish.");
    }
  };

  const handleOpenSavers = async (dishCard) => {
    setSaversOpen(true);
    setSaversLoading(true);
    try {
      const usersList = await getUsersWhoSavedDish(dishCard?.id);
      setSaversUsers(usersList);
    } finally {
      setSaversLoading(false);
    }
  };

  const handleShare = (dishCard) => {
    if (!userId) {
      alert("Please sign in to share.");
      return;
    }
    setShareDish(dishCard);
    setShareOpen(true);
  };

  const handleAddToStory = async (dishCard) => {
    if (!userId || !dishCard?.id) {
      setPageToastVariant("neutral");
      setPageToast("Please sign in");
      setTimeout(() => setPageToast(""), 1200);
      return false;
    }
    setProfileCardActionsDish(null);
    setStoryMealTagDish(dishCard);
    return { skipToast: true };
  };

  const publishStoryMealTagDish = async (storyMealTag) => {
    if (!userId || !storyMealTagDish?.id) return false;
    const ok = await publishDishAsStory(userId, storyMealTagDish, { storyMealTag });
    if (ok) {
      const stats = await getStoryPushStatsForUser(userId);
      setStoryPushStats(stats);
    }
    setStoryMealTagDish(null);
    setPageToastVariant(ok ? "success" : "error");
    setPageToast(ok ? "Story published" : "Story failed");
    setTimeout(() => setPageToast(""), 1200);
    return ok;
  };

  const openProfileCardActions = (dishCard) => {
    if (!dishCard?.id) return false;
    setProfileCardActionsDish(dishCard);
    return { skipToast: true };
  };

  const handleDishlistSelect = async () => {
    if (!userId || !dishlistPickerDish?.id) return;
    const selectedSet = new Set(selectedDishlistIds);
    const persistDishlistIds = selectedDishlistIds.filter(
      (dishlistId) => dishlistId !== "all_dishes" && !(dishlistId === "to_try" && selectedSet.has("saved"))
    );
    const currentIds = new Set(
      dishlists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dishlistPickerDish.id))
        .map((dishlist) => dishlist.id)
    );
    const nextIds = new Set(persistDishlistIds);
    const addResults = await Promise.all(
      persistDishlistIds.map((dishlistId) =>
        saveDishToSelectedDishlist(userId, dishlistId, dishlistPickerDish)
      )
    );
    const removeResults = await Promise.all(
      Array.from(currentIds)
        .filter((dishlistId) => !nextIds.has(dishlistId))
        .map((dishlistId) => {
          if (dishlistId === "saved") return removeSavedDishFromUser(userId, dishlistPickerDish.id);
          if (dishlistId === "to_try") return removeDishFromToTry(userId, dishlistPickerDish.id);
          return removeDishFromCustomDishlist(userId, dishlistId, dishlistPickerDish.id);
        })
    );
    const ok = addResults.every(Boolean) && removeResults.every(Boolean);
    setPageToastVariant(ok ? "success" : "error");
    setPageToast(ok ? "Added to DishList" : "Save failed");
    setTimeout(() => setPageToast(""), 1200);
    if (ok) {
      setDishlistPickerOpen(false);
      setDishlistPickerDish(null);
      setLockedDishlistIds([]);
    }
  };

  const goToNextEditStep = () => {
    if (editStep === 1 && !editName.trim()) {
      alert("Dish name is required.");
      return;
    }
    if (editStep === 2 && editDishMode === DISH_MODE_RESTAURANT && !editRestaurant?.placeId) {
      alert(t("Restaurant is required"));
      return;
    }
    setEditStep((prev) => {
      const nextStep = Math.min(prev + 1, EDIT_COMPOSER_STEPS.length - 1);
      if (nextStep === 2) setEditComposerDetailsOpen(true);
      return nextStep;
    });
  };

  const goToPreviousEditStep = () => {
    setEditStep((prev) => {
      const nextStep = Math.max(prev - 1, 0);
      if (nextStep !== 2) setEditComposerDetailsOpen(true);
      return nextStep;
    });
  };

  const renderEditGuidedComposer = () => {
    const isRestaurantEdit = editDishMode === DISH_MODE_RESTAURANT;
    const previewName = editName.trim() || (language === "it" ? "Nome piatto" : "Dish name");
    const previewDescription = editDescription.trim();
    const editPriceSymbol = PRICE_CURRENCIES.find((currency) => currency.code === editPriceCurrency)?.symbol || "€";
    const detailLabel = isRestaurantEdit ? "ristorante" : "ricetta";
    const detailAccent = isRestaurantEdit ? "#B93A32" : "#FFC247";
    const detailTextColor = isRestaurantEdit ? "#FFE7C7" : "#050505";
    const composerAccent = isRestaurantEdit ? "#E64646" : "#E4B43F";
    const showGhostModeStep = editStep === 0;
    const showNameInputs = editStep === 1;
    const showDetailsStep = editStep === 2 && editComposerDetailsOpen;
    const showTagsStep = editStep === 3;
    const showExtraStep = editStep === 4;
    const showReviewStep = editStep === 5;
    const hideBaseText = showGhostModeStep || showDetailsStep || showTagsStep || showExtraStep;
    const pillShowsFrontSelected = showExtraStep || showReviewStep;
    const classicBottomShade =
      "linear-gradient(to top, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.72) 34%, rgba(0,0,0,0.46) 62%, rgba(0,0,0,0.18) 82%, rgba(0,0,0,0) 100%)";
    const ghostTextColor = "rgba(141,141,148,0.58)";
    const ghostSoftTextColor = "rgba(141,141,148,0.48)";
    const tagPreview = editTags.slice(0, 3);
    const showTopRestaurant = isRestaurantEdit && editRestaurant?.name;
    const actualTopIdentity = (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[30] h-32 bg-gradient-to-b from-black/50 via-black/22 via-55% to-transparent" />
        <div className="pointer-events-none absolute left-4 top-4 z-[31] flex max-w-[14.5rem] items-center gap-2 text-white">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${isRestaurantEdit ? "border-[#E64646]" : "border-[#E4B43F]"} bg-black/35 text-sm font-bold`}>
            {user?.photoURL ? <img src={user.photoURL} alt="You" className="h-full w-full object-cover" /> : (user?.displayName?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.98rem] font-semibold leading-tight">{user?.displayName || "You"}</p>
            <div className="mt-0.5 truncate text-[0.82rem] font-medium leading-none text-white/75">{language === "it" ? "ora" : "now"}</div>
          </div>
        </div>
        {showTopRestaurant ? (
          <div className="pointer-events-none absolute left-4 top-[4.4rem] z-[32] max-w-[13.5rem] truncate rounded-full border border-[#E64646]/18 bg-[rgba(35,12,12,0.76)] px-3.5 py-[0.42rem] text-[12px] font-semibold leading-none text-white shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[10px]">
            {editRestaurant.name}
          </div>
        ) : null}
      </>
    );

    return (
      <motion.div className="w-full max-w-md mx-auto pt-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-3 pt-1 flex items-center justify-between gap-4">
          <div className="h-11 w-11 shrink-0" />
          <div className="mt-3 flex flex-1 justify-center gap-2">
            {EDIT_COMPOSER_STEPS.map((step, index) => (
              <span
                key={step}
                className={`no-accent-border h-1.5 rounded-full transition-all ${
                  index <= editStep
                    ? index === 0
                      ? "w-10 bg-[#E64646]"
                      : index === 1
                        ? "w-10 bg-[#F59E0B]"
                        : index === 2
                          ? "w-10 bg-[#23C268]"
                          : index === 3
                            ? "w-10 bg-[#38BDF8]"
                            : index === 4
                              ? "w-10 bg-[#8B5CF6]"
                              : "w-10 bg-[#2BD36B]"
                    : "w-7 bg-transparent"
                }`}
                style={index > editStep ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.92)" } : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={closeEditModal}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${darkMode ? "border-white/16 bg-white/7 text-white/72" : "border-black/10 bg-white/88 text-black/60"}`}
            aria-label="Close edit modal"
          >
            <X size={17} />
          </button>
        </div>

        <div className={`dish-card-shell relative h-[74vh] max-h-[39rem] min-h-[32rem] overflow-hidden rounded-[28px] bg-white ${isRestaurantEdit ? "dish-card-shell--restaurant" : "dish-card-shell--default"}`}>
          {editPreview ? (
            editImageFile?.type?.startsWith("video/") || isDishVideo(editingDish) ? (
              <video src={editPreview} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline controls={false} />
            ) : (
              <img src={editPreview} alt="Dish preview" className="absolute inset-0 h-full w-full object-cover" />
            )
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(155deg,#252525_0%,#0A0A0A_100%)]" />
          )}

          {showNameInputs && !editPreview ? (
            <button
              type="button"
              onClick={() => setEditMediaPickerOpen(true)}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3 text-white"
              style={{ transform: "translateY(-2.15rem)" }}
            >
              <div
                className={`flex h-[4.85rem] w-[4.85rem] items-center justify-center rounded-[1.4rem] border-2 text-white shadow-[0_18px_38px_rgba(0,0,0,0.28)] ${
                  isRestaurantEdit ? "restaurant-accent-border" : "default-accent-border"
                }`}
                style={{
                  background: isRestaurantEdit
                    ? "linear-gradient(135deg,rgba(230,70,70,0.98)_0%,rgba(120,24,24,0.98)_100%)"
                    : "linear-gradient(135deg,rgba(228,180,63,0.98)_0%,rgba(122,88,14,0.98)_100%)",
                }}
              >
                <Camera size={28} />
              </div>
              <div className="text-[1rem] font-bold">{language === "it" ? "Carica foto o video" : "Add photo or video"}</div>
            </button>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[12]" style={{ height: "48%", background: classicBottomShade }} />
          {actualTopIdentity}

          {showGhostModeStep ? (
            <>
              <div className="absolute left-5 right-5 top-[6.1rem] z-[14] text-center">
                <div className="mb-4 text-[1.2rem] font-semibold leading-tight text-white/88">
                  {language === "it" ? "Che piatto vuoi modificare?" : "What dish do you want to edit?"}
                </div>
                <div className="mx-auto grid max-w-[21rem] grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDishMode(DISH_MODE_COOKING);
                      setEditRestaurant(null);
                    }}
                    className={`h-[13rem] rounded-[1.15rem] border px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition active:scale-[0.985] ${
                      editDishMode === DISH_MODE_COOKING
                        ? "border-[#FFBF3C] bg-[#4A340B] text-[#FFF0BC]"
                        : darkMode ? "border-white/12 bg-[#181818] text-white/70" : "border-black/10 bg-[#FFFDFC] text-black/70"
                    }`}
                  >
                    <div className="flex h-full flex-col items-start justify-between text-left">
                      <span className={`inline-flex h-[6.1rem] w-full shrink-0 items-center justify-center rounded-[1.05rem] ${editDishMode === DISH_MODE_COOKING ? "border-2 border-[#FFBF3C] bg-[#FFF3BE] text-[#E8A900]" : "border border-[#F0A623]/45 bg-[#2A210A] text-[#F0A623]"}`}>
                        <CookingHomeIcon className="h-[3.15rem] w-[3.15rem]" strokeWidth={2} />
                      </span>
                      <div className="w-full truncate text-center text-[1.24rem] font-semibold leading-none">Casa</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDishMode(DISH_MODE_RESTAURANT)}
                    className={`h-[13rem] rounded-[1.15rem] border px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition active:scale-[0.985] ${
                      editDishMode === DISH_MODE_RESTAURANT
                        ? "border-[#FF6B5F] bg-[#4A1414] text-[#FFE2DE]"
                        : darkMode ? "border-white/12 bg-[#181818] text-white/70" : "border-black/10 bg-[#FFFDFC] text-black/70"
                    }`}
                  >
                    <div className="flex h-full flex-col items-start justify-between text-left">
                      <span className={`inline-flex h-[6.1rem] w-full shrink-0 items-center justify-center rounded-[1.05rem] ${editDishMode === DISH_MODE_RESTAURANT ? "border-2 border-[#FF6B5F] bg-[#2A0A0A] text-[#FF7D72]" : "border border-[#E64646]/45 bg-[#2A1111] text-[#E64646]"}`}>
                        <RestaurantForkKnifeIcon className="h-[2.65rem] w-[2.65rem]" strokeWidth={2} />
                      </span>
                      <div className="w-full truncate text-center text-[1.24rem] font-semibold leading-none">Ristorante</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="absolute left-5 right-5 z-[13]" style={{ bottom: "5.8rem" }}>
                <button type="button" onClick={() => setEditStep(1)} className="block text-left text-2xl font-bold leading-tight" style={{ color: editName.trim() ? "rgba(255,255,255,0.98)" : ghostTextColor }}>
                  {editName.trim() || (language === "it" ? "Nome piatto" : "Dish name")}
                </button>
                <button type="button" onClick={() => setEditStep(1)} className="mt-0.5 block line-clamp-2 text-left text-sm font-medium" style={{ color: editDescription.trim() ? "rgba(255,255,255,0.8)" : ghostSoftTextColor }}>
                  {editDescription.trim() || (language === "it" ? "Descrizione" : "Description")}
                </button>
                {isRestaurantEdit ? (
                  <button type="button" onClick={() => setEditStep(2)} className="mt-1 flex items-center gap-2" style={{ color: editRating || editPrice ? "rgba(255,255,255,0.8)" : ghostSoftTextColor }}>
                    <div className="inline-flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={index} className="text-[1.05rem] leading-none">{index < Number(editRating || 0) ? "★" : "☆"}</span>
                      ))}
                    </div>
                    {editPrice ? <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90">{editPriceSymbol}{editPrice}</span> : null}
                  </button>
                ) : null}
                <div className="mt-2 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={() => setEditStep(4)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/18 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-[6px]"
                    style={{ color: editDishLink.trim() ? "rgba(255,255,255,0.92)" : "rgba(141,141,148,0.7)" }}
                  >
                    <span>{editDishLink.trim() ? "Link" : "Link"}</span>
                    <CornerUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStep(4)}
                    className="mt-1 inline-flex max-w-full items-center rounded-full bg-black/18 px-3 py-1 text-[11px] font-semibold backdrop-blur-[6px]"
                    style={{ color: editTaggedUser.trim() ? "rgba(255,255,255,0.92)" : "rgba(141,141,148,0.7)" }}
                  >
                    {editTaggedUser.trim() ? `@${editTaggedUser.replace(/^@+/, "")}` : "@tag utente"}
                  </button>
                </div>
                <button type="button" onClick={() => setEditStep(3)} className="mt-2 flex flex-wrap gap-1.5 text-left">
                  {tagPreview.length ? tagPreview.map((tag) => (
                    <span key={tag} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border-2 ${darkMode ? getDarkTagChipClass(tag, true) : getTagChipClass(tag, true)}`}>
                      {tag}
                    </span>
                  )) : (
                    <span className="rounded-full bg-black/18 px-3 py-1 text-[11px] font-semibold backdrop-blur-[6px]" style={{ color: "rgba(141,141,148,0.7)" }}>
                      {language === "it" ? "Tag" : "Tags"}
                    </span>
                  )}
                </button>
              </div>

              <button type="button" onClick={() => setEditStep(2)} className="absolute left-5 z-[24] inline-flex h-8 items-center gap-1" style={{ bottom: "2.25rem" }}>
                <span className="inline-flex h-7 items-center rounded-full border px-2.5 text-[13px] font-semibold leading-none" style={{ borderColor: "rgba(141,141,148,0.24)", backgroundColor: "rgba(0,0,0,0.14)", color: "rgba(141,141,148,0.56)" }}>
                  piatto
                </span>
                <span className="inline-flex h-7 items-center rounded-full border px-2.5 text-[13px] font-semibold leading-none" style={{ borderColor: "rgba(141,141,148,0.24)", backgroundColor: "rgba(0,0,0,0.14)", color: "rgba(141,141,148,0.56)" }}>
                  {isRestaurantEdit ? "ristorante" : "ricetta"}
                </span>
              </button>
            </>
          ) : null}

          {editStep >= 2 ? (
            <div className="pointer-events-none absolute left-5 z-[24]" style={{ bottom: "2.25rem" }}>
              <div className="pointer-events-auto no-accent-border inline-flex h-8 items-center gap-0.5 rounded-full bg-black/72 p-0.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur-md">
                <span className="no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none" style={pillShowsFrontSelected ? { backgroundColor: detailAccent, color: detailTextColor, WebkitTextFillColor: detailTextColor } : undefined}>
                  piatto
                </span>
                <span className="no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none" style={!pillShowsFrontSelected ? { backgroundColor: detailAccent, color: detailTextColor, WebkitTextFillColor: detailTextColor } : undefined}>
                  {detailLabel}
                </span>
              </div>
            </div>
          ) : null}

          {showDetailsStep ? (
            <motion.div className="absolute inset-0 z-[18]" style={{ transformStyle: "preserve-3d" }} initial={{ rotateY: 92, opacity: 0.35 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.34, ease: "easeInOut" }}>
              <div className={`absolute inset-0 overflow-y-auto p-5 pb-24 text-white ${isRestaurantEdit ? "bg-[linear-gradient(180deg,rgba(49,15,15,0.98)_0%,rgba(15,10,10,0.98)_100%)]" : "bg-[linear-gradient(180deg,rgba(38,29,7,0.98)_0%,rgba(12,11,8,0.98)_100%)]"}`}>
                <div className="space-y-3 pt-16">
                  <div className="mb-2">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
                      {isRestaurantEdit ? (language === "it" ? "Luogo" : "Place") : (language === "it" ? "Ricetta" : "Recipe")}
                    </div>
                  </div>
                  {isRestaurantEdit ? (
                    <>
                      <RestaurantPlacePicker value={editRestaurant} onChange={setEditRestaurant} placeholder={language === "it" ? "Cerca ristorante" : "Search restaurant"} label="" accent="restaurant" />
                      <div className="rounded-[1rem] border border-white/10 bg-white/8 px-3 py-3">
                        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/42">{language === "it" ? "Valutazione" : "Rating"}</div>
                        <RatingStars value={editRating} onChange={setEditRating} size="text-[1.45rem]" />
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input type="text" inputMode="decimal" placeholder={language === "it" ? "Prezzo" : "Price"} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="min-w-0 rounded-full border border-white/10 bg-white px-4 py-3 text-[16px] text-black focus:outline-none" style={{ fontSize: 16 }} disabled={savingEdit} />
                        <select value={editPriceCurrency} onChange={(e) => setEditPriceCurrency(e.target.value)} className="rounded-full border border-white/10 bg-white px-3 py-3 text-[16px] font-semibold text-black focus:outline-none" style={{ fontSize: 16 }} disabled={savingEdit}>
                          {PRICE_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.symbol}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <IngredientBulletTextarea placeholder={language === "it" ? "Ingredienti" : "Ingredients"} value={editRecipeIngredients} onChange={setEditRecipeIngredients} className="w-full rounded-[1rem] border border-[#E4B43F]/55 bg-white px-4 py-3 text-[16px] text-black focus:outline-none" rows={5} disabled={savingEdit} />
                      <textarea placeholder={language === "it" ? "Procedimento" : "Method"} value={editRecipeMethod} onChange={(e) => setEditRecipeMethod(e.target.value)} className="w-full resize-none rounded-[1rem] border border-white/10 bg-white px-4 py-3 text-[16px] text-black focus:outline-none" style={{ fontSize: 16 }} rows={6} disabled={savingEdit} />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}

          {showTagsStep || showExtraStep ? (
            <motion.div className="absolute inset-0 z-[19]" style={{ transformStyle: "preserve-3d", perspective: 1600 }} initial={showTagsStep ? false : { rotateY: 0 }} animate={{ rotateY: showExtraStep ? 180 : 0 }} transition={{ duration: 0.38, ease: [0.22, 0.72, 0.2, 1] }}>
              <div className="absolute inset-0 overflow-y-auto bg-[linear-gradient(180deg,rgba(16,16,20,0.985)_0%,rgba(8,8,10,0.985)_100%)] p-5 pb-24" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <div className="mb-4 pt-16">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{language === "it" ? "Tag" : "Tags"}</div>
                </div>
                <div className="flex flex-wrap content-start gap-2">
                  {TAG_OPTIONS.map((tag) => {
                    const active = editTags.includes(tag);
                    return (
                      <button key={tag} type="button" onClick={() => toggleEditTag(tag)} className={`px-3 py-1 rounded-full text-xs border-2 transition ${darkMode ? getDarkTagChipClass(tag, active) : getTagChipClass(tag, active)}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="absolute inset-0" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                {editPreview ? (
                  editImageFile?.type?.startsWith("video/") || isDishVideo(editingDish) ? (
                    <video src={editPreview} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline controls={false} />
                  ) : (
                    <img src={editPreview} alt="Dish preview" className="absolute inset-0 h-full w-full object-cover" />
                  )
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(155deg,#252525_0%,#0A0A0A_100%)]" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[12]" style={{ height: "48%", background: classicBottomShade }} />
                <div className="absolute left-5 right-5 z-[13] text-white" style={{ bottom: "5.8rem" }}>
                  <div className="text-left text-2xl font-bold leading-tight">{previewName}</div>
                  {previewDescription ? <p className="mt-0.5 line-clamp-2 text-sm font-medium text-white/80">{previewDescription}</p> : null}
                  {isRestaurantEdit ? (
                    <div className="mt-1 flex items-center gap-2">
                      <RatingStars value={editRating} size="text-[1.05rem]" readOnly />
                      {editPrice ? <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90">{editPriceSymbol}{editPrice}</span> : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setEditTagUserPickerOpen(true)} className="inline-flex h-10 w-fit max-w-full items-center rounded-[1rem] border-[2px] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)]" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                      {editTaggedUser ? `@${editTaggedUser.replace(/^@+/, "")}` : language === "it" ? "Tagga utente" : "Tag user"}
                    </button>
                    <button type="button" className="inline-flex h-10 w-fit max-w-full items-center rounded-[1rem] border-[2px] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)]" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                      {editDishLink ? "Link" : language === "it" ? "Aggiungi link" : "Add link"}
                    </button>
                    <input type="text" placeholder="https://..." value={editDishLink} onChange={(e) => setEditDishLink(e.target.value)} inputMode="url" enterKeyHint="done" className="w-full rounded-[1rem] border-[2px] px-4 py-3 text-[16px] text-white placeholder:text-white/55 focus:outline-none" style={{ fontSize: 16, backgroundColor: "rgba(7,7,7,0.88)", borderColor: "rgba(255,255,255,0.18)" }} disabled={savingEdit} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}

          <div className="absolute right-6 z-[26] flex items-center gap-2" style={{ bottom: "1.25rem" }}>
            {editStep >= 1 ? (
              <button type="button" onClick={goToPreviousEditStep} disabled={savingEdit} className="dish-modal-back-btn flex h-14 w-14 items-center justify-center rounded-full transition" aria-label="Back">
                <ArrowLeft size={20} />
              </button>
            ) : null}
            {showReviewStep ? (
              <button type="button" onClick={handleSaveEdit} className="dish-modal-primary-btn flex h-14 items-center justify-center rounded-full px-5 text-sm font-bold transition" disabled={savingEdit}>
                {savingEdit ? t("Saving...") : t("Save")}
              </button>
            ) : (
              <button type="button" onClick={goToNextEditStep} disabled={savingEdit} className="dish-modal-next-btn flex h-14 w-14 items-center justify-center rounded-full transition" aria-label="Next">
                <ArrowRight size={22} />
              </button>
            )}
          </div>

          <div className="absolute left-5 right-5 z-[13] text-white" style={{ bottom: "5.8rem" }}>
            {!hideBaseText && showNameInputs ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={language === "it" ? "Nome del piatto" : "Dish name"}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    enterKeyHint="next"
                    className="w-full rounded-[1.15rem] border-[3px] px-5 py-3.5 pl-11 text-left text-[21px] font-bold leading-tight text-white placeholder:text-white/76 focus:outline-none"
                    style={{ fontSize: 21, borderColor: composerAccent, backgroundColor: "rgba(8,8,8,0.9)", boxShadow: `0 0 0 1px ${composerAccent}` }}
                    disabled={savingEdit}
                  />
                  <div className="pointer-events-none absolute left-4 top-1/2 z-[2] -translate-y-1/2 text-white/76">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 20L8.5 18.9L18.2 9.2C19.3 8.1 19.3 6.3 18.2 5.2V5.2C17.1 4.1 15.3 4.1 14.2 5.2L4.5 14.9L4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13 6.5L17 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <textarea placeholder={language === "it" ? "Aggiungi una descrizione" : "Add a description"} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={`mt-1 w-full resize-none rounded-[0.9rem] border bg-black/22 px-3 py-2 text-[16px] font-medium leading-snug text-white/82 placeholder:text-white/62 focus:outline-none ${isRestaurantEdit ? "border-[#E64646]/45" : "border-[#E4B43F]/45"}`} style={{ fontSize: 16 }} rows={2} disabled={savingEdit} />
              </>
            ) : !hideBaseText ? (
              <>
                <div className="text-left text-2xl font-bold leading-tight">{previewName}</div>
                {previewDescription ? <p className="mt-0.5 line-clamp-2 text-sm font-medium text-white/80">{previewDescription}</p> : null}
                {showReviewStep && (editTaggedUser || editDishLink) ? (
                  <div className="mt-2 flex flex-col items-start gap-1">
                    {editDishLink ? (
                      <div className="no-accent-border inline-flex shrink-0 items-center gap-1 rounded-full bg-black/68 px-2.5 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        <span>Link</span>
                        <CornerUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </div>
                    ) : null}
                    {editTaggedUser ? (
                      <div className="no-accent-border inline-flex max-w-full items-center rounded-full bg-black/68 px-3 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        @{String(editTaggedUser).replace(/^@+/, "")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {!hideBaseText && editStep >= 1 && isRestaurantEdit ? (
              <div className="mt-1 flex items-center gap-2">
                <RatingStars value={editRating} size="text-[1.05rem]" readOnly />
                {editPrice ? <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90">{editPriceSymbol}{editPrice}</span> : null}
              </div>
            ) : null}
          </div>

          {showReviewStep ? (
            <button type="button" onClick={handleDeleteEditedDish} className="absolute left-5 bottom-[1.3rem] z-[26] rounded-full border border-[#E25555]/22 bg-[#2A1010]/92 px-4 py-3 text-sm font-semibold text-[#FF9B9B] shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-md">
              {t("Delete")}
            </button>
          ) : null}
        </div>
      </motion.div>
    );
  };

  if (loading || loadingDish) {
    return <FullScreenLoading title="Loading dish" />;
  }

  if (!user && !isPublicSource) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Please sign in.
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Dish not found.
      </div>
    );
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-hidden overscroll-none bg-transparent text-black relative flex flex-col">
      <div className="app-top-nav px-4 pb-1 flex items-center justify-between shrink-0">
        {enableProfileDeckNavigation ? (
          <>
            <button
              type="button"
              onClick={() => activeDeckRef.current?.previous?.()}
              className="mt-3 flex h-10 w-11 items-center justify-center rounded-[1rem] border-2 border-black/35 bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
              aria-label="Previous dish"
            >
              <ArrowLeft size={20} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={() => activeDeckRef.current?.next?.()}
              className="mt-3 flex h-10 w-11 items-center justify-center rounded-[1rem] border-2 border-black/35 bg-white/94 text-black shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.97]"
              aria-label="Next dish"
            >
              <ArrowRight size={20} strokeWidth={2.6} />
            </button>
          </>
        ) : (
          <>
            <AppBackButton fallback={backFallback} forceFallback={Boolean(returnTo)} />
            <div className="w-[74px]" />
          </>
        )}
      </div>

      <div className={`screen-between-navs-center px-5 ${editOpen ? "pointer-events-none" : ""}`}>
        <div className="w-full">
          <SwipeDeck
            ref={activeDeckRef}
            dishes={orderedList}
            initialIndex={initialDeckIndex}
            preserveContinuity
            disabled={editOpen}
            currentUser={user}
            onAction={shouldUseStoryActions ? openProfileCardActions : shouldUsePublicActions ? handleAdd : handleRemove}
            onSecondaryAction={!shouldUseStoryActions && (canManageOwnDish || (isToTrySource && !isForeignProfileContext)) ? (dishCard) => {
              if (dishCard?.owner === userId && !isForeignProfileContext && !isPublicSource) {
                openEditModal(dishCard);
                return;
              }
              if (isToTrySource && !isForeignProfileContext) {
                return handleUpgrade(dishCard);
              }
              return false;
            } : undefined}
            onSavesPress={handleOpenSavers}
            onSharePress={handleShare}
            onTertiaryAction={!shouldUseStoryActions && !isForeignProfileContext && !isPublicSource ? handleManageDishlists : undefined}
            onRightSwipe={enableProfileDeckNavigation ? undefined : shouldUsePublicActions ? handleRightSwipeToTry : undefined}
            actionOnRightSwipe={enableProfileDeckNavigation ? false : !shouldUsePublicActions}
            dismissOnAction={shouldUsePublicActions ? false : isPublicSource}
            dismissOnSecondaryAction={false}
            advanceOnAnySwipe={enableProfileDeckNavigation}
            onAuthRequired={() => alert("Please sign in to comment.")}
            actionLabel={shouldUseStoryActions ? <MoreHorizontal size={26} strokeWidth={2.35} /> : shouldUsePublicActions ? "+" : "Remove"}
            secondaryActionLabel={shouldUseStoryActions ? undefined : getSecondaryActionLabel}
            actionClassName={
              shouldUseStoryActions
                ? "add-action-btn w-14 h-14 text-[#2BD36B]"
                : shouldUsePublicActions
                  ? "add-action-btn w-14 h-14"
                  : "px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold shadow-lg"
            }
            tertiaryActionLabel={!shouldUseStoryActions && !isForeignProfileContext && !isPublicSource ? "list-plus" : undefined}
            tertiaryActionClassName="add-action-btn w-14 h-14"
            secondaryActionClassName={shouldUseStoryActions ? undefined : getSecondaryActionClassName}
            actionToast={
              shouldUseStoryActions
                ? undefined
                : shouldUsePublicActions
                  ? "Added to DishList"
                  : source === "saved"
                    ? "Removed from DishList"
                    : source === "uploaded"
                      ? "Dish deleted"
                      : "Removed from To Try"
            }
            secondaryActionToast={getSecondaryActionToast}
            trackSwipes={false}
            onResetFeed={handleResetDeck}
            storyPushStatsByDish={storyPushStats}
            showStoryHistoryCounter={!isPublicSource}
          />
        </div>
      </div>

      <AnimatePresence>
        {profileCardActionsDish ? (
          <motion.div
            className="fixed inset-0 z-[92] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileCardActionsDish(null)}
          >
            <motion.div
              className={`w-full max-w-md rounded-[1.7rem] border p-4 shadow-[0_26px_70px_rgba(0,0,0,0.35)] ${
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
                  src={getDishImageUrl(profileCardActionsDish, "thumb")}
                  alt={profileCardActionsDish?.name || "Dish"}
                  className="h-14 w-14 rounded-[1rem] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold">{profileCardActionsDish?.name || "Untitled dish"}</div>
                  <div className={`text-xs ${darkMode ? "text-white/50" : "text-black/50"}`}>{t("Dish actions")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileCardActionsDish(null)}
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
                    handleAddToStory(profileCardActionsDish);
                  }}
                  className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                    darkMode ? "border-[#38BDF8]/45 bg-[#0D2634] text-white" : "border-[#38BDF8]/45 bg-[#EFFAFF] text-black"
                  }`}
                >
                  <span>{t("Add to story")}</span>
                  <StoryStatIcon size={17} />
                </button>
                {profileCardActionsDish?.owner === userId && !isForeignProfileContext && !isPublicSource ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = profileCardActionsDish;
                      setProfileCardActionsDish(null);
                      openEditModal(target);
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
                    const target = profileCardActionsDish;
                    setProfileCardActionsDish(null);
                    handleManageDishlists(target);
                  }}
                  className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                    darkMode ? "border-[#2BD36B]/45 bg-[#102817] text-white" : "border-[#2BD36B]/45 bg-[#F4FFF7] text-black"
                  }`}
                >
                  <span>{t("Manage dishlists")}</span>
                  <ListChecks size={16} />
                </button>
                {isToTrySource && !isForeignProfileContext ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = profileCardActionsDish;
                      setProfileCardActionsDish(null);
                      handleUpgrade(target);
                    }}
                    className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left text-sm font-semibold ${
                      darkMode ? "border-[#F0A623]/45 bg-[#241A09] text-white" : "border-[#F0A623]/45 bg-[#FFF8E7] text-black"
                    }`}
                  >
                    <span>{t("Move to DishList")}</span>
                    <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {editOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md my-auto">
            {renderEditGuidedComposer()}
          </div>
        </div>
      )}

      <AppToast message={pageToast} variant={pageToastVariant} />

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
      <AnimatePresence>
        {editTagUserPickerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setEditTagUserPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className={`w-full max-w-md rounded-[1.75rem] border p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)] ${
                darkMode
                  ? "border-white/12 bg-[linear-gradient(180deg,rgba(28,28,26,0.98)_0%,rgba(13,13,12,0.98)_100%)] text-white"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,236,0.98)_100%)] text-black"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-[1.35rem] font-semibold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t("Tag a user")}</h3>
                  <p className={`mt-2 text-sm ${darkMode ? "text-white/56" : "text-black/58"}`}>{t("Search by name")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTagUserPickerOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    darkMode ? "border-white/12 bg-white/8 text-white/65" : "border-black/10 bg-white text-black/55"
                  }`}
                  aria-label="Close tag user picker"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder={t("Search users...")}
                value={editTagUserSearch}
                onChange={(e) => setEditTagUserSearch(e.target.value)}
                className={`w-full rounded-[1rem] border px-4 py-3 text-base shadow-[0_10px_24px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 ${
                  darkMode
                    ? "border-white/12 bg-white/8 text-white placeholder:text-white/32 focus:ring-white/18"
                    : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/12"
                }`}
              />
              <div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
                {editTagUsersLoading ? (
                  <div className={`rounded-[1rem] px-4 py-5 text-sm ${darkMode ? "bg-white/8 text-white/56" : "bg-white/72 text-black/58"}`}>{t("Loading...")}</div>
                ) : filteredEditTaggableUsers.length === 0 ? (
                  <div className={`rounded-[1rem] px-4 py-5 text-sm ${darkMode ? "bg-white/8 text-white/56" : "bg-white/72 text-black/58"}`}>{t("No users found.")}</div>
                ) : (
                  filteredEditTaggableUsers.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        setEditTaggedUser(candidate.displayName || "User");
                        setEditTaggedUserId(candidate.id);
                        setEditTagUserPickerOpen(false);
                        setEditTagUserSearch("");
                      }}
                      className={`flex w-full items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${
                        darkMode ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${
                        darkMode ? "bg-white/12 text-white/72" : "bg-black/10 text-black/65"
                      }`}>
                        {candidate.photoURL ? (
                          <img src={candidate.photoURL} alt={candidate.displayName || "User"} className="h-full w-full object-cover" />
                        ) : (
                          (candidate.displayName?.[0] || "U").toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate text-base font-semibold ${darkMode ? "text-white" : "text-black"}`}>{candidate.displayName || "User"}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        {editMediaPickerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/28 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-[2px]"
            onClick={() => setEditMediaPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`w-full max-w-md rounded-[1.75rem] border-2 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${darkMode ? "border-white/12 bg-[#111111] text-white" : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,236,0.98)_100%)] text-black"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 pb-3 pt-1 text-center">
                <div className={`text-[1.05rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Change media")}</div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openEditLibraryPicker}
                  className={`flex w-full items-center justify-between rounded-[1.2rem] border-2 px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white" : "border-black/10 bg-white text-black"}`}
                >
                  <div>
                    <div className={`text-[0.98rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Photo library")}</div>
                    <div className={`mt-0.5 text-[0.8rem] ${darkMode ? "text-white/52" : "text-black/48"}`}>{t("Pick a photo or video")}</div>
                  </div>
                  <Plus size={24} className={darkMode ? "text-white/65" : "text-black/55"} />
                </button>
                <button
                  type="button"
                  onClick={openEditCameraPicker}
                  className={`flex w-full items-center justify-between rounded-[1.2rem] border-2 px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white" : "border-black/10 bg-white text-black"}`}
                >
                  <div>
                    <div className={`text-[0.98rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Take photo")}</div>
                    <div className={`mt-0.5 text-[0.8rem] ${darkMode ? "text-white/52" : "text-black/48"}`}>{t("Open the camera")}</div>
                  </div>
                  <Camera size={24} className={darkMode ? "text-white/65" : "text-black/55"} />
                </button>
                {editPreview && !editImageFile?.type?.startsWith("video/") && !isDishVideo(editingDish) ? (
                  <button
                    type="button"
                    onClick={openCurrentImageFraming}
                    className={`flex w-full items-center justify-between rounded-[1.2rem] border-2 px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white" : "border-black/10 bg-white text-black"}`}
                  >
                    <div>
                      <div className={`text-[0.98rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Crop current photo")}</div>
                      <div className={`mt-0.5 text-[0.8rem] ${darkMode ? "text-white/52" : "text-black/48"}`}>{t("Reframe the existing image")}</div>
                    </div>
                    <Crop size={24} className={darkMode ? "text-white/65" : "text-black/55"} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setEditMediaPickerOpen(false)}
                className={`mt-3 flex w-full items-center justify-center rounded-[1.2rem] border-2 px-4 py-3 text-[0.92rem] font-semibold ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white/72" : "border-black/10 bg-white text-black/70"}`}
              >
                {t("Cancel")}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ImageFramingModal
        open={Boolean(editImageFramingFile)}
        file={editImageFramingFile}
        dishName={editName}
        ownerName={user?.displayName || "You"}
        onCancel={() => setEditImageFramingFile(null)}
        onConfirm={(framedFile) => {
          setEditImageFramingFile(null);
          applyEditMediaFile(framedFile);
        }}
      />
      <DishlistPickerModal
        open={dishlistPickerOpen}
        onClose={() => {
          setDishlistPickerOpen(false);
          setDishlistPickerDish(null);
          setLockedDishlistIds([]);
        }}
        lists={dishlists}
        dishName={dishlistPickerDish?.name || "dish"}
        mode="multiple"
        selectedIds={selectedDishlistIds}
        lockedIds={lockedDishlistIds}
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
      <StoryMealTagModal
        open={Boolean(storyMealTagDish)}
        onClose={() => setStoryMealTagDish(null)}
        onSelect={publishStoryMealTagDish}
        language={language}
        darkMode={darkMode}
      />

      <BottomNav />
    </div>
  );
}
