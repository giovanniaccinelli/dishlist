"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { useRouter } from "next/navigation";
import { uploadImage, saveDishToFirestore, getDishesFromFirestore } from "../lib/firebaseHelpers";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

export default function Profile() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [dishName, setDishName] = useState("");
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");

  useEffect(() => {
    if (!loading && !user) {
      setIsModalOpen(true);
    }
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      (async () => {
        const fetchedDishes = await getDishesFromFirestore(user.uid);
        setDishes(fetchedDishes);
      })();
    }
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
    if (!dishName || !dishImage) {
      alert("Please enter a dish name and select an image.");
      return;
    }
    setLoadingUpload(true);
    try {
      const imageURL = await uploadImage(dishImage, user.uid);
      if (!imageURL) throw new Error("Failed to upload image.");
      await saveDishToFirestore({
        name: dishName,
        imageURL,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        rating: 0,
        createdAt: new Date(),
      });
      const updatedDishes = await getDishesFromFirestore(user.uid);
      setDishes(updatedDishes);
      setDishName("");
      setDishImage(null);
      setPreview(null);
      setIsModalOpen(false);
    } catch {
      alert("Failed to upload dish. Please try again.");
    }
    setLoadingUpload(false);
  };

  const handleDeleteDish = async (id) => {
    if (!confirm("Delete this dish?")) return;
    await deleteDoc(doc(db, "dishes", id));
    setDishes(dishes.filter((d) => d.id !== id));
  };

  const handleRating = async (id, newRating) => {
    const dishRef = doc(db, "dishes", id);
    await updateDoc(dishRef, { rating: newRating });
    setDishes(dishes.map((d) => (d.id === id ? { ...d, rating: newRating } : d)));
  };

  const handleEditProfile = async () => {
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center text-white">
        <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-sm shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Sign in to access your profile</h2>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold mb-4"
          >
            Sign in with Google
          </button>
          <hr className="border-gray-600 my-4" />
          <p className="text-gray-400 text-center mb-2">Or use email</p>
          <button
            onClick={() => signInWithEmail(prompt("Email:"), prompt("Password:"))}
            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold mb-2"
          >
            Login with Email
          </button>
          <button
            onClick={() => signUpWithEmail(prompt("Email:"), prompt("Password:"))}
            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E0E] p-6 text-white relative">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
          {user.displayName?.[0] || "U"}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.displayName || "My Profile"}</h1>
          <p className="text-gray-400 text-sm">{dishes.length} dishes</p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setEditProfileModal(true)} className="bg-gray-700 hover:bg-gray-600 py-1 px-3 rounded-full text-sm">Edit Profile</button>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 py-1 px-3 rounded-full text-sm">Log Out</button>
          </div>
        </div>
      </div>

      {/* Dishes grid */}
      <h2 className="text-xl font-semibold mb-4">My Dishes</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dishes.length === 0 && (
          <div className="bg-[#1e1e1e] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes yet. Add your first one!
          </div>
        )}
        <AnimatePresence>
          {dishes.map((dish) => (
            <motion.div
              key={dish.id}
              className="bg-[#1A1A1A] rounded-xl overflow-hidden shadow-lg relative group"
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
              <div className="flex justify-center gap-1 pb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => handleRating(dish.id, star)}
                    className={`cursor-pointer text-xl ${dish.rating >= star ? "text-yellow-400" : "text-gray-500"}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleDeleteDish(dish.id)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition"
              >
                Delete
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Dish button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-20 right-6 bg-gradient-to-tr from-red-500 to-pink-500 text-white w-16 h-16 rounded-full shadow-lg text-3xl flex items-center justify-center hover:opacity-90 transition"
        disabled={loadingUpload}
      >
        +
      </motion.button>

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[#1A1A1A]/80 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md shadow-xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <h2 className="text-2xl font-semibold mb-4">Add New Dish</h2>
              <input
                type="text"
                placeholder="Dish name"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                className="w-full p-3 rounded-full bg-[#2a2a2a] text-white mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={loadingUpload}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`w-full h-40 rounded-xl border-2 border-dashed ${
                  dragActive ? "border-red-500 bg-[#2a2a2a]" : "border-gray-600"
                } flex items-center justify-center text-gray-400 mb-4 cursor-pointer relative`}
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
                    className="w-full h-full object-cover rounded-xl"
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
                className="w-full bg-gradient-to-tr from-red-500 to-pink-500 py-3 rounded-full font-semibold hover:opacity-90 transition"
                disabled={loadingUpload}
              >
                {loadingUpload ? "Uploading..." : "Post Dish"}
              </motion.button>
              <button
                onClick={() => {
                  if (!loadingUpload) setIsModalOpen(false);
                }}
                className="mt-3 w-full bg-gray-700 py-2 rounded-full hover:bg-gray-600 transition"
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
          <motion.div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50">
            <motion.div className="bg-[#1A1A1A]/80 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-semibold mb-4">Edit Profile</h2>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-3 rounded-full bg-[#2a2a2a] text-white mb-4 focus:outline-none focus:ring-2 focus:ring-red-500" />
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleEditProfile} className="w-full bg-gradient-to-tr from-red-500 to-pink-500 py-3 rounded-full font-semibold hover:opacity-90 transition">
                Save
              </motion.button>
              <button onClick={() => setEditProfileModal(false)} className="mt-3 w-full bg-gray-700 py-2 rounded-full hover:bg-gray-600 transition">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
