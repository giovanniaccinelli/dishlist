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
import AppBackButton from "../../../components/AppBackButton";
import { getDishImageUrl } from "../../lib/dishImage";
import {
  addDishToToTryList,
  deleteDishAndImage,
  deleteImageByUrl,
  getAllDishesFromFirestore,
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersWhoSavedDish,
  publishDishAsStory,
  removeDishFromAllUsers,
  removeDishFromToTry,
  removeSavedDishFromUser,
  saveDishToUserList,
  upgradeToMyDishlist,
  updateDishAndSavedCopies,
  uploadDishImageVariants,
} from "../../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../../lib/tags";
import SaversModal from "../../../components/SaversModal";
import ShareModal from "../../../components/ShareModal";

function StoryActionIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 2.8C13.04 2.86 12.11 3.03 11.23 3.3"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M9.4 3.97C8.69 4.31 8.02 4.73 7.4 5.22"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M6.03 6.52C5.52 7.12 5.08 7.77 4.72 8.47"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M4.02 10.02C3.75 10.86 3.56 11.74 3.47 12.66"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M3.55 14.65C3.64 15.73 3.86 16.76 4.2 17.73"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M4.93 19.52C5.49 20.5 6.21 21.37 7.07 22.09"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M8.83 23.36C9.96 24.03 11.22 24.49 12.56 24.69"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M14.58 24.73C17.44 24.59 20.12 23.37 22.1 21.35"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M23.45 19.45C24.49 17.71 25.06 15.68 25.1 13.57"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M24.73 11.57C24.29 7.74 21.75 4.45 18.15 3.12"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M14 9.1V18.9"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M9.1 14H18.9"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
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
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDish, setShareDish] = useState(null);

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
      setLoadingDish(false);
    })();
  }, [dishId, listOwnerId, source, mode]);

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
      return false;
    }
    const saved = await saveDishToUserList(userId, dishToAdd.id, dishToAdd);
    return Boolean(saved);
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
  const canManageOwnDish = Boolean(userId && orderedList[0]?.owner === userId);
  const canEditFromThisView = canManageOwnDish && !isSavedSource && !isToTrySource;
  const isForeignProfileContext = Boolean(profileId && profileId !== userId);
  const shouldUsePublicActions = isPublicSource || isForeignProfileContext;
  const shouldUseStoryActions = !shouldUsePublicActions && (canManageOwnDish || ((isSavedSource || isToTrySource) && !isForeignProfileContext));

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
      setPageToast("Dish updated");
      setTimeout(() => setPageToast(""), 1200);
    } catch (err) {
      console.error("Failed to update dish:", err);
      alert("Failed to update dish.");
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
      setPageToast("Please sign in");
      setTimeout(() => setPageToast(""), 1200);
      return false;
    }
    const ok = await publishDishAsStory(userId, dishCard);
    setPageToast(ok ? "Story published" : "Story failed");
    setTimeout(() => setPageToast(""), 1200);
    return ok;
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
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Loading...
      </div>
    );
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
    <div className="h-[100dvh] overflow-y-auto overscroll-none bg-transparent text-black relative pb-[64px]">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <AppBackButton fallback="/" />
      </div>

      <div className={`px-5 ${editOpen ? "pointer-events-none" : ""}`}>
        <SwipeDeck
          dishes={orderedList}
          preserveContinuity
          disabled={editOpen}
          currentUser={user}
          onAction={shouldUseStoryActions ? handleAddToStory : shouldUsePublicActions ? handleAdd : handleRemove}
          onSecondaryAction={
            canEditFromThisView
              ? openEditModal
              : isToTrySource && !isForeignProfileContext
                ? handleUpgrade
                : undefined
          }
          onSavesPress={handleOpenSavers}
          onSharePress={handleShare}
          onRightSwipe={shouldUsePublicActions ? handleRightSwipeToTry : undefined}
          actionOnRightSwipe={!shouldUsePublicActions}
          dismissOnAction={isPublicSource}
          onAuthRequired={() => alert("Please sign in to comment.")}
          actionLabel={shouldUseStoryActions ? <StoryActionIcon /> : shouldUsePublicActions ? "+" : "Remove"}
          secondaryActionLabel={
            canEditFromThisView ? "Edit" : isToTrySource && !isForeignProfileContext ? "Move to DishList" : undefined
          }
          actionClassName={
            shouldUseStoryActions
              ? "w-14 h-14 rounded-full bg-white/92 text-[#2BD36B] border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.18)] flex items-center justify-center"
              : shouldUsePublicActions
                ? "add-action-btn w-14 h-14"
                : "px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold shadow-lg"
          }
          secondaryActionClassName={
            canEditFromThisView
              ? "px-4 py-2 rounded-full bg-white text-black border border-black/20 text-sm font-semibold shadow-lg"
              : isToTrySource
              ? "max-w-[132px] px-4 py-3 rounded-[1.2rem] bg-[linear-gradient(135deg,#1C8B4A_0%,#2BD36B_100%)] text-white border border-[#18763F] text-xs font-bold uppercase tracking-[0.08em] shadow-[0_14px_35px_rgba(43,211,107,0.32)] leading-none text-center"
              : undefined
          }
          actionToast={shouldUseStoryActions ? undefined : shouldUsePublicActions ? "ADDING TO YOUR DISHLIST" : "Removed"}
          secondaryActionToast={isToTrySource && !isForeignProfileContext ? "ADDED TO MY DISHLIST" : undefined}
          trackSwipes={false}
          onResetFeed={handleResetDeck}
        />
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

      <AnimatePresence>
        {pageToast && (
          <motion.div
            className="fixed inset-x-4 top-24 z-50 bg-black text-white text-center py-3 rounded-xl font-semibold"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {pageToast}
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
