"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, CircleUserRound, Plus, Search, Send, X } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import AppToast from "../../components/AppToast";
import AuthPromptModal from "../../components/AuthPromptModal";
import DishlistPickerModal from "../../components/DishlistPickerModal";
import { CookingHomeIcon, DISH_MODE_COOKING, DISH_MODE_RESTAURANT, RestaurantMapIcon } from "../../components/DishModeControls";
import RestaurantPlacePicker from "../../components/RestaurantPlacePicker";
import { useAuth } from "../lib/auth";
import {
  getAllDishlistsForUser,
  publishCustomStory,
  saveDishToFirestore,
  saveDishToSelectedDishlist,
  uploadDishImageVariants,
} from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { useUnreadDirects } from "../lib/useUnreadDirects";

const UPLOAD_STEP_PREVIEW = [
  { label: "Name", color: "#E64646" },
  { label: "Details", color: "#F59E0B" },
  { label: "Recipe", color: "#23C268" },
  { label: "Upload", color: "#111111" },
];

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishLink, setDishLink] = useState("");
  const [dishRecipeIngredients, setDishRecipeIngredients] = useState("");
  const [dishRecipeMethod, setDishRecipeMethod] = useState("");
  const [storyTaggedUser, setStoryTaggedUser] = useState("");
  const [dishTags, setDishTags] = useState([]);
  const [dishIsPublic, setDishIsPublic] = useState(true);
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [storyMode, setStoryMode] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["uploaded", "saved"]);
  const [targetDishlistId, setTargetDishlistId] = useState("saved");
  const [showLinkField, setShowLinkField] = useState(false);
  const [dishMode, setDishMode] = useState(DISH_MODE_COOKING);
  const [restaurant, setRestaurant] = useState(null);

  const navigateBackToOrigin = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const params = new URLSearchParams();
    if (targetDishlistId && targetDishlistId !== "saved") {
      params.set("list", targetDishlistId);
    }
    router.replace(`/profile${params.toString() ? `?${params.toString()}` : ""}`);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextStoryMode = params.get("story") === "1";
    const nextTargetDishlistId = params.get("targetList") || "saved";
    setStoryMode(nextStoryMode);
    setShowUploadForm(nextStoryMode);
    setTargetDishlistId(nextTargetDishlistId);
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
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) handleImageChange(file);
  };

  const getNormalizedDishLink = () => {
    const trimmed = dishLink.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handlePost = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    if (!dishName.trim()) {
      setToastVariant("error");
      setToast("Dish name is required");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setDishlistPickerOpen(false);
    setLoadingUpload(true);
    try {
      let imageFields = { imageURL: "", cardURL: "", thumbURL: "", mediaType: "image", mediaMimeType: "" };
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
          dishLink: getNormalizedDishLink(),
          recipeIngredients: dishRecipeIngredients.trim(),
          recipeMethod: dishRecipeMethod.trim(),
          tags: dishTags,
          ...imageFields,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
          taggedUserName: storyTaggedUser.trim(),
          restaurant: dishMode === DISH_MODE_RESTAURANT ? restaurant : null,
        });
        if (!ok) throw new Error("Failed to publish story.");
        setToastVariant("success");
        setToast("Story published");
        setTimeout(() => navigateBackToOrigin(), 1200);
      } else {
        const dishPayload = {
          name: dishName.trim(),
          description: dishDescription.trim(),
          dishLink: getNormalizedDishLink(),
          dishMode,
          restaurant: dishMode === DISH_MODE_RESTAURANT ? restaurant : null,
          recipeIngredients: dishRecipeIngredients.trim(),
          recipeMethod: dishRecipeMethod.trim(),
          tags: dishTags,
          isPublic: dishIsPublic,
          ...imageFields,
          owner: user.uid,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
          createdAt: new Date(),
        };
        const dishId = await saveDishToFirestore(dishPayload);
        const savedTargets = selectedDishlistIds.filter((dishlistId) => dishlistId !== "uploaded");
        if (dishId && savedTargets.length) {
          const savedDish = { id: dishId, ...dishPayload };
          await Promise.all(
            savedTargets.map((dishlistId) => saveDishToSelectedDishlist(user.uid, dishlistId, savedDish))
          );
        }
        setToastVariant("success");
        setToast("Dish uploaded");
        setTimeout(() => navigateBackToOrigin(), 1200);
      }
    } catch (err) {
      console.error("Failed to upload dish:", err);
      setToastVariant("error");
      setToast(storyMode ? "Story failed" : "Upload failed");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setLoadingUpload(false);
    }
  };

  const openUploadFlow = () => {
    setShowUploadForm(true);
    setUploadStep(0);
    setRestaurant(null);
  };

  const goToNextStep = () => {
    if (uploadStep === 0 && !dishName.trim()) {
      setToastVariant("error");
      setToast("Dish name is required");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setUploadStep((prev) => Math.min(prev + 1, 3));
  };

  const openDishlistPicker = async () => {
    if (!user || storyMode) {
      handlePost();
      return;
    }
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = (await getAllDishlistsForUser(user.uid)).filter(
        (dishlist) => dishlist.id !== "all_dishes"
      );
      setDishlists(nextLists);
      const nextSelectedIds = ["uploaded"];
      if (targetDishlistId !== "all_dishes" && targetDishlistId !== "uploaded") {
        nextSelectedIds.push(targetDishlistId);
      } else {
        nextSelectedIds.push("saved");
      }
      setSelectedDishlistIds(Array.from(new Set(nextSelectedIds)));
    } finally {
      setDishlistsLoading(false);
    }
  };

  const goToPreviousStep = () => {
    setUploadStep((prev) => Math.max(prev - 1, 0));
  };

  const closeUploadFlow = () => {
    setShowUploadForm(false);
    setUploadStep(0);
    setRestaurant(null);
  };

  if (loading) {
    return <FullScreenLoading title="Loading upload" />;
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-hidden bg-transparent text-black flex flex-col">
      <div className="app-top-nav px-4 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold leading-none text-left">
          {showUploadForm ? (storyMode ? "Add to Story" : "Upload Dish") : "Add to a DishList"}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/directs")}
            className="top-action-btn relative"
            aria-label="Directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
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
            className="bg-white p-5 rounded-[1.75rem] w-full max-w-md mx-auto shadow-[0_20px_55px_rgba(0,0,0,0.08)] border border-black/10 my-0"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="h-11 w-11" />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-all ${
                      step <= uploadStep
                        ? step === 0
                          ? "w-10 bg-[#E64646]"
                          : step === 1
                            ? "w-10 bg-[#F59E0B]"
                            : step === 2
                              ? "w-10 bg-[#23C268]"
                              : "w-10 bg-[#111111]"
                        : "w-7 bg-black/10"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={closeUploadFlow}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/70 shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {uploadStep === 0 ? (
              <>
                <div className="mb-4">
                  <h2 className="text-[1.75rem] leading-none font-semibold text-black">
                    {storyMode ? "Story title and cover" : "Name and cover"}
                  </h2>
                </div>
                {true ? (
                  <div className="mb-4 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDishMode(DISH_MODE_COOKING);
                        setRestaurant(null);
                      }}
                      className={`rounded-[1.35rem] border-2 px-3 py-3 text-left ${dishMode === DISH_MODE_COOKING ? "border-[#F0A623] bg-[#FFF5DA]" : "border-black/10 bg-[#FFFDFC]"}`}
                    >
                      <div className="grid min-h-[4.45rem] grid-cols-[2.3rem,1fr] items-center gap-2">
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.72rem] bg-[#FFF1C9] text-[#F0A623]">
                          <CookingHomeIcon className="h-5 w-5" strokeWidth={2.05} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold leading-none text-black">Home</div>
                          <div className="mt-1 text-[8.5px] leading-[1.15] text-black/55">Recipe to cook at home</div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishMode(DISH_MODE_RESTAURANT)}
                      className={`rounded-[1.35rem] border-2 px-3 py-3 text-left ${dishMode === DISH_MODE_RESTAURANT ? "border-[#E64646] bg-[#FFE7E7]" : "border-black/10 bg-[#FFFDFC]"}`}
                    >
                      <div className="grid min-h-[4.45rem] grid-cols-[2.3rem,1fr] items-center gap-2">
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.72rem] bg-[#FFE2E2] text-[#E64646]">
                          <RestaurantMapIcon className="h-5 w-5" strokeWidth={2.05} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold leading-none text-black">Restaurant</div>
                          <div className="mt-1 text-[8.5px] leading-[1.15] text-black/55">Suggestion to eat out</div>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : null}
                {dishMode === DISH_MODE_RESTAURANT ? (
                  <div className="mb-4">
                    <RestaurantPlacePicker
                      value={restaurant}
                      onChange={setRestaurant}
                      placeholder="Search where you ate it"
                    />
                  </div>
                ) : null}
                <input
                  type="text"
                  placeholder="Dish name"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                    className={`w-full p-4 rounded-full bg-white text-black mb-4 border-[2px] ${dishMode === DISH_MODE_RESTAURANT ? "border-[#E64646] shadow-[0_10px_24px_rgba(230,70,70,0.14)] focus:ring-[#E64646]/25" : "border-[#E5C15A] shadow-[0_10px_24px_rgba(229,193,90,0.14)] focus:ring-[#E5C15A]/30"} focus:outline-none focus:ring-2 text-base`}
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
                    dragActive
                      ? dishMode === DISH_MODE_RESTAURANT
                        ? "border-[#E64646] bg-[#FFE8E4]"
                        : "border-[#F59E0B] bg-[#FFF1CC]"
                      : dishMode === DISH_MODE_RESTAURANT
                        ? "border-[#E64646] bg-[linear-gradient(180deg,#FFF1F1_0%,#FFF8F2_100%)]"
                        : "border-[#D9CCB6] bg-[linear-gradient(180deg,#FFF7E2_0%,#F5FFE7_100%)]"
                  } flex items-center justify-center text-black/50 mb-4 cursor-pointer relative overflow-hidden`}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                    disabled={loadingUpload}
                  />
                  {preview ? (
                    dishImage?.type?.startsWith("video/") ? (
                      <video
                        src={preview}
                        className="w-full h-full object-cover rounded-[1.65rem]"
                        autoPlay
                        muted
                        loop
                        playsInline
                        controls={false}
                      />
                    ) : (
                      <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-[1.65rem]" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)] text-white flex items-center justify-center shadow-lg">
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">Add a photo or video</div>
                      <div className="text-xs text-black/40">Optional</div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {uploadStep === 1 ? (
              <>
                <div className="mb-4">
                  <h2 className="text-[1.75rem] leading-none font-semibold text-black">
                    {storyMode ? "Story details and tags" : "Description and tags"}
                  </h2>
                </div>
                <textarea
                  placeholder="Description"
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full p-4 rounded-[1.5rem] bg-white text-black mb-5 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/20"
                  rows={4}
                  disabled={loadingUpload}
                />
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => setShowLinkField((prev) => !prev)}
                    className="inline-flex items-center rounded-full border border-[#D8C090] bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55"
                  >
                    {showLinkField || dishLink ? "Dish link" : "Add link"}
                  </button>
                  {showLinkField || dishLink ? (
                    <input
                      type="text"
                      placeholder="https://..."
                      value={dishLink}
                      onChange={(e) => setDishLink(e.target.value)}
                      className="mt-3 w-full rounded-full border border-[#D8C090] bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/20"
                      disabled={loadingUpload}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  ) : null}
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-black">Tags</p>
                  <p className="text-xs text-black/60">{dishTags.length}/6</p>
                </div>
                {storyMode ? (
                  <input
                    type="text"
                    placeholder="Tag a user (optional)"
                    value={storyTaggedUser}
                    onChange={(e) => setStoryTaggedUser(e.target.value)}
                    className="mb-4 w-full rounded-full border border-[#D8C090] bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/20"
                    disabled={loadingUpload}
                  />
                ) : null}
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
                  <h2 className="text-[1.75rem] leading-none font-semibold text-black">
                    {storyMode ? "Review and publish" : "Review and upload"}
                  </h2>
                </div>
                <div className="rounded-[2rem] bg-[linear-gradient(180deg,#F7F2E8_0%,#FFF5E0_55%,#F3FFE8_100%)] border border-[#D8C090] p-4 mb-5">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0">
                      {preview ? (
                        dishImage?.type?.startsWith("video/") ? (
                          <video
                            src={preview}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls={false}
                          />
                        ) : (
                          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        )
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
                      {storyMode && storyTaggedUser.trim() ? (
                        <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-[#E2C7A5] bg-[#FFF8EE] px-3 py-1 text-[11px] font-semibold text-[#8A5414]">
                          @{storyTaggedUser.trim().replace(/^@+/, "")}
                        </div>
                      ) : null}
                      {dishLink ? (
                        <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-[#D8C090] bg-white/72 px-3 py-1 text-[11px] font-medium text-black/62">
                          <span className="truncate">{getNormalizedDishLink()}</span>
                        </div>
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
                  onClick={openDishlistPicker}
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
                className="preserve-blue-border w-full min-h-[13rem] rounded-[2rem] bg-[rgba(255,255,255,0.72)] text-black px-6 py-6 text-left shadow-[0_18px_40px_rgba(66,143,223,0.12)] transition-transform hover:scale-[1.01] border-[3px] border-[#5FA8F2] backdrop-blur-[6px]"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-semibold leading-[0.95]">Create dish</p>
                      <p className="mt-4 text-base text-black/78 max-w-[17rem]">Post a new dish to your DishList.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#E64646] text-white flex items-center justify-center shadow-md border-[2px] border-[#E64646]/55 shrink-0 aspect-square">
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
                onClick={() => {
                  const params = new URLSearchParams();
                  if (storyMode) params.set("storyPicker", "1");
                  if (targetDishlistId) params.set("targetList", targetDishlistId);
                  router.push(`/dishes?${params.toString()}`);
                }}
                className="preserve-green-border w-full min-h-[13rem] rounded-[2rem] border-[3px] border-[#1EA956] bg-[rgba(255,255,255,0.72)] px-6 py-6 text-left shadow-[0_18px_40px_rgba(23,130,67,0.12)] transition-transform hover:scale-[1.01] backdrop-blur-[6px]"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-semibold leading-none text-black">Find dish</p>
                      <p className="mt-4 text-base text-black/70 max-w-[15rem]">See if it already exists.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#F0A623] text-white flex items-center justify-center border-[2px] border-[#F0A623]/55 shadow-md shrink-0 aspect-square">
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
      <DishlistPickerModal
        open={dishlistPickerOpen}
        onClose={() => setDishlistPickerOpen(false)}
        lists={dishlists}
        dishName={dishName || "dish"}
        loading={dishlistsLoading}
        mode="multiple"
        selectedIds={selectedDishlistIds}
        lockedIds={["uploaded"]}
        onToggle={(dishlist) =>
          setSelectedDishlistIds((prev) =>
            prev.includes(dishlist.id)
              ? prev.filter((id) => id !== dishlist.id)
              : [...prev, dishlist.id]
          )
        }
        onConfirm={handlePost}
        confirmLabel="Upload dish"
      />
      <AppToast message={toast} variant={toastVariant} />
      <BottomNav />
    </div>
  );
}
