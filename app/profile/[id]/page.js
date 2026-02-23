"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getUsersWhoSavedDish,
  saveDishToUserList,
} from "../../lib/firebaseHelpers";
import AuthPromptModal from "../../../components/AuthPromptModal";
import { Plus } from "lucide-react";
import SaversModal from "../../../components/SaversModal";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [savedDishes, setSavedDishes] = useState([]);
  const [toTryDishes, setToTryDishes] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [profileTab, setProfileTab] = useState("my");
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [toast, setToast] = useState("");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTitle, setConnectionsTitle] = useState("");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsUsers, setConnectionsUsers] = useState([]);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);

  // Fetch profile data
  const fetchProfileData = async () => {
    const userDoc = await getDoc(doc(db, "users", id));
    if (userDoc.exists()) {
      setProfileUser({ id: userDoc.id, ...userDoc.data() });
      setIsFollowing(userDoc.data().followers?.includes(user?.uid) || false);
    }

    const fetchedDishes = await getDishesFromFirestore(id);
    setDishes(fetchedDishes);

    const fetchedSavedDishes = await getSavedDishesFromFirestore(id);
    setSavedDishes(fetchedSavedDishes);
    const fetchedToTryDishes = await getToTryDishesFromFirestore(id);
    setToTryDishes(fetchedToTryDishes);
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
    const saved = await saveDishToUserList(user.uid, dish.id, dish);
    if (!saved) {
      setToast("SAVE FAILED");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setToast("ADDING TO YOUR DISHLIST");
    setTimeout(() => setToast(""), 1200);
  };

  const openConnections = async (type) => {
    if (!profileUser) return;
    const rawIds = type === "followers" ? profileUser.followers || [] : profileUser.following || [];
    const ids = Array.from(new Set(rawIds));
    setConnectionsTitle(type === "followers" ? "Followers" : "Following");
    setConnectionsOpen(true);
    setConnectionsLoading(true);
    try {
      const docs = await Promise.all(ids.map((uid) => getDoc(doc(db, "users", uid))));
      const usersList = docs
        .filter((snap) => snap.exists())
        .map((snap) => ({ id: snap.id, ...snap.data() }));
      setConnectionsUsers(usersList);
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
      setConnectionsUsers([]);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleOpenSavers = async (dish) => {
    setSaversOpen(true);
    setSaversLoading(true);
    try {
      const usersList = await getUsersWhoSavedDish(dish?.id);
      setSaversUsers(usersList);
    } finally {
      setSaversLoading(false);
    }
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
          {profileUser.photoURL ? (
            <img src={profileUser.photoURL} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            profileUser.displayName?.[0] || "U"
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
          <p className="text-black/60 text-sm">
            {savedDishes.length} saved · {toTryDishes.length} to try · {dishes.length} uploaded
          </p>
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

      <div className="grid grid-cols-2 gap-4 text-center mb-6">
        <div>
          <div className="text-2xl font-bold">{profileUser.followers?.length || 0}</div>
          <button
            onClick={() => openConnections("followers")}
            className="text-xs text-black/60 hover:text-black underline"
          >
            followers
          </button>
        </div>
        <div>
          <div className="text-2xl font-bold">{profileUser.following?.length || 0}</div>
          <button
            onClick={() => openConnections("following")}
            className="text-xs text-black/60 hover:text-black underline"
          >
            following
          </button>
        </div>
      </div>

      <div className="mb-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => setProfileTab("my")}
          className={`px-5 py-2 rounded-full text-sm font-semibold border ${
            profileTab === "my"
              ? "bg-[#2BD36B] border-[#2BD36B] text-black"
              : "bg-white border-black/15 text-black/60"
          }`}
        >
          My DishList
        </button>
        <button
          type="button"
          onClick={() => setProfileTab("totry")}
          className={`px-5 py-2 rounded-full text-sm font-semibold border ${
            profileTab === "totry"
              ? "bg-[#FACC15] border-[#FACC15] text-black"
              : "bg-white border-black/15 text-black/60"
          }`}
        >
          To Try
        </button>
      </div>

      {profileTab === "my" ? (
        <>
          <h2 className="text-xl font-semibold mb-4">Saved</h2>
          <div className="grid grid-cols-3 gap-3">
            {savedDishes.length === 0 && (
              <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
                No saved dishes yet.
              </div>
            )}
            <AnimatePresence>
              {savedDishes.map((dish, index) => (
                <motion.div
                  key={`saved-${dish.id || index}`}
                  className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
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
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-white pointer-events-none">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {dish.name || "Untitled dish"}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenSavers(dish);
                      }}
                      className="text-[10px] text-white/80 underline pointer-events-auto"
                    >
                      saves: {Number(dish.saves || 0)}
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSaveDish(dish);
                    }}
                    className="add-action-btn absolute bottom-2 right-2 z-30 w-11 h-11 text-[30px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={20} strokeWidth={2.1} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <h2 className="text-xl font-semibold my-4">Uploaded</h2>
          <div className="grid grid-cols-3 gap-3">
            {dishes.length === 0 && (
              <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
                No uploaded dishes yet.
              </div>
            )}
            <AnimatePresence>
              {dishes.map((dish, index) => (
                <motion.div
                  key={`uploaded-${dish.id || index}`}
                  className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
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
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-white pointer-events-none">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {dish.name || "Untitled dish"}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenSavers(dish);
                      }}
                      className="text-[10px] text-white/80 underline pointer-events-auto"
                    >
                      saves: {Number(dish.saves || 0)}
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSaveDish(dish);
                    }}
                    className="add-action-btn absolute bottom-2 right-2 z-30 w-11 h-11 text-[30px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={20} strokeWidth={2.1} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">To Try</h2>
          <div className="grid grid-cols-3 gap-3">
            {toTryDishes.length === 0 && (
              <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
                No dishes in To Try.
              </div>
            )}
            <AnimatePresence>
              {toTryDishes.map((dish, index) => (
                <motion.div
                  key={`totry-${dish.id || index}`}
                  className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
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
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-white pointer-events-none">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {dish.name || "Untitled dish"}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenSavers(dish);
                      }}
                      className="text-[10px] text-white/80 underline pointer-events-auto"
                    >
                      saves: {Number(dish.saves || 0)}
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSaveDish(dish);
                    }}
                    className="add-action-btn absolute bottom-2 right-2 z-30 w-11 h-11 text-[30px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={20} strokeWidth={2.1} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <BottomNav />
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
      <AnimatePresence>
        {connectionsOpen && (
          <motion.div
            className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{connectionsTitle}</h3>
                <button onClick={() => setConnectionsOpen(false)} className="text-sm text-black/60">
                  Close
                </button>
              </div>
              {connectionsLoading ? (
                <div className="text-black/60">Loading...</div>
              ) : connectionsUsers.length === 0 ? (
                <div className="bg-[#f0f0ea] rounded-xl h-24 flex items-center justify-center text-gray-500">
                  No users.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {connectionsUsers.map((u) => (
                    <Link
                      key={u.id}
                      href={user?.uid === u.id ? "/profile" : `/profile/${u.id}`}
                      onClick={() => setConnectionsOpen(false)}
                      className="bg-white rounded-2xl p-4 shadow-md border border-black/5 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/10 flex items-center justify-center text-lg font-bold">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="Profile" className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          u.displayName?.[0] || "U"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{u.displayName || "User"}</div>
                        <div className="text-xs text-black/60">
                          {u.followers?.length || 0} followers
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed inset-x-4 top-24 z-50 bg-[#1F8B3B] text-white text-center py-3 rounded-xl font-bold tracking-wide shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
