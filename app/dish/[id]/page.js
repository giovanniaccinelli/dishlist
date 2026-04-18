"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import SwipeDeck from "../../../components/SwipeDeck";
import BottomNav from "../../../components/BottomNav";
import { FullScreenLoading } from "../../../components/AppLoadingState";
import AppToast from "../../../components/AppToast";
import AppBackButton from "../../../components/AppBackButton";
import { getDishImageUrl } from "../../lib/dishImage";
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
  removeDishFromToTry,
  removeSavedDishFromUser,
  saveDishToSelectedDishlist,
  getStoryPushStatsForUser,
  upgradeToMyDishlist,
  updateDishAndSavedCopies,
  uploadDishImageVariants,
} from "../../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../../lib/tags";
import SaversModal from "../../../components/SaversModal";
import ShareModal from "../../../components/ShareModal";
import DishlistPickerModal from "../../../components/DishlistPickerModal";

function StoryActionIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.05" stroke="#2BD36B" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="6.8" stroke="#2BD36B" strokeWidth="1.9" opacity="0.88" />
      <path d="M1.35 3.55V8.7" stroke="#2BD36B" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M0.2 3.55V6.2" stroke="#2BD36B" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M2.5 3.55V6.2" stroke="#2BD36B" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M1.35 8.7V19" stroke="#2BD36B" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08"
        stroke="#2BD36B"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M23.6 3.55V19" stroke="#2BD36B" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export default function DishDetail() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const source = searchParams.get("source") || "saved";
  const mode = searchParams.get("mode") || "single";
  const profileId = searchParams.get("profileId");
  const listId = searchParams.get("listId");
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
  const [editRecipeIngredients, setEditRecipeIngredients] = useState("");
  const [editRecipeMethod, setEditRecipeMethod] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
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
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["saved"]);
  const [lockedDishlistIds, setLockedDishlistIds] = useState([]);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
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
        items = all.filter((d) => d.isPublic !== false);
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
      items = items
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
        if (mode === "shuffle") {
          const others = items.filter((d) => d.id !== dishId);
          setDeckList([found, ...shuffleArray(others)]);
        } else {
          setDeckList([found]);
        }
        setLoadingDish(false);
        return;
      }
      const snap = await getDoc(doc(db, "dishes", dishId));
      const fallbackDish = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setDish(fallbackDish);
      setDeckList(fallbackDish ? [fallbackDish] : []);
      if (listOwnerId) {
        const stats = await getStoryPushStatsForUser(listOwnerId);
        setStoryPushStats(stats);
      }
      setLoadingDish(false);
    })();
  }, [dishId, listOwnerId, source, mode, listId]);

  const orderedList = useMemo(() => {
    if (!dish) return [];
    const base = mode === "single" ? [dish] : deckList;
    return base.filter((d) => !removedDishIds.has(d.id));
  }, [dish, deckList, mode, removedDishIds]);

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
        (dishlist) => dishlist.id !== "all_dishes" && dishlist.id !== "uploaded"
      );
      setDishlists(nextLists);
      setSelectedDishlistIds(["saved"]);
      setLockedDishlistIds([]);
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
      setLockedDishlistIds(memberships);
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
    setLoadingDish(true);
    setRemovedDishIds(new Set());
    try {
      let items = [];
      if (source === "public") {
        const all = await getAllDishesFromFirestore();
        items = all.filter((d) => d.isPublic !== false);
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
      items = items
        .slice()
        .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      const found = items.find((d) => d.id === dishId) || items[0] || null;
      if (found) {
        setDish(found);
        if (mode === "shuffle") {
          const others = items.filter((d) => d.id !== found.id);
          setDeckList([found, ...shuffleArray(others)]);
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
  const isToTrySource = source === "to_try";
  const isSavedSource = source === "saved";
  const isSavedListSource = source === "saved" || source === "all_dishes" || source === "dishlist";
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
      return "inline-flex h-14 min-w-[100px] items-center justify-center px-4 rounded-[1rem] border-2 border-white/75 bg-black/22 text-white text-[12px] font-black uppercase tracking-[0.12em] backdrop-blur-sm shadow-[0_12px_28px_rgba(0,0,0,0.2)]";
    }
    if (isToTrySource && !isForeignProfileContext) {
      return "max-w-[132px] px-4 py-3 rounded-[1.2rem] bg-[linear-gradient(135deg,#1C8B4A_0%,#2BD36B_100%)] text-white border border-[#18763F] text-xs font-bold uppercase tracking-[0.08em] shadow-[0_14px_35px_rgba(43,211,107,0.32)] leading-none text-center";
    }
    return undefined;
  };
  const getSecondaryActionToast = (dishCard) => {
    if (dishCard?.owner === userId && !isForeignProfileContext && !isPublicSource) return undefined;
    if (isToTrySource && !isForeignProfileContext) return "Moved to DishList";
    return undefined;
  };
  const backFallback = (() => {
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

  const openEditModal = (dishToEdit) => {
    if (!dishToEdit || dishToEdit?.owner !== userId) return;
    setEditingDish(dishToEdit);
    setEditName(dishToEdit?.name || "");
    setEditDescription(dishToEdit?.description || "");
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
    setEditImageFile(null);
    setEditPreview(
      dishToEdit?.imageURL || dishToEdit?.imageUrl || dishToEdit?.image_url || dishToEdit?.image || ""
    );
    setEditStep(0);
    setEditOpen(true);
  };

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
      if (editImageFile) {
        const uploaded = await uploadDishImageVariants(editImageFile, userId);
        if (uploaded.imageURL) {
          if (nextImageURL && nextImageURL !== uploaded.imageURL) {
            await deleteImageByUrl(nextImageURL);
          }
          nextImageURL = uploaded.imageURL;
          nextCardURL = uploaded.cardURL;
          nextThumbURL = uploaded.thumbURL;
        }
      }

      const updates = {
        name: editName.trim(),
        description: editDescription.trim(),
        recipeIngredients: editRecipeIngredients.trim(),
        recipeMethod: editRecipeMethod.trim(),
        tags: editTags,
        isPublic: editIsPublic,
        imageURL: nextImageURL || "",
        cardURL: nextCardURL || nextImageURL || "",
        thumbURL: nextThumbURL || nextCardURL || nextImageURL || "",
      };

      await updateDishAndSavedCopies(editingDish.id, updates);

      setDish((prev) => (prev?.id === editingDish.id ? { ...prev, ...updates } : prev));
      setDeckList((prev) =>
        prev.map((item) => (item.id === editingDish.id ? { ...item, ...updates } : item))
      );

      setEditOpen(false);
      setEditingDish(null);
      setPageToastVariant("success");
      setPageToast("Dish updated");
      setTimeout(() => setPageToast(""), 1200);
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
    if (!userId) {
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
    setPageToastVariant(ok ? "success" : "error");
    setPageToast(ok ? "Story published" : "Story failed");
    setTimeout(() => setPageToast(""), 1200);
    return ok;
  };

  const handleDishlistSelect = async () => {
    if (!userId || !dishlistPickerDish?.id || selectedDishlistIds.length === 0) return;
    const results = await Promise.all(
      selectedDishlistIds.map((dishlistId) =>
        saveDishToSelectedDishlist(userId, dishlistId, dishlistPickerDish)
      )
    );
    const ok = results.every(Boolean);
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
    setEditStep((prev) => Math.min(prev + 1, 3));
  };

  const goToPreviousEditStep = () => {
    setEditStep((prev) => Math.max(prev - 1, 0));
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
      <div className="app-top-nav px-4 pb-2 flex items-center justify-between shrink-0">
        <AppBackButton fallback={backFallback} preferFallback />
        <div className="w-[74px]" />
      </div>

      <div className={`screen-between-navs-center px-5 ${editOpen ? "pointer-events-none" : ""}`}>
        <div className="w-full">
          <SwipeDeck
            dishes={orderedList}
            preserveContinuity
            disabled={editOpen}
            currentUser={user}
            onAction={shouldUseStoryActions ? handleAddToStory : shouldUsePublicActions ? handleAdd : handleRemove}
            onSecondaryAction={canManageOwnDish || (isToTrySource && !isForeignProfileContext) ? (dishCard) => {
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
            onTertiaryAction={!isForeignProfileContext && !isPublicSource ? handleManageDishlists : undefined}
            onRightSwipe={shouldUsePublicActions ? handleRightSwipeToTry : undefined}
            actionOnRightSwipe={!shouldUsePublicActions}
            dismissOnAction={shouldUsePublicActions ? false : isPublicSource}
            dismissOnSecondaryAction={false}
            onAuthRequired={() => alert("Please sign in to comment.")}
            actionLabel={shouldUseStoryActions ? <StoryActionIcon /> : shouldUsePublicActions ? "+" : "Remove"}
            secondaryActionLabel={getSecondaryActionLabel}
            actionClassName={
              shouldUseStoryActions
                ? "add-action-btn w-14 h-14 text-[#2BD36B]"
                : shouldUsePublicActions
                  ? "add-action-btn w-14 h-14"
                  : "px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold shadow-lg"
            }
            tertiaryActionLabel={!isForeignProfileContext && !isPublicSource ? "list-plus" : undefined}
            tertiaryActionClassName="add-action-btn w-14 h-14"
            secondaryActionClassName={getSecondaryActionClassName}
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

      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)] rounded-[2rem] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E3CFA7] my-6">
            <div className="flex items-center justify-between mb-5 gap-4">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                  className={`h-1.5 rounded-full transition-all ${
                    step <= editStep
                      ? step === 0
                        ? "w-10 bg-[#FF7A59]"
                        : step === 1
                          ? "w-10 bg-[#4AB7D8]"
                          : step === 2
                            ? "w-10 bg-[#67C587]"
                            : "w-10 bg-[#FFC15A]"
                      : "w-7 bg-black/10"
                  }`}
                  />
                ))}
              </div>
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-black/35">
                {editStep === 0 ? "Basics" : editStep === 1 ? "Details" : editStep === 2 ? "Recipe" : "Review"}
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="w-10 h-10 shrink-0 rounded-[1rem] border border-black/10 bg-white/90 text-black/60 hover:text-black"
                aria-label="Close edit modal"
              >
                ×
              </button>
            </div>

            {editStep === 0 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Step 1
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Name and cover</h2>
                </div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Dish name"
                  className="w-full p-4 rounded-full bg-white/90 text-black mb-4 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/25 text-base"
                  disabled={savingEdit}
                />
                <div className="w-full h-60 rounded-[2rem] border-2 border-dashed border-[#D9CCB6] bg-[linear-gradient(180deg,#FFF7E2_0%,#F5FFE7_100%)] flex items-center justify-center text-black/50 mb-6 cursor-pointer relative overflow-hidden">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setEditImageFile(file);
                      if (file) setEditPreview(URL.createObjectURL(file));
                    }}
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                    disabled={savingEdit}
                  />
                  {editPreview ? (
                    <img src={editPreview} alt="Edit preview" className="w-full h-full object-cover rounded-[2rem]" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)] text-white flex items-center justify-center shadow-lg">
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">Change photo</div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {editStep === 1 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Step 2
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Description and tags</h2>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  rows={4}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-5 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/20"
                  disabled={savingEdit}
                />
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-black">Tags</p>
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
                          className={`px-3 py-1 rounded-full text-xs border transition ${getTagChipClass(tag, active)}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {editStep === 2 ? (
              <>
                <div className="mb-4 text-center">
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-black/35">Optional</div>
                </div>
                <h2 className="text-[2rem] leading-none font-semibold mb-4 text-black text-center">Ingredients and recipe</h2>
                <textarea
                  value={editRecipeIngredients}
                  onChange={(e) => setEditRecipeIngredients(e.target.value)}
                  placeholder="Ingredients"
                  rows={4}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-3 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
                  disabled={savingEdit}
                />
                <textarea
                  value={editRecipeMethod}
                  onChange={(e) => setEditRecipeMethod(e.target.value)}
                  placeholder="Method"
                  rows={5}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-4 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
                  disabled={savingEdit}
                />
              </>
            ) : null}

            {editStep === 3 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Final Step
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Review changes</h2>
                </div>
                <div className="rounded-[2rem] bg-[linear-gradient(180deg,#F7F2E8_0%,#FFF5E0_55%,#F3FFE8_100%)] border border-[#D8C090] p-4 mb-5">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0">
                      <img
                        src={editPreview || getDishImageUrl(editingDish)}
                        alt={editName || "Dish preview"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">{editName || "Untitled dish"}</h3>
                      <p className="text-sm text-black/65 mt-1 line-clamp-3">
                        {editDescription || "No description"}
                      </p>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-5 text-sm font-medium text-black">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    disabled={savingEdit}
                  />
                  Public dish (visible in feed)
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteEditedDish}
                    className="py-3 px-4 rounded-full bg-red-500 text-white font-semibold"
                    disabled={savingEdit}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="flex-1 py-3 rounded-full border border-black/20"
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 py-3 rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white font-semibold"
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save"}
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
                    className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm"
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
                  className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white flex items-center justify-center shadow-lg"
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
