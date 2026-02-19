"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";
import { getAllDishesFromFirestore, saveDishToUserList } from "../lib/firebaseHelpers";
import { useAuth } from "../lib/auth";

export default function Dishes() {
  const { user } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchDishes = async () => {
    setLoading(true);
    const all = await getAllDishesFromFirestore();
    setDishes(all);
    setLoading(false);
  };

  useEffect(() => {
    fetchDishes();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dishes;
    return dishes.filter((d) => d.name?.toLowerCase().includes(term));
  }, [dishes, search]);

  const handleSave = async (dish) => {
    if (!user) return alert("Log in first");
    await saveDishToUserList(user.uid, dish.id, dish);
  };

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-4">Dishes</h1>
      <input
        type="text"
        placeholder="Search dishes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-6 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/30"
      />

      {loading ? (
        <div className="text-black/60">Loading dishes...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No dishes found.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((dish, index) => {
            const imageSrc =
              dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
            return (
              <div key={`${dish.id}-${index}`} className="bg-white rounded-2xl overflow-hidden shadow-md">
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
                <div className="p-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">{dish.name}</span>
                  <button
                    onClick={() => handleSave(dish)}
                    className="w-8 h-8 rounded-full bg-[#2BD36B] text-black text-xl font-bold flex items-center justify-center"
                    aria-label="Add to dishlist"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
