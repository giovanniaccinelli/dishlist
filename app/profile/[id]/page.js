"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, getDocs, collection, query, where, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { saveDishToUserList } from "../../lib/firebaseHelpers";
import AuthPromptModal from "../../../components/AuthPromptModal";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

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
      ...doc.data(),
      id: doc.id,
    }));
    setDishes(fetchedDishes);
  };

  useEffect(() => {
    if (id) fetchProfileData();
  }, [id, user]);

  // Follow/Unfollow handler
  const handleFollow = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    const userRef = doc(db, "users", id);
    const currentUserRef = doc(db, "users", user.uid);
    const currentFollowers = profileUser.followers || [];
    const newFollowers = isFollowing
      ? currentFollowers.filter(f => f !== user.uid)
      : [...currentFollowers, user.uid];
    await updateDoc(userRef, { followers: newFollowers });
    await updateDoc(currentUserRef, {
      following: isFollowing ? arrayRemove(id) : arrayUnion(id),
    });
    setIsFollowing(!isFollowing);
  };

  const handleSaveDish = async (dish) => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    await saveDishToUserList(user.uid, dish.id, dish);
  };

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold">
          {profileUser.displayName?.[0] || "U"}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
          <p className="text-black/60 text-sm">{dishes.length} dishes</p>
          {user && user.uid !== id && (
            <button
              onClick={handleFollow}
              className="mt-2 bg-black text-white py-1 px-3 rounded-full text-sm"
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </div>
      </div>

      {/* Dishes grid */}
      <h2 className="text-xl font-semibold mb-4">Dishes</h2>
      <div className="grid grid-cols-3 gap-3">
        {dishes.length === 0 && (
          <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes yet.
          </div>
        )}
        <AnimatePresence>
          {dishes.map((dish, index) => (
            <motion.div
              key={`${dish.id}-${index}`}
              className="bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              onClick={() => handleSaveDish(dish)}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleSaveDish(dish);
              }}
              onPointerUp={(e) => {
                if (e.pointerType === "touch") {
                  e.preventDefault();
                  handleSaveDish(dish);
                }
              }}
            >
              {(() => {
                const imageSrc =
                  dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
                if (!imageSrc) {
                  return (
                    <div className="w-full h-28 flex items-center justify-center bg-neutral-200 text-gray-500">
                      No image
                    </div>
                  );
                }
                return (
                  <img
                    src={imageSrc}
                    alt={dish.name}
                    className="w-full h-28 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/file.svg";
                    }}
                  />
                );
              })()}
              <div className="p-2 flex items-center justify-between">
                <span className="text-xs font-semibold">{dish.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveDish(dish);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleSaveDish(dish);
                  }}
                  onPointerUp={(e) => {
                    if (e.pointerType !== "touch") return;
                    e.stopPropagation();
                    e.preventDefault();
                    handleSaveDish(dish);
                  }}
                  className="w-8 h-8 rounded-full bg-[#2BD36B] text-black text-xl font-bold flex items-center justify-center"
                  aria-label="Add to dishlist"
                >
                  +
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <BottomNav />
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </div>
  );
}
