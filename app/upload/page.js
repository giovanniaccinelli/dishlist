"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, CircleUserRound, Plus, Search, Send } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import AuthPromptModal from "../../components/AuthPromptModal";
import { useAuth } from "../lib/auth";
import { publishCustomStory, saveDishToFirestore, uploadDishImageVariants } from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { useUnreadDirects } from "../lib/useUnreadDirects";

const UPLOAD_STEP_PREVIEW = [
  { label: "Name", color: "#5FA8F2" },
  { label: "Details", color: "#23C268" },
  { label: "Recipe", color: "#D7B443" },
  { label: "Upload", color: "#111111" },
];

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
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
  const [storyMode, setStoryMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextStoryMode = params.get("story") === "1";
    setStoryMode(nextStoryMode);
    setShowUploadForm(nextStoryMode);
  }, []);

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
      let imageFields = { imageURL: "", cardURL: "", thumbURL: "" };
      if (dishImage) {
        imageFields = await uploadDishImageVariants(dishImage, user.uid);
      }
      if (storyMode) {
        const storyId = `story-${Date.now()}`;
        const ok = await publishCustomStory(user.uid, {
          id: storyId,
          dishId: storyId,
          name: dishName.trim(),
          description: dishDescription.trim(),
          recipeIngredients: dishRecipeIngredients.trim(),
          recipeMethod: dishRecipeMethod.trim(),
          tags: dishTags,
          ...imageFields,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
        });
        if (!ok) throw new Error("Failed to publish story.");
        router.replace("/profile");
      } else {
        await saveDishToFirestore({
          name: dishName.trim(),
          description: dishDescription.trim(),
          recipeIngredients: dishRecipeIngredients.trim(),
          recipeMethod: dishRecipeMethod.trim(),
          tags: dishTags,
          isPublic: dishIsPublic,
          ...imageFields,
          owner: user.uid,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
          createdAt: new Date(),
        });
        router.replace("/profile");
      }
    } catch (err) {
      console.error("Failed to upload dish:", err);
      alert(`Failed to ${storyMode ? "publish story" : "upload dish"}. Please try again.`);
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
    return <FullScreenLoading title="Loading upload" />;
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-hidden bg-transparent text-black flex flex-col">
      <div className="app-top-nav px-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-left">
          {showUploadForm ? (storyMode ? "Add to Story" : "Upload Dish") : "Add to DishList"}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/directs")}
            className="top-action-btn relative"
            aria-label="Directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </button>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="top-action-btn"
            aria-label="Profile"
          >
            <CircleUserRound size={18} />
          </button>
        </div>
      </div>

      <div className="screen-between-navs-center px-4">
        {showUploadForm ? (
          <motion.div
            className="bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)] p-5 rounded-[1.75rem] w-full max-w-md mx-auto shadow-[0_20px_55px_rgba(0,0,0,0.08)] border border-[#E3CFA7] my-0"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                onClick={() => {
                  if (uploadStep > 0) {
                    goToPreviousStep();
                    return;
                  }
                  setShowUploadForm(false);
                  setUploadStep(0);
                }}
                className="h-11 w-11 rounded-full border border-black/10 bg-white/82 text-black/70 shadow-[0_10px_24px_rgba(0,0,0,0.08)] backdrop-blur-[6px] flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-all ${
                      step <= uploadStep
                        ? step === 0
                          ? "w-10 bg-[#F59E0B]"
                          : step === 1
                            ? "w-10 bg-[#2BD36B]"
                            : step === 2
                              ? "w-10 bg-[#67C587]"
                              : "w-10 bg-[#E85D75]"
                        : "w-7 bg-black/10"
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-black/35">
                {uploadStep === 0 ? "Basics" : uploadStep === 1 ? "Details" : uploadStep === 2 ? "Recipe" : "Upload"}
              </div>
            </div>

            {uploadStep === 0 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Step 1
                  </div>
                  <h2 className="text-[1.75rem] leading-none font-semibold mt-3 text-black">
                    {storyMode ? "Story title and cover" : "Name and cover"}
                  </h2>
                </div>
                <input
                  type="text"
                  placeholder="Dish name"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                    className="w-full p-4 rounded-full bg-white/90 text-black mb-4 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/25 text-base"
                  disabled={loadingUpload}
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`w-full h-44 rounded-[1.65rem] border-2 border-dashed ${
                    dragActive ? "border-[#F59E0B] bg-[#FFF1CC]" : "border-[#D9CCB6] bg-[linear-gradient(180deg,#FFF7E2_0%,#F5FFE7_100%)]"
                  } flex items-center justify-center text-black/50 mb-4 cursor-pointer relative overflow-hidden`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                    disabled={loadingUpload}
                  />
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-[1.65rem]" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)] text-white flex items-center justify-center shadow-lg">
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">Add a photo</div>
                      <div className="text-xs text-black/40">Optional</div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {uploadStep === 1 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Step 2
                  </div>
                  <h2 className="text-[1.75rem] leading-none font-semibold mt-3 text-black">
                    {storyMode ? "Story details and tags" : "Description and tags"}
                  </h2>
                </div>
                <textarea
                  placeholder="Description"
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-5 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/20"
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
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-black/35">Optional</div>
                </div>
                <h2 className="text-[1.75rem] leading-none font-semibold mb-4 text-black text-center">Ingredients and recipe</h2>
                <textarea
                  placeholder="Ingredients"
                  value={dishRecipeIngredients}
                  onChange={(e) => setDishRecipeIngredients(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-3 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
                  rows={4}
                  disabled={loadingUpload}
                />
                <textarea
                  placeholder="Method"
                  value={dishRecipeMethod}
                  onChange={(e) => setDishRecipeMethod(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-white/90 text-black mb-4 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
                  rows={5}
                  disabled={loadingUpload}
                />
              </>
            ) : null}

            {uploadStep === 3 ? (
              <>
                <div className="mb-4">
                  <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                    Final Step
                  </div>
                  <h2 className="text-[1.75rem] leading-none font-semibold mt-3 text-black">
                    {storyMode ? "Review and publish" : "Review and upload"}
                  </h2>
                </div>
                <div className="rounded-[2rem] bg-[linear-gradient(180deg,#F7F2E8_0%,#FFF5E0_55%,#F3FFE8_100%)] border border-[#D8C090] p-4 mb-5">
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
                  className="w-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white py-3 rounded-full font-semibold hover:opacity-90 transition shadow-lg"
                  disabled={loadingUpload}
                >
                  {loadingUpload ? (storyMode ? "Publishing..." : "Uploading...") : (storyMode ? "Publish story" : "Upload dish")}
                </motion.button>
              </>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              {uploadStep > 0 ? (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm"
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
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white flex items-center justify-center shadow-lg"
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
            className="w-full max-w-md mx-auto pt-0"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="mb-4 text-center">
              <h2 className="text-[2.05rem] leading-[0.95] font-semibold text-black">Add a dish</h2>
            </div>
            <div className="space-y-4">
              <button
                onClick={openUploadFlow}
                className="w-full min-h-[13rem] rounded-[2rem] bg-[rgba(255,255,255,0.72)] text-black px-6 py-6 text-left shadow-[0_18px_40px_rgba(66,143,223,0.12)] transition-transform hover:scale-[1.01] border-[3px] border-[#5FA8F2] backdrop-blur-[6px]"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-semibold leading-[0.95]">Create dish</p>
                      <p className="mt-4 text-base text-black/78 max-w-[17rem]">Post a new dish to your DishList.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#5FA8F2] text-white flex items-center justify-center shadow-md border-[2px] border-[#5FA8F2]/55 shrink-0 aspect-square">
                      <Plus size={32} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                      Steps
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {UPLOAD_STEP_PREVIEW.map((step) => (
                        <div key={step.label}>
                          <div
                            className="mb-2 h-1.5 rounded-full"
                            style={{ backgroundColor: step.color }}
                          />
                          <div className="text-[0.72rem] font-medium text-black/72">{step.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => router.push(storyMode ? "/dishes?storyPicker=1" : "/dishes")}
                className="w-full min-h-[13rem] rounded-[2rem] border-[3px] border-[#1EA956] bg-[rgba(255,255,255,0.72)] px-6 py-6 text-left shadow-[0_18px_40px_rgba(23,130,67,0.12)] transition-transform hover:scale-[1.01] backdrop-blur-[6px]"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-semibold leading-none text-black">Find dish</p>
                      <p className="mt-4 text-base text-black/70 max-w-[15rem]">See if it already exists.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#1EA956] text-white flex items-center justify-center border-[2px] border-[#1EA956]/55 shadow-md shrink-0 aspect-square">
                      <Search size={30} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                      Tags you can explore
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TAG_OPTIONS.slice(0, 10).map((tag) => (
                        <span
                          key={tag}
                          className={`px-3 py-1 rounded-full text-[11px] border ${getTagChipClass(tag, true)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
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
