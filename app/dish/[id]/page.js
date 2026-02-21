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
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  removeDishFromAllUsers,
  removeSavedDishFromUser,
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
          onAction={handleRemove}
          actionLabel="Remove"
          actionClassName="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold shadow-lg"
          actionToast="Removed"
          trackSwipes={false}
        />
      </div>

      <BottomNav />
    </div>
  );
}
