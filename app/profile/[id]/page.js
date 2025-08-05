"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch profile data
  const fetchProfileData = async () => {
    const userDoc = await getDoc(doc(db, "users", id));
    if (userDoc.exists()) {
      setProfileUser({ id: userDoc.id, ...userDoc.data() });
      setIsFollowing(userDoc.data().followers?.includes(user?.uid) || false);
    }

    const q = query(collection(db, "dishes"), where("owner", "==", id));
    const snapshot = await getDocs(q);
    const fetchedDishes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setDishes(fetchedDishes);
  };

  useEffect(() => {
    if (id) fetchProfileData();
  }, [id, user]);

  // Follow/Unfollow handler
  const handleFollow = async () => {
    if (!user) return alert("Log in first");
    const userRef = doc(db, "users", id);
    const currentFollowers = profileUser.followers || [];
    const newFollowers = isFollowing
      ? currentFollowers.filter(f => f !== user.uid)
      : [...currentFollowers, user.uid];
    await updateDoc(userRef, { followers: newFollowers });
    setIsFollowing(!isFollowing);
  };

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E0E] p-6 text-white relative">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
          {profileUser.displayName?.[0] || "U"}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
          <p className="text-gray-400 text-sm">{dishes.length} dishes</p>
          {user && user.uid !== id && (
            <button
              onClick={handleFollow}
              className="mt-2 bg-red-500 hover:bg-red-600 py-1 px-3 rounded-full text-sm"
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </div>
      </div>

      {/* Dishes grid */}
      <h2 className="text-xl font-semibold mb-4">Dishes</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dishes.length === 0 && (
          <div className="bg-[#1e1e1e] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes yet.
          </div>
        )}
        <AnimatePresence>
          {dishes.map((dish) => (
            <motion.div
              key={dish.id}
              className="bg-[#1A1A1A] rounded-xl overflow-hidden shadow-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <img
                src={dish.imageURL || dish.image}
                alt={dish.name}
                className="w-full h-32 object-cover"
              />
              <p className="p-3 text-center font-medium">{dish.name}</p>
              <p className="text-center text-yellow-400 pb-3">★ {dish.rating || 0}/5</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
