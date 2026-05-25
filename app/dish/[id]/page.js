"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, Crop, ListChecks, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
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
import SaversModal from "../../../components/SaversModal";
import ShareModal from "../../../components/ShareModal";
import DishlistPickerModal from "../../../components/DishlistPickerModal";
import IngredientBulletTextarea from "../../../components/IngredientBulletTextarea";
import { CookingHomeIcon, DISH_MODE_COOKING, DISH_MODE_RESTAURANT, RestaurantMapIcon } from "../../../components/DishModeControls";
import { RatingStars } from "../../../components/RatingStars";
import RestaurantPlacePicker from "../../../components/RestaurantPlacePicker";
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
  const [savingEdit, setSavingEdit] = useState(false);
  const [pageToast, setPageToast] = useState("");
  const [pageToastVariant, setPageToastVariant] = useState("success");
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDish, setShareDish] = useState(null);
  const [storyPushStats, setStoryPushStats] = useState({});
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
    const ok = await publishDishAsStory(userId, dishCard);
    if (ok) {
      const stats = await getStoryPushStatsForUser(userId);
      setStoryPushStats(stats);
    }
    setProfileCardActionsDish(null);
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
    if (editStep === 0 && !editName.trim()) {
      alert("Dish name is required.");
      return;
    }
    setEditStep((prev) => {
      return Math.min(prev + 1, 3);
    });
  };

  const goToPreviousEditStep = () => {
    setEditStep((prev) => {
      return Math.max(prev - 1, 0);
    });
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
          <div className={`edit-dish-modal ${darkMode ? "bg-[#101010] text-white" : editDishMode === DISH_MODE_RESTAURANT ? "bg-[linear-gradient(180deg,#FFF7F7_0%,#FFF1E9_56%,#FFF9F4_100%)]" : "bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)]"} ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} rounded-[2rem] p-4 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl border-2 my-auto`}>
            <div className="flex items-center justify-between mb-5 gap-4">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`no-accent-border h-1.5 rounded-full transition-all ${
                    step <= editStep
                      ? step === 0
                        ? "w-10 bg-[#E64646]"
                        : step === 1
                          ? "w-10 bg-[#F59E0B]"
                          : step === 2
                            ? "w-10 bg-[#23C268]"
                            : "w-10 bg-[#38BDF8]"
                      : darkMode
                        ? "w-7 bg-white/16"
                        : "w-7 bg-[#C9C9C2]"
                  }`}
                  style={step > editStep ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.92)" } : undefined}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className={`w-10 h-10 shrink-0 rounded-[1rem] border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} bg-white/90 text-black/60 hover:text-black`}
                aria-label="Close edit modal"
              >
                ×
              </button>
            </div>

            {editStep === 0 ? (
              <>
                <div className="mb-4">
                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {language === "it" ? "Nome e foto" : "Name and photo"}
                  </h2>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-2.5">
  <button
    type="button"
    onClick={() => {
      setEditDishMode(DISH_MODE_COOKING);
      setEditRestaurant(null);
    }}
	    className={`rounded-[1.25rem] border-2 px-3 py-2.5 text-left ${editDishMode === DISH_MODE_COOKING ? "border-[#F0A623] bg-[#3A2A09] text-[#FFE2A0]" : darkMode ? "border-white/12 bg-[#181818] text-white/70" : "border-black/10 bg-[#FFFDFC]"}`}
  >
    <div className="grid min-h-[3.55rem] grid-cols-[2.3rem,1fr] items-center gap-2">
      <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.72rem] border-2 border-[#F0A623] bg-[#FFF1C9] text-[#F0A623]">
        <CookingHomeIcon className="h-5 w-5" strokeWidth={2.05} />
      </span>
      <div className="min-w-0">
        <div className={`text-[13px] font-semibold leading-none ${darkMode ? "text-current" : "text-black"}`}>{t("Home")}</div>
        <div className={`mt-1 text-[8.5px] leading-[1.15] ${darkMode ? "text-current opacity-70" : "text-black/55"}`}>{t("Recipe to cook at home")}</div>
      </div>
    </div>
  </button>

  <button
    type="button"
    onClick={() => setEditDishMode(DISH_MODE_RESTAURANT)}
	    className={`rounded-[1.25rem] border-2 px-3 py-2.5 text-left ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border bg-[#3A1010] text-[#FFD1D1]" : darkMode ? "border-white/12 bg-[#181818] text-white/70" : "border-black/10 bg-[#FFFDFC]"}`}
  >
    <div className="grid min-h-[3.55rem] grid-cols-[2.3rem,1fr] items-center gap-2">
      <span className="restaurant-accent-border inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.72rem] border-2 bg-[#FFE2E2] text-[#E64646]">
        <RestaurantMapIcon className="h-5 w-5" strokeWidth={2.05} />
      </span>
      <div className="min-w-0">
        <div className={`text-[13px] font-semibold leading-none ${darkMode ? "text-current" : "text-black"}`}>{t("Restaurant")}</div>
        <div className={`mt-1 text-[8.5px] leading-[1.15] ${darkMode ? "text-current opacity-70" : "text-black/55"}`}>{t("Suggestion to eat out")}</div>
      </div>
    </div>
  </button>
</div>
                {editDishMode === DISH_MODE_RESTAURANT ? (
                  <div className="mb-4">
                    <RestaurantPlacePicker
                      value={editRestaurant}
                      onChange={setEditRestaurant}
                      placeholder={t("Search where you ate it")}
                      accent="restaurant"
                    />
                  </div>
                ) : null}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("Dish name")}
                  enterKeyHint="next"
                  className={`w-full p-4 rounded-full bg-white/90 text-black mb-4 border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border focus:ring-[#E64646]/25" : "border-[#D8C090] focus:ring-[#FF7A59]/25"} focus:outline-none focus:ring-2 text-base`}
                  disabled={savingEdit}
                />
                <button
                  type="button"
                  onClick={() => setEditMediaPickerOpen(true)}
                  className={`w-full h-40 rounded-[2rem] border-2 border-dashed ${darkMode ? editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border bg-[#241313] text-white/75" : "border-[#F0A623] bg-[#211806] text-white/75" : editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border bg-[linear-gradient(180deg,#FFF1F1_0%,#FFF8F2_100%)] text-black/50" : "border-[#D9CCB6] bg-[linear-gradient(180deg,#FFF7E2_0%,#F5FFE7_100%)] text-black/50"} flex items-center justify-center mb-5 cursor-pointer relative overflow-hidden`}
                  disabled={savingEdit}
                >
                  <input
                    ref={editLibraryInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleEditImageChange(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={savingEdit}
                  />
                  <input
                    ref={editCameraInputRef}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleEditImageChange(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={savingEdit}
                  />
                  {editPreview ? (
                    editImageFile?.type?.startsWith("video/") ? (
                      <video
                        src={editPreview}
                        className="w-full h-full object-cover rounded-[2rem]"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img src={editPreview} alt="Edit preview" className="w-full h-full object-cover rounded-[2rem]" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 rounded-full border-2 text-white flex items-center justify-center shadow-lg ${
                        editDishMode === DISH_MODE_RESTAURANT
                          ? "restaurant-accent-border bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)]"
                          : "border-transparent bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)]"
                      }`}>
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">{t("Change photo")}</div>
                    </div>
                  )}
                </button>
              </>
            ) : null}

            {editStep === 1 ? (
              <>
                {editDishMode === DISH_MODE_RESTAURANT ? (
                  <>
                    <div className="mb-4">
                      <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                        {language === "it" ? "Dettagli ristorante" : "Restaurant details"}
                      </h2>
                    </div>
                    <div className={`mb-4 rounded-[1.35rem] border-2 px-4 py-3 restaurant-accent-border ${darkMode ? "bg-[#181818]" : "bg-white/85"}`}>
                      <div className={`mb-2 text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Rating")}</div>
                      <RatingStars value={editRating} onChange={setEditRating} size="text-[1.55rem]" />
                    </div>
                    <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        placeholder={language === "it" ? "Prezzo" : "Price"}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="min-w-0 rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-[16px] text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                        disabled={savingEdit}
                      />
                      <select
                        value={editPriceCurrency}
                        onChange={(e) => setEditPriceCurrency(e.target.value)}
                        inputMode="none"
                        className="rounded-full border-2 restaurant-accent-border bg-white px-3 py-3 text-[16px] font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                        disabled={savingEdit}
                      >
                        {PRICE_CURRENCIES.map((currency) => (
                          <option key={currency.code} value={currency.code}>{currency.symbol}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-5">
                      <div className="inline-flex items-center rounded-full border-2 restaurant-accent-border bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55">
                        {editDishLink.trim() ? t("Dish link") : t("Add link")}
                      </div>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={editDishLink}
                        onChange={(e) => setEditDishLink(e.target.value)}
                        inputMode="url"
                        enterKeyHint="done"
                        className="mt-3 w-full rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                        disabled={savingEdit}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="mb-4">
                      <p className={`mb-2 text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{t("Tag a user")}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditTagUserPickerOpen(true)}
                          className="flex-1 rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-left text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                          disabled={savingEdit}
                        >
                          {editTaggedUser ? `@${editTaggedUser.replace(/^@+/, "")}` : t("Tag a user (optional)")}
                        </button>
                        {editTaggedUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditTaggedUser("");
                              setEditTaggedUserId("");
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/55"
                            aria-label="Clear tagged user"
                          >
                            <X size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                <div className="mb-4 text-center">
                  <div className={`text-[11px] font-semibold tracking-[0.22em] uppercase ${darkMode ? "text-white/40" : "text-black/35"}`}>{t("Optional")}</div>
                </div>
                <h2 className={`text-[1.75rem] leading-none font-semibold mb-4 text-center ${darkMode ? "text-white" : "text-black"}`}>{t("Ingredients and recipe")}</h2>
	                <IngredientBulletTextarea
	                  value={editRecipeIngredients}
	                  onChange={setEditRecipeIngredients}
	                  placeholder={t("Ingredients")}
	                  rows={3}
	                  className="w-full p-4 rounded-[1.5rem] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3FFF7_100%)] text-black mb-3 border-2 default-accent-border shadow-[0_12px_26px_rgba(43,211,107,0.12)] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                  disabled={savingEdit}
	                />
	                <textarea
	                  value={editRecipeMethod}
	                  onChange={(e) => setEditRecipeMethod(e.target.value)}
	                  placeholder={t("Method")}
	                  rows={2}
	                  className="w-full p-4 rounded-[1.5rem] bg-white/80 text-black mb-3 border-2 border-black/10 focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                  disabled={savingEdit}
	                />
	                <div className="mb-3 grid grid-cols-2 gap-2">
	                  <div className="rounded-full border-2 default-accent-border bg-white/85 px-3 py-2 text-[12px] font-semibold text-black/65">
	                    {editDishLink.trim() ? t("Dish link") : t("Add link")}
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => setEditTagUserPickerOpen(true)}
	                    className="truncate rounded-full border-2 default-accent-border bg-white/85 px-3 py-2 text-[12px] font-semibold text-black/65"
	                    disabled={savingEdit}
	                  >
	                    {editTaggedUser ? `@${editTaggedUser.replace(/^@+/, "")}` : t("Tag a user")}
	                  </button>
	                </div>
	                <input
	                  type="text"
	                  placeholder="https://..."
	                  value={editDishLink}
	                  onChange={(e) => setEditDishLink(e.target.value)}
	                  inputMode="url"
	                  enterKeyHint="done"
	                  className="mb-4 w-full rounded-full border-2 default-accent-border bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                  disabled={savingEdit}
	                  autoCapitalize="none"
	                  autoCorrect="off"
	                  spellCheck={false}
	                />
                  </>
                )}
	              </>
	            ) : null}

            {editStep === 2 ? (
              <>
                <div className="mb-4">
                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Description and tags")}</h2>
                </div>
                <textarea
                  value={editDescription}
	                  onChange={(e) => setEditDescription(e.target.value)}
	                  placeholder={t("Description")}
	                  rows={1}
	                  className={`w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-4 border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border focus:ring-[#E64646]/20" : "default-accent-border focus:ring-[#FF7A59]/20"} focus:outline-none focus:ring-2`}
	                  disabled={savingEdit}
	                />
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{t("Tags")}</p>
                    <p className="text-xs text-black/60">{editTags.length}/6</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => {
                      const active = editTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleEditTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs border-2 transition ${darkMode ? getDarkTagChipClass(tag, active) : `${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : ""} ${getTagChipClass(tag, active)}`}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {editStep === 3 ? (
              <>
                <div className="mb-4">
                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Review and upload")}</h2>
                </div>
                <div className={`${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} ${darkMode ? "bg-[#171717] text-white" : editDishMode === DISH_MODE_RESTAURANT ? "bg-[linear-gradient(180deg,#FFF3F3_0%,#FFF0E8_55%,#FFF8F1_100%)]" : "bg-[linear-gradient(180deg,#F7F2E8_0%,#FFF5E0_55%,#F3FFE8_100%)]"} rounded-[2rem] border-2 p-4 mb-5`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-24 h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0 border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"}`}>
                      {editImageFile?.type?.startsWith("video/") || isDishVideo(editingDish) ? (
                        <video
                          src={editPreview || getDishImageUrl(editingDish)}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <img
                          src={editPreview || getDishImageUrl(editingDish)}
                          alt={editName || t("Dish preview")}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">{editName || t("Untitled dish")}</h3>
                      <p className={`text-sm mt-1 line-clamp-3 ${darkMode ? "text-white/65" : "text-black/65"}`}>
                        {editDescription || t("No description")}
                      </p>
                      {editTaggedUser.trim() ? (
                        <div className={`mt-2 inline-flex max-w-full items-center rounded-full border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} bg-[#FFF8EE] px-3 py-1 text-[11px] font-semibold text-[#8A5414]`}>
                          @{editTaggedUser.trim().replace(/^@+/, "")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsPublic((value) => !value)}
                  disabled={savingEdit}
                  className={`dish-public-toggle ${editIsPublic ? "dish-public-toggle--active" : ""} mb-5 flex w-full items-center justify-between gap-4 px-4 py-3 text-left`}
                  aria-pressed={editIsPublic}
                >
                  <span>
                    <span className={`block text-sm font-black ${darkMode ? "text-white" : "text-black"}`}>{t("Public dish")}</span>
                    <span className={`mt-0.5 block text-xs font-semibold ${darkMode ? "text-white/58" : "text-black/54"}`}>
                      {editIsPublic ? t("Visible in feed") : t("Hidden from feed")}
                    </span>
                  </span>
                  <span className="dish-public-toggle__switch no-accent-border shrink-0">
                    <span className="dish-public-toggle__knob no-accent-border" />
                  </span>
                </button>
                <div className="dish-edit-action-bar grid grid-cols-[0.9fr_1.35fr] gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteEditedDish}
                    className={`dish-edit-action-btn dish-edit-action-btn--delete px-4 ${darkMode ? "bg-[#2A1010] text-[#FF9B9B]" : "bg-[#FFF0F0] text-[#B72E2E]"}`}
                    disabled={savingEdit}
                  >
                    {t("Delete")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="dish-edit-action-btn dish-edit-action-btn--save border-2 border-[#45C47A]/55 bg-[#1FA463] px-4 text-white shadow-[0_14px_30px_rgba(31,164,99,0.28)] ring-2 ring-[#2BD36B]/20 transition hover:brightness-105"
                    disabled={savingEdit}
                  >
                    {savingEdit ? t("Saving...") : t("Save")}
                  </button>
                </div>
              </>
            ) : null}

            {editStep < 3 ? (
              <div className="mt-2 flex items-center justify-between">
                {editStep > 0 ? (
                  <button
                    type="button"
                    onClick={goToPreviousEditStep}
                    className={`w-12 h-12 rounded-full border-2 ${editDishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} flex items-center justify-center bg-white shadow-sm`}
                    disabled={savingEdit}
                  >
                    <ArrowLeft size={18} />
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={goToNextEditStep}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#45C47A]/55 bg-[#1FA463] text-white shadow-[0_12px_26px_rgba(31,164,99,0.2)] transition hover:brightness-105"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            ) : null}
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

      <BottomNav />
    </div>
  );
}
