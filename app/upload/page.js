"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Plus, Search } from "lucide-react";
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
  const [uploadStep, setUploadStep] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setShowAuthPrompt(true);
    }
  }, [loading, user]);

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

  const openUploadFlow = () => {
    setShowUploadForm(true);
    setUploadStep(0);
  };

  const goToNextStep = () => {
    if (uploadStep === 0 && !dishName.trim()) {
      alert("Please enter a dish name.");
      return;
    }
    setUploadStep((prev) => Math.min(prev + 1, 3));
  };

  const goToPreviousStep = () => {
    setUploadStep((prev) => Math.max(prev - 1, 0));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black pb-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-16 w-56 h-56 rounded-full bg-[#FFB15E]/35 blur-3xl" />
        <div className="absolute top-20 right-[-4rem] w-64 h-64 rounded-full bg-[#7AD957]/20 blur-3xl" />
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full bg-[#FF7A59]/15 blur-3xl" />
      </div>

      <div className="relative px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-black/60">
          Cancel
        </button>
        <h1 className="text-lg font-semibold">{showUploadForm ? "Upload Dish" : "Add to DishList"}</h1>
        <div className="w-12" />
      </div>

      <div className="relative px-4 min-h-[calc(100vh-152px)] flex items-center justify-center">
        {showUploadForm ? (
          <motion.div
            className="bg-[linear-gradient(180deg,#fff_0%,#fffdf8_100%)] p-6 rounded-[2rem] w-full max-w-md mx-auto shadow-[0_24px_80px_rgba(0,0,0,0.12)] border border-white/70 my-4"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 w-10 rounded-full ${step <= uploadStep ? "bg-gradient-to-r from-[#FF7A59] via-[#FFCC33] to-[#7AD957]" : "bg-black/10"}`}
                  />
                ))}
              </div>
              <div className="text-xs font-semibold tracking-[0.18em] uppercase text-black/35">
                {uploadStep === 0 ? "Basics" : uploadStep === 1 ? "Details" : uploadStep === 2 ? "Recipe" : "Upload"}
              </div>
            </div>

            {uploadStep === 0 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-[#FFF1DE] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#C96D28]">
                    Step 1
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Name it. Show it.</h2>
                </div>
                <input
                  type="text"
                  placeholder="Dish name"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full p-4 rounded-full bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20 text-base"
                  disabled={loadingUpload}
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`w-full h-60 rounded-[2rem] border-2 border-dashed ${
                    dragActive ? "border-black bg-[#FFF7EA]" : "border-black/15 bg-[linear-gradient(180deg,#FFF7EA_0%,#FFFDF8_100%)]"
                  } flex items-center justify-center text-black/50 mb-6 cursor-pointer relative overflow-hidden shadow-inner`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                    disabled={loadingUpload}
                  />
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-[2rem]" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF7A59] to-[#FFCC33] text-black flex items-center justify-center shadow-lg">
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">Add a photo</div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {uploadStep === 1 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-[#FFF1DE] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#C96D28]">
                    Step 2
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Give it a vibe.</h2>
                </div>
                <textarea
                  placeholder="Description"
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-[#F6F6F2] text-black mb-5 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                  rows={4}
                  disabled={loadingUpload}
                />
                <div className="mb-2 flex items-center justify-between">
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
              </>
            ) : null}

            {uploadStep === 2 ? (
              <>
                <div className="mb-4 text-center">
                  <div className="text-4xl font-black tracking-tight text-[#7AD957]/25 uppercase">Optional</div>
                </div>
                <h2 className="text-[2rem] leading-none font-semibold mb-4 text-black">Recipe details</h2>
                <textarea
                  placeholder="Ingredients"
                  value={dishRecipeIngredients}
                  onChange={(e) => setDishRecipeIngredients(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-[#F6F6F2] text-black mb-3 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                  rows={4}
                  disabled={loadingUpload}
                />
                <textarea
                  placeholder="Method"
                  value={dishRecipeMethod}
                  onChange={(e) => setDishRecipeMethod(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-[#F6F6F2] text-black mb-4 border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
                  rows={5}
                  disabled={loadingUpload}
                />
              </>
            ) : null}

            {uploadStep === 3 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-[#EAF8E2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#348B2C]">
                    Final Step
                  </div>
                  <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">Ready to upload</h2>
                </div>
                <div className="rounded-[2rem] bg-[linear-gradient(180deg,#F7F5EF_0%,#FFFDF8_100%)] border border-black/10 p-4 mb-5 shadow-inner">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0">
                      {preview ? (
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/30">
                          <Camera size={24} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{dishName || "Untitled dish"}</div>
                      {dishDescription ? (
                        <div className="mt-1 text-sm text-black/60 line-clamp-3">{dishDescription}</div>
                      ) : null}
                      {dishTags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dishTags.slice(0, 4).map((tag) => (
                            <span key={tag} className={`px-2.5 py-1 rounded-full text-[11px] border ${getTagChipClass(tag, true)}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-5 text-sm font-medium text-black">
                  <input
                    type="checkbox"
                    checked={dishIsPublic}
                    onChange={(e) => setDishIsPublic(e.target.checked)}
                    disabled={loadingUpload}
                  />
                  Public dish (visible in feed)
                </label>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePost}
                  className="w-full bg-gradient-to-r from-[#111111] via-[#272727] to-[#111111] text-white py-3 rounded-full font-semibold hover:opacity-90 transition shadow-xl"
                  disabled={loadingUpload}
                >
                  {loadingUpload ? "Uploading..." : "Upload dish"}
                </motion.button>
              </>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              {uploadStep > 0 ? (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-md"
                  disabled={loadingUpload}
                  aria-label="Previous step"
                >
                  <ArrowLeft size={20} />
                </button>
              ) : (
                <div />
              )}

              {uploadStep < 3 ? (
                <div className="flex items-center gap-3">
                  {uploadStep === 2 ? (
                    <button
                      type="button"
                      onClick={() => setUploadStep(3)}
                      className="text-sm font-semibold text-black/55"
                      disabled={loadingUpload}
                    >
                      Skip
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="w-14 h-14 rounded-full bg-gradient-to-r from-[#FF7A59] via-[#FFCC33] to-[#7AD957] text-black flex items-center justify-center shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
                    disabled={loadingUpload}
                    aria-label="Continue"
                  >
                    <ArrowRight size={22} />
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="w-full max-w-md mx-auto"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 backdrop-blur px-4 py-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-black/50 shadow-sm">
                DishList Studio
              </div>
              <h2 className="mt-4 text-[2.8rem] leading-[0.9] font-semibold text-black">Add something worth saving.</h2>
            </div>
            <div className="space-y-4">
              <button
                onClick={openUploadFlow}
                className="w-full rounded-[2.25rem] bg-[linear-gradient(135deg,#111111_0%,#1D1D1D_40%,#FF7A59_100%)] text-white px-6 py-7 text-left shadow-[0_30px_60px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.01] border border-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-3xl font-semibold leading-none">Upload dish</p>
                    <p className="mt-3 text-sm text-white/70 max-w-[15rem]">Turn a home favorite into a post.</p>
                  </div>
                  <div className="w-16 h-16 rounded-[1.4rem] bg-white/10 flex items-center justify-center border border-white/10">
                    <Plus size={32} />
                  </div>
                </div>
              </button>
              <button
                onClick={() => router.push("/dishes")}
                className="w-full rounded-[2.25rem] border border-black/10 bg-[linear-gradient(135deg,#FFF8E9_0%,#F2F6E9_100%)] px-6 py-7 text-left shadow-[0_24px_50px_rgba(0,0,0,0.08)] transition-transform hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-3xl font-semibold leading-none text-black">Search dish</p>
                    <p className="mt-3 text-sm text-black/60 max-w-[15rem]">Find it first if it already exists.</p>
                  </div>
                  <div className="w-16 h-16 rounded-[1.4rem] bg-white/70 flex items-center justify-center border border-black/5">
                    <Search size={30} />
                  </div>
                </div>
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
