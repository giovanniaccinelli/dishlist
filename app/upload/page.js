"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import BottomNav from "../../components/BottomNav";
import AuthPromptModal from "../../components/AuthPromptModal";
import { useAuth } from "../lib/auth";
import { saveDishToFirestore, uploadImage } from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
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
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setShowAuthPrompt(true);
    }
  }, [loading, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setShowUploadForm(params.get("mode") === "new");
  }, []);

  const toggleTag = (tag) => {
    setDishTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 6) return prev;
      return [...prev, tag];
    });
  };

  const handleImageChange = (file) => {
    if (!file) return;
    setDishImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleImageChange(file);
  };

  const handlePost = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    if (!dishName.trim()) {
      alert("Please enter a dish name.");
      return;
    }
    setLoadingUpload(true);
    try {
      let imageURL = "";
      if (dishImage) {
        imageURL = await uploadImage(dishImage, user.uid);
      }
      await saveDishToFirestore({
        name: dishName.trim(),
        description: dishDescription.trim(),
        recipeIngredients: dishRecipeIngredients.trim(),
        recipeMethod: dishRecipeMethod.trim(),
        tags: dishTags,
        isPublic: dishIsPublic,
        imageURL,
        owner: user.uid,
        ownerName: user.displayName || "Anonymous",
        ownerPhotoURL: user.photoURL || "",
        createdAt: new Date(),
      });
      router.replace("/profile");
    } catch (err) {
      console.error("Failed to upload dish:", err);
      alert("Failed to upload dish. Please try again.");
    } finally {
      setLoadingUpload(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black pb-24">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-black/60">
          Cancel
        </button>
        <h1 className="text-lg font-semibold">{showUploadForm ? "Upload Dish" : "Add to DishList"}</h1>
        <div className="w-12" />
      </div>

      <div className="px-4">
        {showUploadForm ? (
          <motion.div
            className="bg-white p-6 rounded-3xl w-full max-w-md mx-auto shadow-2xl border border-black/10 my-4"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
                onChange={(e) => handleImageChange(e.target.files?.[0])}
                className="absolute opacity-0 w-full h-full cursor-pointer"
                disabled={loadingUpload}
              />
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
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
          </motion.div>
        ) : (
          <motion.div
            className="bg-white p-6 rounded-3xl w-full max-w-md mx-auto shadow-2xl border border-black/10 my-10"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h2 className="text-2xl font-semibold mb-2 text-black">Add a dish</h2>
            <p className="text-sm text-black/60 mb-6">
              Choose whether you want to post a new dish or first check if it already exists.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push("/upload?mode=new")}
                className="w-full bg-black text-white py-3 rounded-full font-semibold"
              >
                Upload dish
              </button>
              <button
                onClick={() => router.push("/dishes")}
                className="w-full bg-white border border-black/20 py-3 rounded-full font-semibold hover:bg-black/5 transition"
              >
                Search dish
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showAuthPrompt && (
          <AuthPromptModal
            open={showAuthPrompt}
            onClose={() => {
              setShowAuthPrompt(false);
              router.replace("/");
            }}
          />
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}
