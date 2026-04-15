"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useUnreadDirects } from "../../lib/useUnreadDirects";
import BottomNav from "../../../components/BottomNav";
import AppBackButton from "../../../components/AppBackButton";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  getOrCreateConversation,
  getUsersWhoSavedDish,
  getActiveStoriesForUser,
  markStoryViewed,
  saveDishToUserList,
} from "../../lib/firebaseHelpers";
import AuthPromptModal from "../../../components/AuthPromptModal";
import { Plus, Send, Shuffle } from "lucide-react";
import SaversModal from "../../../components/SaversModal";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../../lib/dishImage";
import StoryViewerModal from "../../../components/StoryViewerModal";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
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
  const [activeStories, setActiveStories] = useState([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const viewedAllStories =
    activeStories.length > 0 &&
    activeStories.every((story) => !user?.uid || (story.viewedBy || []).includes(user.uid));

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
    const fetchedStories = await getActiveStoriesForUser(id);
    setActiveStories(fetchedStories);
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

  const openShuffleDeck = (source) => {
    const pool =
      source === "uploaded" ? dishes : source === "to_try" ? toTryDishes : savedDishes;
    if (!pool.length) {
      alert("No dishes to shuffle.");
      return;
    }
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    window.location.href = `/dish/${randomDish.id}?source=${source}&mode=shuffle&profileId=${id}`;
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

  const handleStoryViewed = async (story) => {
    if (!user?.uid || !story?.id) return;
    await markStoryViewed(id, story.id, user.uid);
    setActiveStories((prev) =>
      prev.map((item) =>
        item.id === story.id
          ? { ...item, viewedBy: Array.from(new Set([...(item.viewedBy || []), user.uid])) }
          : item
      )
    );
  };


  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative pb-[72px]">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <AppBackButton fallback="/dishlists" />
        <button
          type="button"
          onClick={async () => {
            if (!user) {
              setShowAuthPrompt(true);
              return;
            }
            const conversationId = await getOrCreateConversation(user, profileUser);
            if (conversationId) {
              window.location.href = `/directs/${conversationId}`;
            }
          }}
          className="top-action-btn relative"
          aria-label="Directs"
        >
          <Send size={18} />
          {hasUnreadDirects ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
        </button>
      </div>

      <div className="mb-5">
        <div className="flex items-stretch gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeStories.length > 0) setStoriesOpen(true);
              }}
              className={`w-24 h-24 rounded-full p-[4px] ${
                activeStories.length > 0
                  ? viewedAllStories
                    ? "bg-[#C6C6BF]"
                    : "bg-[#2BD36B]"
                  : "bg-transparent"
              }`}
              aria-label="Open stories"
            >
              <div className="w-full h-full rounded-full bg-[#F6F6F2] p-[3px]">
                <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden">
                  {profileUser.photoURL ? (
                    <img
                      src={profileUser.photoURL}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    profileUser.displayName?.[0] || "U"
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="flex-1 min-h-24 flex flex-col justify-between py-0.5">
            <h1 className="text-[1.8rem] leading-none font-bold tracking-tight">{profileUser.displayName || "User Profile"}</h1>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="flex min-h-[52px] flex-col items-center justify-end text-center">
                <div className="text-[1.28rem] font-bold leading-none">{savedDishes.length}</div>
                <div className="mt-1 text-[10px] leading-[1.1] text-black/50">saved</div>
              </div>
              <div className="flex min-h-[52px] flex-col items-center justify-end text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileUser.followers?.length || 0}</div>
                <button
                  onClick={() => openConnections("followers")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  followers
                </button>
              </div>
              <div className="flex min-h-[52px] flex-col items-center justify-end text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileUser.following?.length || 0}</div>
                <button
                  onClick={() => openConnections("following")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  following
                </button>
              </div>
              <div className="flex min-h-[52px] flex-col items-center justify-end text-center">
                <div className="text-[1.28rem] font-bold leading-none">{dishes.length}</div>
                <div className="mt-1 text-[10px] leading-[1.1] text-black/50">posted</div>
              </div>
            </div>
          </div>
        </div>

        {profileUser.bio ? (
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/68 whitespace-pre-wrap">{profileUser.bio}</p>
        ) : null}

        {user && user.uid !== id ? (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleFollow}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                isFollowing
                  ? "bg-[linear-gradient(135deg,#F4E9D5_0%,#FCF5E7_100%)] text-[#2B2418] border-[#D8C9AF]"
                  : "bg-[linear-gradient(135deg,#EAF7EE_0%,#F4FBF2_100%)] text-[#165D32] border-[#C7E3CB]"
              }`}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mb-5 flex justify-center">
        <div className="relative flex items-end gap-10 border-b border-black/12">
          <button
            type="button"
            onClick={() => setProfileTab("my")}
            className={`relative pb-2 text-sm font-semibold transition ${
              profileTab === "my" ? "text-black" : "text-black/45"
            }`}
          >
            DishList
            {profileTab === "my" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#2BD36B]" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setProfileTab("totry")}
            className={`relative pb-2 text-sm font-semibold transition ${
              profileTab === "totry" ? "text-black" : "text-black/45"
            }`}
          >
            To Try
            {profileTab === "totry" ? (
              <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#FACC15]" />
            ) : null}
          </button>
        </div>
      </div>

      {profileTab === "my" ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Saved</h2>
            <button
              onClick={() => openShuffleDeck("saved")}
              className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
              disabled={savedDishes.length === 0}
            >
              <Shuffle size={14} />
              Shuffle
            </button>
          </div>
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
                  <Link href={`/dish/${dish.id}?source=saved&mode=single&profileId=${id}`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
                  {(() => {
                    const imageSrc = getDishImageUrl(dish, "thumb");
                    return (
                      <img
                        src={imageSrc}
                        alt={dish.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_DISH_IMAGE;
                        }}
                      />
                    );
                  })()}
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
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
                      className="text-[10px] text-white/80 pointer-events-auto text-left self-start"
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
                    className="add-action-btn absolute top-2 right-2 z-30 w-9 h-9 text-[24px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={16} strokeWidth={2.1} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between my-4">
            <h2 className="text-xl font-semibold">Uploaded</h2>
            <button
              onClick={() => openShuffleDeck("uploaded")}
              className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
              disabled={dishes.length === 0}
            >
              <Shuffle size={14} />
              Shuffle
            </button>
          </div>
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
                  <Link href={`/dish/${dish.id}?source=uploaded&mode=single&profileId=${id}`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
                  {(() => {
                    const imageSrc = getDishImageUrl(dish, "thumb");
                    return (
                      <img
                        src={imageSrc}
                        alt={dish.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_DISH_IMAGE;
                        }}
                      />
                    );
                  })()}
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
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
                      className="text-[10px] text-white/80 pointer-events-auto text-left self-start"
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
                    className="add-action-btn absolute top-2 right-2 z-30 w-9 h-9 text-[24px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={16} strokeWidth={2.1} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mt-8 mb-4">
            <h2 className="text-xl font-semibold">To Try</h2>
            <button
              onClick={() => openShuffleDeck("to_try")}
              className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
              disabled={toTryDishes.length === 0}
            >
              <Shuffle size={14} />
              Shuffle
            </button>
          </div>
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
                  <Link href={`/dish/${dish.id}?source=to_try&mode=single&profileId=${id}`} className="absolute inset-0 z-10">
                    <span className="sr-only">Open dish card</span>
                  </Link>
                  {(() => {
                    const imageSrc = getDishImageUrl(dish, "thumb");
                    return (
                      <img
                        src={imageSrc}
                        alt={dish.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_DISH_IMAGE;
                        }}
                      />
                    );
                  })()}
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
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
                      className="text-[10px] text-white/80 pointer-events-auto text-left self-start"
                    >
                      saves: {Number(dish.saves || 0)}
                    </button>
                    {Array.isArray(dish.tags) && dish.tags.length > 0 && (
                      <div className="flex gap-1 overflow-hidden">
                        {dish.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={`${dish.id}-tag-${idx}`}
                            className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] leading-none truncate"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSaveDish(dish);
                    }}
                    className="add-action-btn absolute top-2 right-2 z-30 w-9 h-9 text-[24px]"
                    aria-label="Add to dishlist"
                  >
                    <Plus size={16} strokeWidth={2.1} />
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
                          <img
                            src={u.photoURL}
                            alt="Profile"
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-full object-cover"
                          />
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
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={profileUser.displayName || "User"}
        ownerPhotoURL={profileUser.photoURL || ""}
        onViewed={handleStoryViewed}
      />
    </div>
  );
}
