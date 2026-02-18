"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getSavedDishesFromFirestore } from "../lib/firebaseHelpers";
import BottomNav from "../../components/BottomNav";

export default function Dishlists() {
  const { user, loading } = useAuth();
  const [savedDishes, setSavedDishes] = useState([]);

  useEffect(() => {
    if (user) {
      (async () => {
        const saved = await getSavedDishesFromFirestore(user.uid);
        setSavedDishes(saved);
      })();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Please sign in.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-6">My Dishlist</h1>
      <div className="grid grid-cols-3 gap-3">
        {savedDishes.length === 0 ? (
          <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes saved yet.
          </div>
        ) : (
          savedDishes.map((dish) => {
            const imageSrc =
              dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
            return (
              <div key={dish.id} className="bg-white rounded-2xl overflow-hidden shadow-md">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={dish.name}
                    className="w-full h-28 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/file.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center bg-neutral-200 text-gray-500">
                    No image
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <BottomNav />
    </div>
  );
}
