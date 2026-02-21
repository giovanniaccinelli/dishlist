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
  const [list, setList] = useState([]);
  const [loadingDish, setLoadingDish] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageFile, setEditImageFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!dishId || !userId) return;
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
      setList(items);
      const found = items.find((d) => d.id === dishId) || null;
      if (found) {
        setDish(found);
        setLoadingDish(false);
        return;
      }
      const snap = await getDoc(doc(db, "dishes", dishId));
      setDish(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoadingDish(false);
    })();
  }, [dishId, userId, source]);

  const orderedList = useMemo(() => {
    if (!dish) return [];
    if (mode === "single") return [dish];
    const others = list.filter((d) => d.id !== dish.id);
    const shuffledOthers = others
      .slice()
      .sort(() => Math.random() - 0.5);
    return [dish, ...shuffledOthers];
  }, [dish, list, mode]);

  const handleRemove = async (dishToRemove) => {
    if (!userId) return;
    if (source === "uploaded") {
      await deleteDishAndImage(
        dishToRemove.id,
        dishToRemove.imageURL || dishToRemove.imageUrl || dishToRemove.image_url || dishToRemove.image
      );
      await removeDishFromAllUsers(dishToRemove.id);
    } else {
      await removeSavedDishFromUser(userId, dishToRemove.id);
    }
    router.back();
  };

  const canEditUploaded = source === "uploaded";

  const openEditModal = (dishToEdit) => {
    if (!canEditUploaded || dishToEdit?.owner !== userId) return;
    setEditingDish(dishToEdit);
    setEditName(dishToEdit?.name || "");
    setEditDescription(dishToEdit?.description || "");
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-black/10">
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
