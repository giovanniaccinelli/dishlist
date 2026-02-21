"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  uploadImage,
  saveDishToFirestore,
  getDishesFromFirestore,
  getSavedDishesFromFirestore,
  removeDishFromAllUsers,
  deleteDishAndImage,
  updateOwnerNameForDishes,
} from "../lib/firebaseHelpers";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

export default function Profile() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [uploadedDishes, setUploadedDishes] = useState([]);
  const [savedDishes, setSavedDishes] = useState([]);
  const [profileMeta, setProfileMeta] = useState({ followers: [], following: [], savedDishes: [] });
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishRecipeIngredients, setDishRecipeIngredients] = useState("");
  const [dishRecipeMethod, setDishRecipeMethod] = useState("");
  const [dishIsPublic, setDishIsPublic] = useState(true);
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      (async () => {
        const uploaded = await getDishesFromFirestore(user.uid);
        const userSnap = await getDoc(doc(db, "users", user.uid));
        setUploadedDishes(uploaded);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfileMeta({
            followers: data.followers || [],
            following: data.following || [],
            savedDishes: data.savedDishes || [],
          });
        }
      })();
    }
  }, [user]);

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
      });
    });

    const savedRef = collection(db, "users", user.uid, "saved");
    const unsubscribeSaved = onSnapshot(savedRef, (snap) => {
      const saved = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSavedDishes(saved);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSaved();
    };
  }, [user]);

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
        isPublic: dishIsPublic,
        imageURL,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        createdAt: new Date(),
      });
      const updatedDishes = await getDishesFromFirestore(user.uid);
      setUploadedDishes(updatedDishes);
      setDishName("");
      setDishDescription("");
      setDishRecipeIngredients("");
      setDishRecipeMethod("");
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

  const handleEditProfile = async () => {
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      await updateOwnerNameForDishes(user.uid, newName);
      alert("Profile updated!");
      setEditProfileModal(false);
    } catch {
      alert("Failed to update profile.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const openShuffleDeck = (source) => {
    const pool = source === "uploaded" ? uploadedDishes : savedDishes;
    if (!pool.length) {
      alert("No dishes to shuffle.");
      return;
    }
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle`);
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
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Redirecting to login...
      </div>
    );
  }

  const DishGrid = ({ title, dishes, allowDelete, source, showHeader = true }) => (
    <>
      {showHeader && title ? (
        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={() => openShuffleDeck(source)}
            className="bg-black text-white py-1 px-3 rounded-full text-sm font-semibold disabled:opacity-40"
            disabled={dishes.length === 0}
          >
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
                className="bg-white rounded-2xl overflow-hidden shadow-md relative group"
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
                  const imageSrc =
                    dish.imageURL || dish.imageUrl || dish.image_url || dish.image;
                  if (!imageSrc || imageSrc === "undefined" || imageSrc === "null") {
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
                {allowDelete && (
                  <button
                    onClick={() => handleDeleteDish(dish)}
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

  return (
    <div className="min-h-screen bg-[#F6F6F2] p-6 text-black relative pb-24">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold">
          {user.displayName?.[0] || "U"}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.displayName || "My Profile"}</h1>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setEditProfileModal(true)} className="bg-black text-white py-1 px-3 rounded-full text-sm">Edit Profile</button>
            <button onClick={handleLogout} className="bg-white border border-black/20 py-1 px-3 rounded-full text-sm">Log Out</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-center mb-6">
        <div>
          <div className="text-2xl font-bold">{savedDishes.length}</div>
          <div className="text-xs text-black/60">saved</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{profileMeta.followers.length}</div>
          <div className="text-xs text-black/60">followers</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{profileMeta.following.length}</div>
          <div className="text-xs text-black/60">following</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{uploadedDishes.length}</div>
          <div className="text-xs text-black/60">posted</div>
        </div>
      </div>

      <DishGrid title="My Dishlist" dishes={savedDishes} allowDelete={false} source="saved" />
      <DishGrid title="My Dishes" dishes={uploadedDishes} allowDelete source="uploaded" />

      {/* Add Dish button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-20 right-6 bg-black text-white w-16 h-16 rounded-full shadow-xl text-3xl flex items-center justify-center hover:opacity-90 transition z-50"
        disabled={loadingUpload}
        aria-label="Add dish"
      >
        +
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
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleEditProfile}
                className="w-full bg-black text-white py-3 rounded-full font-semibold hover:opacity-90 transition"
              >
                Save
              </motion.button>
              <button
                onClick={() => setEditProfileModal(false)}
                className="mt-3 w-full bg-white border border-black/20 py-2 rounded-full hover:bg-black/5 transition text-black"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
