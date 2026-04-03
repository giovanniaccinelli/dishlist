"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  uploadImage,
  uploadProfileImage,
  deleteImageByUrl,
  saveDishToFirestore,
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  getToTryDishesFromFirestore,
  removeDishFromAllUsers,
  deleteDishAndImage,
  updateOwnerNameForDishes,
  getUsersWhoSavedDish,
  getActiveStoriesForUser,
  markStoryViewed,
  deleteStory,
  removeDishFromToTry,
  removeSavedDishFromUser,
} from "../lib/firebaseHelpers";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { Plus, Search, Settings, Send, Shuffle } from "lucide-react";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import SaversModal from "../../components/SaversModal";
import StoryViewerModal from "../../components/StoryViewerModal";

export default function Profile() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [uploadedDishes, setUploadedDishes] = useState([]);
  const [savedDishes, setSavedDishes] = useState([]);
  const [toTryDishes, setToTryDishes] = useState([]);
  const [profileMeta, setProfileMeta] = useState({ followers: [], following: [], savedDishes: [] });
  const [profileTab, setProfileTab] = useState("my");
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishRecipeIngredients, setDishRecipeIngredients] = useState("");
  const [dishRecipeMethod, setDishRecipeMethod] = useState("");
  const [dishTags, setDishTags] = useState([]);
  const [dishIsPublic, setDishIsPublic] = useState(true);
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(user?.photoURL || "");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTitle, setConnectionsTitle] = useState("");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsUsers, setConnectionsUsers] = useState([]);
  const [profileOptionsOpen, setProfileOptionsOpen] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saversOpen, setSaversOpen] = useState(false);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversUsers, setSaversUsers] = useState([]);
  const [activeStories, setActiveStories] = useState([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storyActionOpen, setStoryActionOpen] = useState(false);
  const effectiveProfilePhotoURL =
    typeof profileMeta.photoURL === "string" ? profileMeta.photoURL : user?.photoURL || "";
  const hasStories = activeStories.length > 0;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      (async () => {
        const uploaded = await getDishesFromFirestore(user.uid);
        const toTry = await getToTryDishesFromFirestore(user.uid);
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const stories = await getActiveStoriesForUser(user.uid);
        setUploadedDishes(uploaded);
        setToTryDishes(toTry);
        setActiveStories(stories);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfileMeta({
            followers: data.followers || [],
            following: data.following || [],
            savedDishes: data.savedDishes || [],
            photoURL: data.photoURL || "",
          });
        }
      })();
    }
  }, [user]);

  useEffect(() => {
    if (!editProfileModal) return;
    setNewName(user?.displayName || "");
    setNewPhotoFile(null);
    setRemovePhoto(false);
    setNewPhotoPreview(effectiveProfilePhotoURL);
  }, [editProfileModal, user?.displayName, effectiveProfilePhotoURL]);

  useEffect(() => {
    if (!user) return undefined;
    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setProfileMeta({
        followers: data.followers || [],
        following: data.following || [],
        savedDishes: data.savedDishes || [],
        photoURL: data.photoURL || "",
      });
    });

    const savedRef = collection(db, "users", user.uid, "saved");
    const unsubscribeSaved = onSnapshot(savedRef, async () => {
      const saved = await getSavedDishesFromFirestore(user.uid);
      setSavedDishes(saved);
    });

    const toTryRef = collection(db, "users", user.uid, "toTry");
    const unsubscribeToTry = onSnapshot(toTryRef, async () => {
      const items = await getToTryDishesFromFirestore(user.uid);
      setToTryDishes(items);
    });

    const storiesRef = collection(db, "users", user.uid, "stories");
    const unsubscribeStories = onSnapshot(storiesRef, async () => {
      const stories = await getActiveStoriesForUser(user.uid);
      setActiveStories(stories);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSaved();
      unsubscribeToTry();
      unsubscribeStories();
    };
  }, [user]);

  const handleStoryViewed = async (story) => {
    if (!user?.uid || !story?.id) return;
    await markStoryViewed(user.uid, story.id, user.uid);
  };

  const handleDeleteStory = async (story) => {
    if (!user?.uid || !story?.id) return false;
    const ok = await deleteStory(user.uid, story.id);
    if (!ok) return false;
    const nextStories = activeStories.filter((item) => item.id !== story.id);
    setActiveStories(nextStories);
    if (nextStories.length === 0) setStoriesOpen(false);
    return nextStories.length === 0;
  };

  const handleImageChange = (file) => {
    setDishImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageChange(file);
  };

  const handlePost = async () => {
    if (!dishName) {
      alert("Please enter a dish name.");
      return;
    }
    setLoadingUpload(true);
    try {
      let imageURL = "";
      if (dishImage) {
        imageURL = await uploadImage(dishImage, user.uid);
        if (!imageURL) throw new Error("Failed to upload image.");
      }
      await saveDishToFirestore({
        name: dishName,
        description: dishDescription || "",
        recipeIngredients: dishRecipeIngredients || "",
        recipeMethod: dishRecipeMethod || "",
        tags: dishTags,
        isPublic: dishIsPublic,
        imageURL,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        ownerPhotoURL: effectiveProfilePhotoURL || "",
        createdAt: new Date(),
      });
      const updatedDishes = await getDishesFromFirestore(user.uid);
      setUploadedDishes(updatedDishes);
      setDishName("");
      setDishDescription("");
      setDishRecipeIngredients("");
      setDishRecipeMethod("");
      setDishTags([]);
      setDishIsPublic(true);
      setDishImage(null);
      setPreview(null);
      setIsModalOpen(false);
    } catch {
      alert("Failed to upload dish. Please try again.");
    }
    setLoadingUpload(false);
  };

  const handleDeleteDish = async (dish) => {
    if (!confirm("Remove this dish?")) return;
    await deleteDishAndImage(
      dish.id,
      dish.imageURL || dish.imageUrl || dish.image_url || dish.image
    );
    await removeDishFromAllUsers(dish.id);
    const refreshedUploaded = await getDishesFromFirestore(user.uid);
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setUploadedDishes(refreshedUploaded);
    setSavedDishes(refreshedSaved);
  };

  const handleRemoveSavedDish = async (dish) => {
    if (!confirm("Remove this dish from your DishList?")) return;
    const ok = await removeSavedDishFromUser(user.uid, dish.id);
    if (!ok) return;
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setSavedDishes(refreshedSaved);
  };

  const handleRemoveToTryDish = async (dish) => {
    if (!confirm("Remove this dish from To Try?")) return;
    const ok = await removeDishFromToTry(user.uid, dish.id);
    if (!ok) return;
    const refreshed = await getToTryDishesFromFirestore(user.uid);
    setToTryDishes(refreshed);
  };

  const handleEditProfile = async () => {
    try {
      const currentPhotoURL = profileMeta.photoURL || user?.photoURL || "";
      let nextPhotoURL = currentPhotoURL;
      if (removePhoto) {
        nextPhotoURL = "";
      }
      if (newPhotoFile) {
        nextPhotoURL = await uploadProfileImage(newPhotoFile, user.uid);
        if (currentPhotoURL) {
          await deleteImageByUrl(currentPhotoURL);
        }
      } else if (removePhoto && currentPhotoURL) {
        await deleteImageByUrl(currentPhotoURL);
      }
      await updateProfile(auth.currentUser, {
        displayName: newName,
        photoURL: nextPhotoURL ? nextPhotoURL : null,
      });
      await auth.currentUser?.reload();
      if (removePhoto && !nextPhotoURL) {
        await updateDoc(doc(db, "users", user.uid), {
          displayName: newName,
          photoURL: deleteField(),
        });
      } else {
        await setDoc(
          doc(db, "users", user.uid),
          { displayName: newName, photoURL: nextPhotoURL || "" },
          { merge: true }
        );
      }
      await updateOwnerNameForDishes(user.uid, newName, nextPhotoURL || "");
      setProfileMeta((prev) => ({ ...prev, photoURL: nextPhotoURL || "" }));
      setNewPhotoPreview(nextPhotoURL || "");
      alert("Profile updated!");
      setEditProfileModal(false);
      setNewPhotoFile(null);
      setRemovePhoto(false);
    } catch {
      alert("Failed to update profile.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const openShuffleDeck = (source) => {
    const pool =
      source === "uploaded" ? uploadedDishes : source === "to_try" ? toTryDishes : savedDishes;
    if (!pool.length) {
      alert("No dishes to shuffle.");
      return;
    }
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle`);
  };

  const openConnections = async (type) => {
    if (!user) return;
    const rawIds = type === "followers" ? profileMeta.followers || [] : profileMeta.following || [];
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


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        Redirecting to login...
      </div>
    );
  }

  const DishGrid = ({ title, dishes, allowDelete, source, showHeader = true, onRemovePreview }) => (
    <>
      {showHeader && title ? (
        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={() => openShuffleDeck(source)}
            className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-2 px-4 rounded-full text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.18)] disabled:opacity-40"
            disabled={dishes.length === 0}
          >
            <Shuffle size={14} />
            Shuffle
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        {dishes.length === 0 ? (
          <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes here.
          </div>
        ) : (
          <AnimatePresence>
            {dishes.map((dish, index) => (
              <motion.div
                key={`${dish.id}-${index}`}
                className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative group"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <Link
                  href={`/dish/${dish.id}?source=${source}&mode=single`}
                  className="absolute inset-0 z-10"
                >
                  <span className="sr-only">Open dish</span>
                </Link>
                {(() => {
                  const imageSrc = getDishImageUrl(dish);
                  return (
                    <img
                      src={imageSrc}
                      alt={dish.name}
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
                {(allowDelete || onRemovePreview) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onRemovePreview) {
                        onRemovePreview(dish);
                      } else {
                        handleDeleteDish(dish);
                      }
                    }}
                    className="absolute top-2 right-2 z-20 bg-black text-white rounded-full px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    Remove
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </>
  );

  const toggleTag = (tag) => {
    setDishTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 6) return prev;
      return [...prev, tag];
    });
  };

  return (
    <div className="min-h-screen bg-transparent p-6 text-black relative pb-24">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (hasStories) setStoriesOpen(true);
              }}
              className={`w-16 h-16 rounded-full p-[3px] ${hasStories ? "bg-[#2BD36B]" : "bg-transparent"}`}
              aria-label="Open your stories"
            >
              <div className="w-full h-full rounded-full bg-[#F6F6F2] p-[2px]">
                <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden">
                  {effectiveProfilePhotoURL ? (
                    <img
                      src={effectiveProfilePhotoURL}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    user.displayName?.[0] || "U"
                  )}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStoryActionOpen(true)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-black text-white border-2 border-[#F6F6F2] flex items-center justify-center shadow-md"
              aria-label="Add story"
            >
              <Plus size={16} />
            </button>
          </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.displayName || "My Profile"}</h1>
        </div>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              window.location.href = "/directs";
            }}
            className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-transform hover:scale-[1.02]"
            aria-label="Directs"
          >
            <Send size={18} />
          </button>
          <button
            type="button"
            onClick={() => setProfileOptionsOpen((prev) => !prev)}
            className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-transform hover:scale-[1.02]"
            aria-label="Profile options"
          >
            <Settings size={18} />
          </button>
          {profileOptionsOpen && (
            <div className="absolute mt-2 right-0 z-30 bg-white border border-black/10 rounded-2xl shadow-lg p-2 w-44">
              <button
                type="button"
                onClick={() => {
                  setProfileOptionsOpen(false);
                  setEditProfileModal(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-black/5 text-sm"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileOptionsOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-black/5 text-sm"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-center mb-6">
        <div>
          <div className="text-2xl font-bold">{savedDishes.length}</div>
          <div className="text-xs text-black/60">saved</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{profileMeta.followers.length}</div>
          <button
            onClick={() => openConnections("followers")}
            className="text-xs text-black/60 hover:text-black underline"
          >
            followers
          </button>
        </div>
        <div>
          <div className="text-2xl font-bold">{profileMeta.following.length}</div>
          <button
            onClick={() => openConnections("following")}
            className="text-xs text-black/60 hover:text-black underline"
          >
            following
          </button>
        </div>
        <div>
          <div className="text-2xl font-bold">{uploadedDishes.length}</div>
          <div className="text-xs text-black/60">posted</div>
        </div>
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
            My DishList
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
          <DishGrid title="Uploaded" dishes={uploadedDishes} allowDelete source="uploaded" />
          <DishGrid
            title="Saved"
            dishes={savedDishes}
            allowDelete={false}
            source="saved"
            onRemovePreview={handleRemoveSavedDish}
          />
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
            {toTryDishes.length === 0 ? (
              <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
                No dishes in To Try.
              </div>
            ) : (
              <AnimatePresence>
                {toTryDishes.map((dish, index) => (
                <motion.div
                  key={`${dish.id}-${index}`}
                  className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative group"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <Link href={`/dish/${dish.id}?source=to_try&mode=single`} className="absolute inset-0 z-10">
                      <span className="sr-only">Open To Try dish</span>
                    </Link>
                    {(() => {
                      const imageSrc = getDishImageUrl(dish);
                      return (
                        <img
                          src={imageSrc}
                          alt={dish.name}
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
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveToTryDish(dish);
                      }}
                      className="absolute top-2 right-2 z-20 bg-black text-white rounded-full px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      Remove
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </>
      )}

      {/* Add Dish button */}
      <motion.button
        onClick={() => router.push("/upload")}
        className="add-action-btn fixed bottom-24 right-6 w-16 h-16 text-[40px] z-50"
        disabled={loadingUpload}
        aria-label="Add dish"
      >
        <Plus size={26} strokeWidth={2.1} />
      </motion.button>

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 my-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <h2 className="text-2xl font-semibold mb-4 text-black">Add New Dish</h2>
              <input
                type="text"
                placeholder="Dish name"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                className="w-full p-3 rounded-full bg-[#F6F6F2] text-black mb-3 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                disabled={loadingUpload}
              />
              <textarea
                placeholder="Description"
                value={dishDescription}
                onChange={(e) => setDishDescription(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={3}
                disabled={loadingUpload}
              />
              <textarea
                placeholder="Recipe ingredients"
                value={dishRecipeIngredients}
                onChange={(e) => setDishRecipeIngredients(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-3 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={3}
                disabled={loadingUpload}
              />
              <textarea
                placeholder="Recipe method"
                value={dishRecipeMethod}
                onChange={(e) => setDishRecipeMethod(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                rows={4}
                disabled={loadingUpload}
              />
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-black">Tags</p>
                  <p className="text-xs text-black/60">{dishTags.length}/6</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => {
                    const active = dishTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs border transition ${getTagChipClass(tag, active)}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 mb-4 text-sm font-medium text-black">
                <input
                  type="checkbox"
                  checked={dishIsPublic}
                  onChange={(e) => setDishIsPublic(e.target.checked)}
                  disabled={loadingUpload}
                />
                Public dish (visible in feed)
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`w-full h-40 rounded-2xl border-2 border-dashed ${
                  dragActive ? "border-black bg-[#F6F6F2]" : "border-black/20"
                } flex items-center justify-center text-black/50 mb-4 cursor-pointer relative`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files[0])}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                  disabled={loadingUpload}
                />
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : loadingUpload ? (
                  "Uploading..."
                ) : (
                  "Drag & Drop or Click to Upload"
                )}
              </div>
              <div className="mb-4 rounded-2xl border border-black/10 bg-[#F6F6F2] p-3">
                <p className="text-sm text-black/70 mb-2">
                  If you don&apos;t have an image, search if the dish is already posted.
                </p>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push("/dishes");
                  }}
                  className="w-full bg-white border border-black/20 py-2 rounded-full text-sm font-semibold hover:bg-black/5 transition"
                  disabled={loadingUpload}
                >
                  Search Existing Dishes
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePost}
                className="w-full bg-black text-white py-3 rounded-full font-semibold hover:opacity-90 transition"
                disabled={loadingUpload}
              >
                {loadingUpload ? "Uploading..." : "Post Dish"}
              </motion.button>
              <button
                onClick={() => {
                  if (!loadingUpload) setIsModalOpen(false);
                }}
                className="mt-3 w-full bg-white border border-black/20 py-2 rounded-full hover:bg-black/5 transition text-black"
                disabled={loadingUpload}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editProfileModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto">
            <motion.div className="bg-white p-6 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 my-6">
              <h2 className="text-2xl font-semibold mb-2 text-black">Edit Profile</h2>
              <p className="text-sm text-black/60 mb-4">Update your display name.</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-3 rounded-full bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
              />
              <label className="block text-sm font-medium mb-2 text-black">Profile picture</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setNewPhotoFile(file);
                  if (file) {
                    setNewPhotoPreview(URL.createObjectURL(file));
                    setRemovePhoto(false);
                  }
                }}
                className="w-full mb-3"
              />
              {newPhotoPreview ? (
                <img
                  src={newPhotoPreview}
                  alt="Profile preview"
                  className="w-24 h-24 rounded-full object-cover mb-4 border border-black/10"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setNewPhotoFile(null);
                  setNewPhotoPreview("");
                  setRemovePhoto(true);
                }}
                className="w-full mb-4 bg-white border border-black/20 py-2 rounded-full hover:bg-black/5 transition text-black text-sm"
              >
                Remove profile picture
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleEditProfile}
                className="w-full bg-black text-white py-3 rounded-full font-semibold hover:opacity-90 transition"
              >
                Save
              </motion.button>
              <button
                onClick={() => {
                  setEditProfileModal(false);
                  setRemovePhoto(false);
                }}
                className="mt-3 w-full bg-white border border-black/20 py-2 rounded-full hover:bg-black/5 transition text-black"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      href={u.id === user.uid ? "/profile" : `/profile/${u.id}`}
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

      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={user?.displayName || "You"}
        ownerPhotoURL={effectiveProfilePhotoURL}
        onViewed={handleStoryViewed}
        canDelete
        onDelete={handleDeleteStory}
      />
      <AnimatePresence>
        {storyActionOpen && (
          <motion.div
            className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl border border-black/10"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setStoryActionOpen(false)}
                  className="text-sm text-black/55"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/upload?story=1");
                  }}
                  className="w-full min-h-[11.75rem] rounded-[2rem] bg-[linear-gradient(135deg,#1FBF75_0%,#6EDB5A_100%)] text-black px-8 py-8 text-left shadow-[0_24px_50px_rgba(53,176,99,0.28)] border border-black/12"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[2.15rem] font-semibold leading-none">Upload dish</p>
                      <p className="mt-4 text-base text-black/78">Post directly to your story.</p>
                    </div>
                    <div className="w-16 h-16 rounded-[1.4rem] bg-black text-white flex items-center justify-center shadow-md">
                      <Plus size={32} />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/dishes?storyPicker=1");
                  }}
                  className="w-full min-h-[11.75rem] rounded-[2rem] border border-black/15 bg-[linear-gradient(135deg,#F6C15A_0%,#E99A45_100%)] px-8 py-8 text-left shadow-[0_16px_34px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[2.15rem] font-semibold leading-none text-black">Search dish</p>
                      <p className="mt-4 text-base text-black/60">Pick an existing dish for your story.</p>
                    </div>
                    <div className="w-16 h-16 rounded-[1.4rem] bg-[#F4F1E8] flex items-center justify-center border border-black/8">
                      <Search size={30} />
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
