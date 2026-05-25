"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, CircleUserRound, Plus, Search, Send, X } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import AppToast from "../../components/AppToast";
import AuthPromptModal from "../../components/AuthPromptModal";
import DishlistPickerModal from "../../components/DishlistPickerModal";
import ImageFramingModal from "../../components/ImageFramingModal";
import IngredientBulletTextarea from "../../components/IngredientBulletTextarea";
import { CookingHomeIcon, DISH_MODE_COOKING, DISH_MODE_RESTAURANT, RestaurantForkKnifeIcon } from "../../components/DishModeControls";
import RestaurantPlacePicker from "../../components/RestaurantPlacePicker";
import { RatingStars } from "../../components/RatingStars";
import { useAuth } from "../lib/auth";
import { dispatchPushEvent } from "../lib/pushClient";
import {
  getAllDishlistsForUser,
  publishCustomStory,
  saveDishToFirestore,
  saveDishToSelectedDishlist,
  uploadDishImageVariants,
} from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "../lib/tags";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { useLanguage } from "../../components/LanguageProvider";
import { db } from "../lib/firebase";
import { clearSessionPageCache } from "../lib/sessionPageCache";

const UPLOAD_STEP_PREVIEW = [
  { label: "Name", color: "#E64646" },
  { label: "Info", color: "#F59E0B" },
  { label: "Tags", color: "#23C268" },
  { label: "Upload", color: "#111111" },
];

const PRICE_CURRENCIES = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "CHF", symbol: "Fr." },
  { code: "JPY", symbol: "¥" },
];

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const { t, language, darkMode } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishLink, setDishLink] = useState("");
  const [dishRecipeIngredients, setDishRecipeIngredients] = useState("");
  const [dishRecipeMethod, setDishRecipeMethod] = useState("");
  const [storyTaggedUser, setStoryTaggedUser] = useState("");
  const [storyTaggedUserId, setStoryTaggedUserId] = useState("");
  const [dishTags, setDishTags] = useState([]);
  const [dishRating, setDishRating] = useState(0);
  const [dishPrice, setDishPrice] = useState("");
  const [dishPriceCurrency, setDishPriceCurrency] = useState("EUR");
  const [dishIsPublic, setDishIsPublic] = useState(true);
  const [dishImage, setDishImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageFramingFile, setImageFramingFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [storyMode, setStoryMode] = useState(false);
  const [directEntryMode, setDirectEntryMode] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [dishlistPickerOpen, setDishlistPickerOpen] = useState(false);
  const [dishlists, setDishlists] = useState([]);
  const [dishlistsLoading, setDishlistsLoading] = useState(false);
  const [selectedDishlistIds, setSelectedDishlistIds] = useState(["all_dishes", "uploaded"]);
  const [targetDishlistId, setTargetDishlistId] = useState("to_try");
  const [showLinkField, setShowLinkField] = useState(false);
  const [dishMode, setDishMode] = useState(DISH_MODE_COOKING);
  const [restaurant, setRestaurant] = useState(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [tagUserPickerOpen, setTagUserPickerOpen] = useState(false);
  const [taggableUsers, setTaggableUsers] = useState([]);
  const [tagUserSearch, setTagUserSearch] = useState("");
  const [tagUsersLoading, setTagUsersLoading] = useState(false);
  const libraryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const navigateBackToOrigin = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const params = new URLSearchParams();
    if (targetDishlistId && targetDishlistId !== "to_try") {
      params.set("list", targetDishlistId);
    }
    router.replace(`/profile${params.toString() ? `?${params.toString()}` : ""}`);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextStoryMode = params.get("story") === "1";
    const nextDirectMode = params.get("direct") === "1";
    const nextTargetDishlistId = params.get("targetList") || "to_try";
    setStoryMode(nextStoryMode);
    setDirectEntryMode(nextDirectMode);
    setShowUploadForm(nextStoryMode || nextDirectMode);
    setUploadStep(0);
    setTargetDishlistId(nextTargetDishlistId);
  }, []);

  useEffect(() => {
    if (!tagUserPickerOpen) return;
    let active = true;
    (async () => {
      setTagUsersLoading(true);
      try {
        const snap = await getDocs(collection(db, "users"));
        const usersList = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.id !== user?.uid);
        if (active) setTaggableUsers(usersList);
      } finally {
        if (active) setTagUsersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tagUserPickerOpen, user?.uid]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setShowAuthPrompt(true);
    }
  }, [loading, user]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const toggleTag = (tag) => {
    setDishTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 6) return prev;
      return [...prev, tag];
    });
  };

  const applySelectedMediaFile = (file) => {
    if (!file) return;
    setDishImage(file);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setMediaPickerOpen(false);
  };

  const handleImageChange = (file) => {
    if (!file) return;
    setMediaPickerOpen(false);
    if (file.type?.startsWith("image/")) {
      setImageFramingFile(file);
      return;
    }
    applySelectedMediaFile(file);
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
          recipeIngredients: isRestaurantUpload ? "" : dishRecipeIngredients.trim(),
          recipeMethod: isRestaurantUpload ? "" : dishRecipeMethod.trim(),
          tags: dishTags,
          rating: isRestaurantUpload ? dishRating : 0,
          price: dishPricePayload,
          priceAmount: dishPricePayload,
          restaurantPrice: dishPricePayload,
          priceCurrency: isRestaurantUpload ? dishPriceCurrency : "",
          currency: isRestaurantUpload ? dishPriceCurrency : "",
          taggedUserName: storyTaggedUser.trim(),
          taggedUserId: storyTaggedUserId || "",
          ...imageFields,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
          taggedUserName: storyTaggedUser.trim(),
          restaurant: dishMode === DISH_MODE_RESTAURANT ? restaurant : null,
        });
        if (!ok) throw new Error("Failed to publish story.");
        await dispatchPushEvent("story_posted", {
          ownerId: user.uid,
          storyName: dishName.trim(),
        });
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
          recipeIngredients: isRestaurantUpload ? "" : dishRecipeIngredients.trim(),
          recipeMethod: isRestaurantUpload ? "" : dishRecipeMethod.trim(),
          tags: dishTags,
          rating: isRestaurantUpload ? dishRating : 0,
          price: dishPricePayload,
          priceAmount: dishPricePayload,
          restaurantPrice: dishPricePayload,
          priceCurrency: isRestaurantUpload ? dishPriceCurrency : "",
          currency: isRestaurantUpload ? dishPriceCurrency : "",
          taggedUserName: storyTaggedUser.trim(),
          taggedUserId: storyTaggedUserId || "",
          isPublic: dishIsPublic,
          ...imageFields,
          owner: user.uid,
          ownerName: user.displayName || "Anonymous",
          ownerPhotoURL: user.photoURL || "",
          createdAt: new Date(),
        };
        const dishId = await saveDishToFirestore(dishPayload);
        clearSessionPageCache("feed:");
        clearSessionPageCache("explore:");
        clearSessionPageCache("people:");
        clearSessionPageCache("profile:");
        if (dishId) {
          await dispatchPushEvent("dish_posted", {
            ownerId: user.uid,
            dishId,
            dishName: dishPayload.name || "",
          });
        }
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
        setDishRating(0);
        setDishPrice("");
        setDishPriceCurrency("EUR");
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

  const openLibraryPicker = () => {
    setMediaPickerOpen(false);
    if (libraryInputRef.current) {
      libraryInputRef.current.value = "";
    }
    libraryInputRef.current?.click();
  };

  const openCameraPicker = () => {
    setMediaPickerOpen(false);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    cameraInputRef.current?.click();
  };

  const filteredTaggableUsers = taggableUsers.filter((candidate) =>
    (candidate.displayName || "").toLowerCase().includes(tagUserSearch.trim().toLowerCase())
  );
  const isRestaurantUpload = dishMode === DISH_MODE_RESTAURANT;
  const visibleUploadSteps = UPLOAD_STEP_PREVIEW;
  const normalizedDishPrice = Number(String(dishPrice).replace(/[^\d.,]/g, "").replace(",", "."));
  const dishPricePayload = isRestaurantUpload && Number.isFinite(normalizedDishPrice) && normalizedDishPrice > 0
    ? normalizedDishPrice
    : null;

  useEffect(() => {
    if (!isRestaurantUpload && dishRating !== 0) setDishRating(0);
  }, [dishRating, isRestaurantUpload]);

  const goToNextStep = () => {
    if (uploadStep === 0 && !dishName.trim()) {
      setToastVariant("error");
      setToast("Dish name is required");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setUploadStep((prev) => {
      return Math.min(prev + 1, 3);
    });
  };

  const openDishlistPicker = async () => {
    if (!user || storyMode) {
      handlePost();
      return;
    }
    setDishlistPickerOpen(true);
    setDishlistsLoading(true);
    try {
      const nextLists = await getAllDishlistsForUser(user.uid);
      setDishlists(nextLists);
      const nextSelectedIds = ["all_dishes", "uploaded"];
      setSelectedDishlistIds(Array.from(new Set(nextSelectedIds)));
    } finally {
      setDishlistsLoading(false);
    }
  };

  const goToPreviousStep = () => {
    setUploadStep((prev) => {
      return Math.max(prev - 1, 0);
    });
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
    <div className={`${showUploadForm ? "h-[100dvh] overflow-y-auto" : "bottom-nav-spacer h-[100dvh] overflow-hidden"} bg-transparent text-black flex flex-col`}>
      {!showUploadForm ? (
        <div className="app-top-nav px-4 pb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold leading-none text-left">Add to a DishList</h1>
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
      ) : null}

      <div className={showUploadForm ? "fixed inset-0 z-[80] overflow-y-auto bg-black/45 px-4 py-4 backdrop-blur-sm flex items-center justify-center" : "screen-between-navs-center px-4"}>
        {showUploadForm ? (
          <div className="w-full max-w-md mx-auto">
            <div className="mb-4 flex items-center justify-between">
              {directEntryMode ? (
                <h1 className="text-[2.05rem] leading-[0.95] font-semibold text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.34)]">
                  {language === "it" ? "Aggiungi un piatto" : "Add a dish"}
                </h1>
              ) : (
                <div className="h-11 w-11" />
              )}
              <button
                type="button"
                onClick={closeUploadFlow}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/22 bg-black/18 text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm"
                aria-label="Close upload"
              >
                <X size={18} />
              </button>
            </div>
          <motion.div
            className={`upload-step-modal max-h-[calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-1rem)] overflow-y-auto p-4 rounded-[1.75rem] w-full shadow-[0_20px_55px_rgba(0,0,0,0.08)] border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} ${darkMode ? "bg-[#101010] text-white" : dishMode === DISH_MODE_RESTAURANT ? "bg-[#FFFDFC]" : "bg-white"} my-0`}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="h-11 w-11" />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`no-accent-border h-1.5 rounded-full transition-all ${
                      step <= uploadStep
                        ? step === 0
                          ? "w-10 bg-[#E64646]"
                          : step === 1
                            ? "w-10 bg-[#F59E0B]"
                            : step === 2
                              ? "w-10 bg-[#23C268]"
                              : "w-10 bg-[#38BDF8]"
                        : darkMode
                          ? "w-7 bg-white/16"
                          : "w-7 bg-[#C9C9C2]"
                    }`}
                    style={step > uploadStep ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.92)" } : undefined}
                  />
                ))}
              </div>
              {!directEntryMode ? (
                <button
                  type="button"
                  onClick={closeUploadFlow}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} bg-white text-black/70 shadow-[0_10px_24px_rgba(0,0,0,0.08)]`}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              ) : (
                <div className="h-11 w-11" />
              )}
            </div>

            {uploadStep === 0 ? (
              <>
                <div className="mb-4">
                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {storyMode
                      ? language === "it"
                        ? "Titolo e foto della storia"
                        : "Story title and photo"
                      : language === "it"
                        ? "Nome e foto"
                        : "Name and photo"}
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
                    className={`rounded-[1.05rem] border px-3.5 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.07)] transition active:scale-[0.985] ${dishMode === DISH_MODE_COOKING ? "border-[#F0A623]/65 bg-[#F0A623] text-black" : darkMode ? "border-white/10 bg-white/[0.055] text-white/64" : "border-black/8 bg-white/72 text-black/58"}`}
                  >
                      <div className="grid min-h-[2.6rem] grid-cols-[2.25rem,1fr] items-center gap-2.5">
                        <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.8rem] ${dishMode === DISH_MODE_COOKING ? "bg-black/10 text-black" : "border border-[#F0A623]/45 bg-[#2A210A] text-[#F0A623]"}`}>
                          <CookingHomeIcon className="h-5 w-5" strokeWidth={2.35} />
                        </span>
                        <div className="min-w-0">
	                        <div className="truncate text-[14px] font-black leading-none">Casa</div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishMode(DISH_MODE_RESTAURANT)}
	                      className={`rounded-[1.05rem] border px-3.5 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.07)] transition active:scale-[0.985] ${dishMode === DISH_MODE_RESTAURANT ? "border-[#E64646]/65 bg-[#E64646] text-black" : darkMode ? "border-white/10 bg-white/[0.055] text-white/64" : "border-black/8 bg-white/72 text-black/58"}`}
                    >
                      <div className="grid min-h-[2.6rem] grid-cols-[2.25rem,1fr] items-center gap-2.5">
                        <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.8rem] ${dishMode === DISH_MODE_RESTAURANT ? "bg-black/10 text-black" : "border border-[#E64646]/45 bg-[#2A1111] text-[#E64646]"}`}>
                          <RestaurantForkKnifeIcon className="h-5 w-5" strokeWidth={2.35} />
                        </span>
                        <div className="min-w-0">
	                        <div className="truncate text-[14px] font-black leading-none">Ristorante</div>
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
                      accent="restaurant"
                    />
                  </div>
                ) : null}
                <input
                  type="text"
                  placeholder="Dish name"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  enterKeyHint="next"
                    className={`w-full p-4 rounded-full bg-white text-black mb-4 border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border shadow-[0_10px_24px_rgba(230,70,70,0.14)] focus:ring-[#E64646]/25" : "border-[#E5C15A] shadow-[0_10px_24px_rgba(229,193,90,0.14)] focus:ring-[#E5C15A]/30"} focus:outline-none focus:ring-2 text-base`}
                  disabled={loadingUpload}
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!loadingUpload && !preview) setMediaPickerOpen(true);
                  }}
                  className={`w-full h-36 rounded-[1.65rem] border-2 border-dashed ${
                    dragActive
                      ? dishMode === DISH_MODE_RESTAURANT
                        ? "restaurant-accent-border bg-[#FFE8E4]"
                        : "border-[#F59E0B] bg-[#FFF1CC]"
	                      : darkMode
	                        ? dishMode === DISH_MODE_RESTAURANT
	                          ? "restaurant-accent-border bg-[#241313]"
	                          : "border-[#F0A623] bg-[#211806]"
	                        : dishMode === DISH_MODE_RESTAURANT
	                          ? "restaurant-accent-border bg-[linear-gradient(180deg,#FFF1F1_0%,#FFF8F2_100%)]"
	                          : "border-[#D9CCB6] bg-[linear-gradient(180deg,#FFF7E2_0%,#F5FFE7_100%)]"
	                  } flex items-center justify-center ${darkMode ? "text-white/75" : "text-black/50"} mb-4 cursor-pointer relative overflow-hidden`}
                >
                  <input
                    ref={libraryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                    className="hidden"
                    disabled={loadingUpload}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                    className="hidden"
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
                        <div className={`w-16 h-16 rounded-full border-2 text-white flex items-center justify-center shadow-lg ${
                          dishMode === DISH_MODE_RESTAURANT
                            ? "restaurant-accent-border bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)]"
                            : "border-transparent bg-[linear-gradient(135deg,#4AB7D8_0%,#6B8BFF_100%)]"
                        }`}>
                        <Camera size={28} />
                      </div>
                      <div className="text-sm font-medium">Add a photo or video</div>
	                      <div className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>Optional</div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {uploadStep === 1 ? (
              <>
                {isRestaurantUpload ? (
                  <>
                    <div className="mb-4">
                      <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                        {language === "it" ? "Dettagli ristorante" : "Restaurant details"}
                      </h2>
                    </div>
                    <div className={`mb-4 rounded-[1.35rem] border-2 px-4 py-3 restaurant-accent-border ${darkMode ? "bg-[#181818]" : "bg-white/85"}`}>
                      <div className={`mb-2 text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                        {language === "it" ? "Valutazione" : "Rating"}
                      </div>
                      <RatingStars value={dishRating} onChange={setDishRating} size="text-[1.55rem]" />
                    </div>
                    <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        placeholder={language === "it" ? "Prezzo" : "Price"}
                        value={dishPrice}
                        onChange={(e) => setDishPrice(e.target.value)}
                        className="min-w-0 rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-[16px] text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                        disabled={loadingUpload}
                      />
                      <select
                        value={dishPriceCurrency}
                        onChange={(e) => setDishPriceCurrency(e.target.value)}
                        inputMode="none"
                        className="rounded-full border-2 restaurant-accent-border bg-white px-3 py-3 text-[16px] font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                        disabled={loadingUpload}
                      >
                        {PRICE_CURRENCIES.map((currency) => (
                          <option key={currency.code} value={currency.code}>{currency.symbol}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setShowLinkField((prev) => !prev)}
                        className="inline-flex items-center rounded-full border-2 restaurant-accent-border bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55"
                      >
                        {showLinkField || dishLink ? "Dish link" : "Add link"}
                      </button>
                      {showLinkField || dishLink ? (
                        <input
                          type="text"
                          placeholder="https://..."
                          value={dishLink}
                          onChange={(e) => setDishLink(e.target.value)}
                          inputMode="url"
                          enterKeyHint="done"
                          className="mt-3 w-full rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-base text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                          disabled={loadingUpload}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      ) : null}
                    </div>
                    <div className="mb-4">
                      <p className={`mb-2 text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>
                        {language === "it" ? "Tagga un utente" : "Tag a user"}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTagUserPickerOpen(true)}
                          className="flex-1 rounded-full border-2 restaurant-accent-border bg-white px-4 py-3 text-left text-base text-black focus:outline-none focus:ring-2 focus:ring-[#E64646]/20"
                          disabled={loadingUpload}
                        >
                          {storyTaggedUser
                            ? `@${storyTaggedUser.replace(/^@+/, "")}`
                            : language === "it"
                              ? "Seleziona utente (opzionale)"
                              : "Select user (optional)"}
                        </button>
                        {storyTaggedUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStoryTaggedUser("");
                              setStoryTaggedUserId("");
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/55"
                            aria-label="Clear tagged user"
                          >
                            <X size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                <div className="mb-4 text-center">
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-black/35">Optional</div>
                </div>
                <h2 className="text-[1.75rem] leading-none font-semibold mb-4 text-black text-center">Ingredients and recipe</h2>
	                <IngredientBulletTextarea
	                  placeholder="Ingredients"
	                  value={dishRecipeIngredients}
	                  onChange={setDishRecipeIngredients}
	                  className="w-full p-4 rounded-[1.5rem] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3FFF7_100%)] text-black mb-3 border-2 default-accent-border shadow-[0_12px_26px_rgba(43,211,107,0.12)] focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                  rows={3}
	                  disabled={loadingUpload}
	                />
	                <textarea
	                  placeholder="Method"
	                  value={dishRecipeMethod}
	                  onChange={(e) => setDishRecipeMethod(e.target.value)}
	                  className="w-full p-4 rounded-[1.5rem] bg-white/80 text-black mb-3 border-2 border-black/10 focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                  rows={2}
	                  disabled={loadingUpload}
	                />
	                <div className="mb-3 grid grid-cols-2 gap-2">
	                  <button
	                    type="button"
	                    onClick={() => setShowLinkField((prev) => !prev)}
	                    className="rounded-full border-2 default-accent-border bg-white/85 px-3 py-2 text-[12px] font-semibold text-black/65"
	                  >
	                    {showLinkField || dishLink ? "Dish link" : "Add link"}
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => setTagUserPickerOpen(true)}
	                    className="truncate rounded-full border-2 default-accent-border bg-white/85 px-3 py-2 text-[12px] font-semibold text-black/65"
	                    disabled={loadingUpload}
	                  >
	                    {storyTaggedUser ? `@${storyTaggedUser.replace(/^@+/, "")}` : language === "it" ? "Tagga utente" : "Tag user"}
	                  </button>
	                </div>
	                {showLinkField || dishLink ? (
	                  <input
	                    type="text"
	                    placeholder="https://..."
	                    value={dishLink}
	                    onChange={(e) => setDishLink(e.target.value)}
	                    inputMode="url"
	                    enterKeyHint="done"
	                    className="mb-4 w-full rounded-full border-2 default-accent-border bg-white px-4 py-3 text-base text-black focus:outline-none focus:ring-2 focus:ring-[#67C587]/20"
	                    disabled={loadingUpload}
	                    autoCapitalize="none"
	                    autoCorrect="off"
	                    spellCheck={false}
	                  />
	                ) : null}
                  </>
                )}
	              </>
	            ) : null}

            {uploadStep === 2 ? (
              <>
                <div className="mb-4">
	                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {storyMode ? "Story details and tags" : "Description and tags"}
                  </h2>
                </div>
                <textarea
                  placeholder="Description"
                  value={dishDescription}
	                  onChange={(e) => setDishDescription(e.target.value)}
	                  className={`w-full p-4 rounded-[1.5rem] bg-white text-black mb-4 border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border focus:ring-[#E64646]/20" : "default-accent-border focus:ring-[#FF7A59]/20"} focus:outline-none focus:ring-2`}
	                  rows={1}
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
	                        className={`px-3 py-1 rounded-full text-xs border-2 transition ${darkMode ? getDarkTagChipClass(tag, active) : `${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : ""} ${getTagChipClass(tag, active)}`}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {uploadStep === 3 ? (
              <>
                <div className="mb-4">
	                  <h2 className={`text-[1.75rem] leading-none font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                    {storyMode ? "Review and publish" : "Review and upload"}
                  </h2>
                </div>
	                <div className={`rounded-[2rem] ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} ${darkMode ? "bg-[#171717] text-white" : dishMode === DISH_MODE_RESTAURANT ? "bg-[linear-gradient(180deg,#FFF3F3_0%,#FFF0E8_55%,#FFF8F1_100%)]" : "bg-[linear-gradient(180deg,#F7F2E8_0%,#FFF5E0_55%,#F3FFE8_100%)]"} border-2 p-4 mb-5`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-24 h-24 rounded-2xl overflow-hidden bg-black/5 shrink-0 border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"}`}>
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
	                        <div className={`mt-1 text-sm line-clamp-3 ${darkMode ? "text-white/65" : "text-black/60"}`}>{dishDescription}</div>
                      ) : null}
                      {storyTaggedUser.trim() ? (
                        <div className={`mt-2 inline-flex max-w-full items-center rounded-full border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} bg-[#FFF8EE] px-3 py-1 text-[11px] font-semibold text-[#8A5414]`}>
                          @{storyTaggedUser.trim().replace(/^@+/, "")}
                        </div>
                      ) : null}
                      {dishLink ? (
                        <div className={`mt-2 inline-flex max-w-full items-center rounded-full border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} bg-white/72 px-3 py-1 text-[11px] font-medium text-black/62`}>
                          <span className="truncate">{getNormalizedDishLink()}</span>
                        </div>
                      ) : null}
                      {dishTags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dishTags.slice(0, 4).map((tag) => (
	                            <span key={tag} className={`px-2.5 py-1 rounded-full text-[11px] border-2 ${darkMode ? getDarkTagChipClass(tag, true) : `${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : ""} ${getTagChipClass(tag, true)}`}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {!storyMode ? (
                  <button
                    type="button"
                    onClick={() => setDishIsPublic((value) => !value)}
                    disabled={loadingUpload}
                    className={`dish-public-toggle ${dishIsPublic ? "dish-public-toggle--active" : ""} mb-5 flex w-full items-center justify-between gap-4 px-4 py-3 text-left`}
                    aria-pressed={dishIsPublic}
                  >
                    <span>
                      <span className={`block text-sm font-black ${darkMode ? "text-white" : "text-black"}`}>{t("Public dish")}</span>
                      <span className={`mt-0.5 block text-xs font-semibold ${darkMode ? "text-white/58" : "text-black/54"}`}>
                        {dishIsPublic ? t("Visible in feed") : t("Hidden from feed")}
                      </span>
                    </span>
                    <span className="dish-public-toggle__switch no-accent-border shrink-0">
                      <span className="dish-public-toggle__knob no-accent-border" />
                    </span>
                  </button>
                ) : null}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={openDishlistPicker}
                  className="w-full rounded-full border-2 border-[#45C47A]/55 bg-[#1FA463] py-3 font-semibold text-white shadow-[0_12px_26px_rgba(31,164,99,0.22)] transition hover:brightness-105"
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
                    className={`w-12 h-12 rounded-full border-2 ${dishMode === DISH_MODE_RESTAURANT ? "restaurant-accent-border" : "default-accent-border"} flex items-center justify-center bg-white shadow-sm`}
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
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#45C47A]/55 bg-[#1FA463] text-white shadow-[0_12px_26px_rgba(31,164,99,0.22)] transition hover:brightness-105"
                    disabled={loadingUpload}
                    aria-label="Continue"
                  >
                    <ArrowRight size={22} />
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
          </div>
        ) : (
          <motion.div
            className="w-full max-w-md mx-auto pt-0"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="mb-4 text-center">
              <h2 className={`text-[2.05rem] leading-[0.95] font-semibold ${darkMode ? "text-white" : "text-black"}`}>Add a dish</h2>
            </div>
            <div className="space-y-4">
              <button
                onClick={openUploadFlow}
                className={`preserve-blue-border w-full min-h-[13rem] rounded-[2rem] px-6 py-6 text-left transition-transform hover:scale-[1.01] border-[3px] border-[#5FA8F2] backdrop-blur-[6px] ${
                  darkMode ? "bg-[#101B29] text-white shadow-[0_18px_40px_rgba(95,168,242,0.14)]" : "bg-[rgba(255,255,255,0.72)] text-black shadow-[0_18px_40px_rgba(66,143,223,0.12)]"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-semibold leading-[0.95]">{t("Upload dish")}</p>
                      <p className={`mt-4 text-base max-w-[17rem] ${darkMode ? "text-white/68" : "text-black/78"}`}>Post a new dish to your DishList.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#E64646] text-white flex items-center justify-center shadow-md border-[2px] border-[#E64646]/55 shrink-0 aspect-square">
                      <Plus size={32} />
                    </div>
                  </div>
                  <div>
                    <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/50" : "text-black/55"}`}>
                      Steps
                    </div>
                    <div className={`grid gap-3 ${isRestaurantUpload ? "grid-cols-3" : "grid-cols-4"}`}>
                      {visibleUploadSteps.map((step) => (
                        <div key={step.label}>
                          <div
                            className="mb-2 h-1.5 rounded-full"
                            style={{ backgroundColor: step.color }}
                          />
                          <div className={`text-[0.72rem] font-medium ${darkMode ? "text-white/62" : "text-black/72"}`}>{step.label}</div>
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
                className={`preserve-green-border w-full min-h-[13rem] rounded-[2rem] border-[3px] border-[#1EA956] px-6 py-6 text-left transition-transform hover:scale-[1.01] backdrop-blur-[6px] ${
                  darkMode ? "bg-[#102016] text-white shadow-[0_18px_40px_rgba(35,194,104,0.13)]" : "bg-[rgba(255,255,255,0.72)] shadow-[0_18px_40px_rgba(23,130,67,0.12)]"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className={`text-[1.9rem] font-semibold leading-none ${darkMode ? "text-white" : "text-black"}`}>{t("Find dish")}</p>
                      <p className={`mt-4 text-base max-w-[15rem] ${darkMode ? "text-white/64" : "text-black/70"}`}>See if it already exists.</p>
                    </div>
                    <div className="size-16 rounded-[1.4rem] bg-[#F0A623] text-white flex items-center justify-center border-[2px] border-[#F0A623]/55 shadow-md shrink-0 aspect-square">
                      <Search size={30} />
                    </div>
                  </div>
                  <div>
                    <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/50" : "text-black/55"}`}>
                      Tags you can explore
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TAG_OPTIONS.slice(0, 10).map((tag) => (
                        <span
                          key={tag}
                          className={`px-3 py-1 rounded-full text-[11px] border ${darkMode ? getDarkTagChipClass(tag, true) : getTagChipClass(tag, true)}`}
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
        {tagUserPickerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setTagUserPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className={`w-full max-w-md rounded-[1.75rem] border p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)] ${
                darkMode
                  ? "border-white/12 bg-[linear-gradient(180deg,rgba(28,28,26,0.98)_0%,rgba(13,13,12,0.98)_100%)] text-white"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,236,0.98)_100%)] text-black"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-[1.35rem] font-semibold leading-none ${darkMode ? "text-white" : "text-black"}`}>
                    {language === "it" ? "Tagga un utente" : "Tag a user"}
                  </h3>
                  <p className={`mt-2 text-sm ${darkMode ? "text-white/56" : "text-black/58"}`}>
                    {language === "it" ? "Cerca per nome" : "Search by name"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTagUserPickerOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    darkMode ? "border-white/12 bg-white/8 text-white/65" : "border-black/10 bg-white text-black/55"
                  }`}
                  aria-label="Close tag user picker"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder={language === "it" ? "Cerca utenti..." : "Search users..."}
                value={tagUserSearch}
                onChange={(e) => setTagUserSearch(e.target.value)}
                className={`w-full rounded-[1rem] border px-4 py-3 text-base shadow-[0_10px_24px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 ${
                  darkMode
                    ? "border-white/12 bg-white/8 text-white placeholder:text-white/32 focus:ring-white/18"
                    : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-black/12"
                }`}
              />
              <div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
                {tagUsersLoading ? (
                  <div className={`rounded-[1rem] px-4 py-5 text-sm ${darkMode ? "bg-white/8 text-white/56" : "bg-white/72 text-black/58"}`}>
                    {language === "it" ? "Caricamento..." : "Loading..."}
                  </div>
                ) : filteredTaggableUsers.length === 0 ? (
                  <div className={`rounded-[1rem] px-4 py-5 text-sm ${darkMode ? "bg-white/8 text-white/56" : "bg-white/72 text-black/58"}`}>
                    {language === "it" ? "Nessun utente trovato." : "No users found."}
                  </div>
                ) : (
                  filteredTaggableUsers.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        setStoryTaggedUser(candidate.displayName || "User");
                        setStoryTaggedUserId(candidate.id);
                        setTagUserPickerOpen(false);
                        setTagUserSearch("");
                      }}
                      className={`flex w-full items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${
                        darkMode ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${
                        darkMode ? "bg-white/12 text-white/72" : "bg-black/10 text-black/65"
                      }`}>
                        {candidate.photoURL ? (
                          <img src={candidate.photoURL} alt={candidate.displayName || "User"} className="h-full w-full object-cover" />
                        ) : (
                          (candidate.displayName?.[0] || "U").toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate text-base font-semibold ${darkMode ? "text-white" : "text-black"}`}>{candidate.displayName || "User"}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        {mediaPickerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/28 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-[2px]"
            onClick={() => setMediaPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`w-full max-w-md rounded-[1.75rem] border-2 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${darkMode ? "border-white/12 bg-[#111111] text-white" : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,236,0.98)_100%)] text-black"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 pb-3 pt-1 text-center">
                <div className={`text-[1.05rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Add media")}</div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openLibraryPicker}
	                  className={`flex w-full items-center justify-between rounded-[1.2rem] border-2 px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white" : "border-black/10 bg-white text-black"}`}
                >
                  <div>
	                    <div className={`text-[0.98rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Photo library")}</div>
	                    <div className={`mt-0.5 text-[0.8rem] ${darkMode ? "text-white/52" : "text-black/48"}`}>{t("Pick a photo or video")}</div>
                  </div>
	                  <Plus size={24} className={darkMode ? "text-white/65" : "text-black/55"} />
                </button>
                <button
                  type="button"
                  onClick={openCameraPicker}
	                  className={`flex w-full items-center justify-between rounded-[1.2rem] border-2 px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white" : "border-black/10 bg-white text-black"}`}
                >
                  <div>
	                    <div className={`text-[0.98rem] font-semibold ${darkMode ? "text-white" : "text-black"}`}>{t("Take photo")}</div>
	                    <div className={`mt-0.5 text-[0.8rem] ${darkMode ? "text-white/52" : "text-black/48"}`}>{t("Open the camera")}</div>
                  </div>
	                  <Camera size={24} className={darkMode ? "text-white/65" : "text-black/55"} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMediaPickerOpen(false)}
	                className={`mt-3 flex w-full items-center justify-center rounded-[1.2rem] border-2 px-4 py-3 text-[0.92rem] font-semibold ${darkMode ? "border-white/12 bg-[#1C1C1C] text-white/72" : "border-black/10 bg-white text-black/70"}`}
              >
                {t("Cancel")}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
        <ImageFramingModal
          open={Boolean(imageFramingFile)}
          file={imageFramingFile}
          dishName={dishName}
          ownerName={user?.displayName || "You"}
          onCancel={() => setImageFramingFile(null)}
          onConfirm={(framedFile) => {
            setImageFramingFile(null);
            applySelectedMediaFile(framedFile);
          }}
        />
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
        lockedIds={["all_dishes", "uploaded"]}
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
      {!showUploadForm ? <BottomNav /> : null}
    </div>
  );
}
