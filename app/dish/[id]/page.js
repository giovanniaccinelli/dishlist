"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import SwipeDeck from "../../../components/SwipeDeck";
import BottomNav from "../../../components/BottomNav";
import {
  deleteDishAndImage,
  deleteImageByUrl,
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  removeDishFromAllUsers,
  removeSavedDishFromUser,
  updateDishAndSavedCopies,
  uploadImage,
} from "../../lib/firebaseHelpers";

export default function DishDetail() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const source = searchParams.get("source") || "saved";
  const mode = searchParams.get("mode") || "single";
  const dishId = Array.isArray(id) ? id[0] : id;
  const userId = user?.uid || null;
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
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  useEffect(() => {
    if (!dishId || !userId) return;
    setRemovedDishIds(new Set());
    (async () => {
      let items = [];
      if (source === "uploaded") {
        items = await getDishesFromFirestore(userId);
      } else {
        items = await getSavedDishesFromFirestore(userId);
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
  }, [dishId, userId, source, mode]);

  const orderedList = useMemo(() => {
    if (!dish) return [];
    const base = mode === "single" ? [dish] : deckList;
    return base.filter((d) => !removedDishIds.has(d.id));
  }, [dish, deckList, mode, removedDishIds]);

  const handleRemove = async (dishToRemove) => {
    if (!userId) return false;
    if (source === "uploaded") {
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

  const canEditUploaded = source === "uploaded";

  const openEditModal = (dishToEdit) => {
    if (!canEditUploaded || dishToEdit?.owner !== userId) return;
    setEditingDish(dishToEdit);
    setEditName(dishToEdit?.name || "");
    setEditDescription(dishToEdit?.description || "");
    setEditRecipeIngredients(dishToEdit?.recipeIngredients || "");
    setEditRecipeMethod(dishToEdit?.recipeMethod || "");
    setEditIsPublic(dishToEdit?.isPublic !== false);
    setEditImageFile(null);
    setEditPreview(
      dishToEdit?.imageURL || dishToEdit?.imageUrl || dishToEdit?.image_url || dishToEdit?.image || ""
    );
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
      if (editImageFile) {
        const uploadedUrl = await uploadImage(editImageFile, userId);
        if (uploadedUrl) {
          if (nextImageURL && nextImageURL !== uploadedUrl) {
            await deleteImageByUrl(nextImageURL);
          }
          nextImageURL = uploadedUrl;
        }
      }

      const updates = {
        name: editName.trim(),
        description: editDescription.trim(),
        recipeIngredients: editRecipeIngredients.trim(),
        recipeMethod: editRecipeMethod.trim(),
        isPublic: editIsPublic,
        imageURL: nextImageURL || "",
      };

      await updateDishAndSavedCopies(editingDish.id, updates);

      setDish((prev) => (prev?.id === editingDish.id ? { ...prev, ...updates } : prev));
      setList((prev) =>
        prev.map((item) => (item.id === editingDish.id ? { ...item, ...updates } : item))
      );

      setEditOpen(false);
      setEditingDish(null);
    } catch (err) {
      console.error("Failed to update dish:", err);
      alert("Failed to update dish.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading || loadingDish) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Please sign in.
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Dish not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black relative pb-24">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-black/60">
          ← Back
        </button>
      </div>

      <div className="px-5">
        <SwipeDeck
          dishes={orderedList}
          preserveContinuity
          onAction={canEditUploaded ? openEditModal : handleRemove}
          dismissOnAction={!canEditUploaded}
          actionLabel={canEditUploaded ? "Edit" : "Remove"}
          actionClassName={
            canEditUploaded
              ? "px-4 py-2 rounded-full bg-white text-black border border-black/20 text-sm font-semibold shadow-lg"
              : "px-4 py-2 rounded-full bg-black text-white text-sm font-semibold shadow-lg"
          }
          actionToast={canEditUploaded ? "Edit Dish" : "Removed"}
          trackSwipes={false}
        />
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 my-6">
            <h2 className="text-xl font-semibold mb-4">Edit Dish</h2>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Dish name"
              className="w-full p-3 rounded-full bg-[#F6F6F2] border border-black/10 mb-3"
              disabled={savingEdit}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full p-3 rounded-2xl bg-[#F6F6F2] border border-black/10 mb-3"
              disabled={savingEdit}
            />
            <textarea
              value={editRecipeIngredients}
              onChange={(e) => setEditRecipeIngredients(e.target.value)}
              placeholder="Recipe ingredients"
              rows={3}
              className="w-full p-3 rounded-2xl bg-[#F6F6F2] border border-black/10 mb-3"
              disabled={savingEdit}
            />
            <textarea
              value={editRecipeMethod}
              onChange={(e) => setEditRecipeMethod(e.target.value)}
              placeholder="Recipe method"
              rows={4}
              className="w-full p-3 rounded-2xl bg-[#F6F6F2] border border-black/10 mb-3"
              disabled={savingEdit}
            />
            <label className="flex items-center gap-2 mb-3 text-sm font-medium text-black">
              <input
                type="checkbox"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                disabled={savingEdit}
              />
              Public dish (visible in feed)
            </label>
            <label className="block text-sm font-medium mb-2">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setEditImageFile(file);
                if (file) setEditPreview(URL.createObjectURL(file));
              }}
              className="w-full mb-3"
              disabled={savingEdit}
            />
            {editPreview ? (
              <img src={editPreview} alt="Edit preview" className="w-full h-40 object-cover rounded-xl mb-4" />
            ) : (
              <div className="w-full h-40 rounded-xl mb-4 bg-neutral-200 flex items-center justify-center text-gray-500">
                No image
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-3 rounded-full border border-black/20"
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-3 rounded-full bg-black text-white font-semibold"
                disabled={savingEdit}
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
