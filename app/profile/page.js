"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCustomDishlist,
  deleteCustomDishlist,
  getCustomDishlistsForUser,
  uploadDishImageVariants,
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
  removeDishFromCustomDishlist,
  removeSavedDishFromUser,
  getStoryPushStatsForUser,
  getPopularCustomDishlistNames,
  updateCustomDishlistName,
  getAvatarTone,
  isDisplayNameTaken,
} from "../lib/firebaseHelpers";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import AppToast from "../../components/AppToast";
import { auth, db } from "../lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { Minus, MoreHorizontal, Pencil, Plus, Search, Settings, Send, Shuffle, Trash2, X } from "lucide-react";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import SaversModal from "../../components/SaversModal";
import StoryViewerModal from "../../components/StoryViewerModal";
import RestaurantMapView from "../../components/RestaurantMapView";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { dishModeMatches, DISH_MODE_ALL, DISH_MODE_COOKING, DishModeFilterButton, DishModeFilterModal, RestaurantMapIcon } from "../../components/DishModeControls";
import { getRestaurantDishGroups } from "../lib/restaurants";

const STORY_CHOOSER_STEPS = [
  { label: "Name", color: "#E64646" },
  { label: "Details", color: "#F59E0B" },
  { label: "Recipe", color: "#23C268" },
  { label: "Story", color: "#111111" },
];

function StoryStatIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="4.05" stroke="#2BD36B" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.8" stroke="#2BD36B" strokeWidth="1.8" opacity="0.88" />
      <path d="M1.35 3.55V8.7" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0.2 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M2.5 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M1.35 8.7V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function Profile() {
  const { user, loading, deleteAccount } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const router = useRouter();
  const pathname = usePathname();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [uploadedDishes, setUploadedDishes] = useState([]);
  const [savedDishes, setSavedDishes] = useState([]);
  const [toTryDishes, setToTryDishes] = useState([]);
  const [customDishlists, setCustomDishlists] = useState([]);
  const [profileMeta, setProfileMeta] = useState({ followers: [], following: [], savedDishes: [], bio: "" });
  const [activeDishlistId, setActiveDishlistId] = useState("saved");
  const [dishlistsOpen, setDishlistsOpen] = useState(false);
  const [dishlistsEditMode, setDishlistsEditMode] = useState(false);
  const [dishlistDeleteTarget, setDishlistDeleteTarget] = useState(null);
  const [dishlistRenameTarget, setDishlistRenameTarget] = useState(null);
  const [dishlistRenameValue, setDishlistRenameValue] = useState("");
  const [createDishlistOpen, setCreateDishlistOpen] = useState(false);
  const [newDishlistName, setNewDishlistName] = useState("");
  const [createDishlistStep, setCreateDishlistStep] = useState(0);
  const [popularDishlistNames, setPopularDishlistNames] = useState([]);
  const [selectedDishIds, setSelectedDishIds] = useState([]);
  const [createSourceDishlistId, setCreateSourceDishlistId] = useState("saved");
  const [createDishSearch, setCreateDishSearch] = useState("");
  const [creatingDishlist, setCreatingDishlist] = useState(false);
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
  const [newBio, setNewBio] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(user?.photoURL || "");
  const [savingProfile, setSavingProfile] = useState(false);
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
  const [storyPushStats, setStoryPushStats] = useState({});
  const [profileMapOpen, setProfileMapOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [removePreviewTarget, setRemovePreviewTarget] = useState(null);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = useState(DISH_MODE_ALL);
  const profileOptionsRef = useRef(null);
  const effectiveProfilePhotoURL =
    typeof profileMeta.photoURL === "string" ? profileMeta.photoURL : user?.photoURL || "";
  const hasStories = activeStories.length > 0;
  const avatarTone = getAvatarTone(user?.displayName || "");
  const refreshCustomDishlists = async (ownerId = user?.uid) => {
    if (!ownerId) return [];
    const lists = await getCustomDishlistsForUser(ownerId);
    setCustomDishlists(lists);
    return lists;
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      (async () => {
        const [uploaded, custom] = await Promise.all([
          getDishesFromFirestore(user.uid),
          getCustomDishlistsForUser(user.uid),
        ]);
        setUploadedDishes(uploaded);
        setCustomDishlists(custom);
      })();
    }
  }, [user]);

  useEffect(() => {
    if (!profileOptionsOpen) return;

    const handleOutsideClick = (event) => {
      if (!profileOptionsRef.current?.contains(event.target)) {
        setProfileOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileOptionsOpen]);

  useEffect(() => {
    if (!editProfileModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editProfileModal]);

  useEffect(() => {
    if (!editProfileModal) return;
    setNewName(user?.displayName || "");
    setNewBio(profileMeta.bio || "");
    setNewPhotoFile(null);
    setRemovePhoto(false);
    setNewPhotoPreview(effectiveProfilePhotoURL);
  }, [editProfileModal, user?.displayName, effectiveProfilePhotoURL, profileMeta.bio]);

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
        bio: data.bio || "",
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

    const storyPushesRef = collection(db, "users", user.uid, "storyPushes");
    const unsubscribeStoryPushes = onSnapshot(storyPushesRef, async () => {
      const stats = await getStoryPushStatsForUser(user.uid);
      setStoryPushStats(stats);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSaved();
      unsubscribeToTry();
      unsubscribeStories();
      unsubscribeStoryPushes();
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryDishlistId = params.get("list");
    if (!queryDishlistId) return;
    setActiveDishlistId(queryDishlistId);
  }, []);

  useEffect(() => {
    if (activeDishlistId === "saved" || activeDishlistId === "all_dishes" || activeDishlistId === "uploaded") return;
    if (customDishlists.some((dishlist) => dishlist.id === activeDishlistId)) return;
    setActiveDishlistId("saved");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("list", "saved");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeDishlistId, customDishlists]);

  useEffect(() => {
    if (!createDishlistOpen || createDishlistStep !== 0) return;
    getPopularCustomDishlistNames().then(setPopularDishlistNames);
  }, [createDishlistOpen, createDishlistStep]);

  const selectDishlist = (dishlistId) => {
    setActiveDishlistId(dishlistId);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("list", dishlistId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const buildProfileReturnTo = () => {
    return `${pathname}?list=${encodeURIComponent(activeDishlistId || "saved")}`;
  };

  const getProfileAddTargetListId = () => {
    if (!activeDishlist?.id) return "saved";
    if (activeDishlist.id === "all_dishes") return "saved";
    return activeDishlist.id;
  };

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
      setToastVariant("error");
      setToast("Dish name is required");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    setLoadingUpload(true);
    try {
      let imageFields = { imageURL: "", cardURL: "", thumbURL: "", mediaType: "image", mediaMimeType: "" };
      if (dishImage) {
        imageFields = await uploadDishImageVariants(dishImage, user.uid);
        if (!imageFields.imageURL) throw new Error("Failed to upload image.");
      }
      await saveDishToFirestore({
        name: dishName,
        description: dishDescription || "",
        dishMode: DISH_MODE_COOKING,
        recipeIngredients: dishRecipeIngredients || "",
        recipeMethod: dishRecipeMethod || "",
        tags: dishTags,
        isPublic: dishIsPublic,
        ...imageFields,
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
      setToastVariant("success");
      setToast("Dish uploaded");
      setTimeout(() => setToast(""), 1200);
    } catch {
      setToastVariant("error");
      setToast("Upload failed");
      setTimeout(() => setToast(""), 1400);
    }
    setLoadingUpload(false);
  };

  const handleDeleteDish = async (dish) => {
    await deleteDishAndImage(
      dish.id,
      dish.imageURL || dish.imageUrl || dish.image_url || dish.image
    );
    await removeDishFromAllUsers(dish.id);
    const refreshedUploaded = await getDishesFromFirestore(user.uid);
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setUploadedDishes(refreshedUploaded);
    setSavedDishes(refreshedSaved);
    setToastVariant("success");
    setToast("Dish deleted");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRemoveSavedDish = async (dish) => {
    const ok = await removeSavedDishFromUser(user.uid, dish.id);
    if (!ok) return;
    const refreshedSaved = await getSavedDishesFromFirestore(user.uid);
    setSavedDishes(refreshedSaved);
    setToastVariant("success");
    setToast("Removed from DishList");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRemoveToTryDish = async (dish) => {
    const ok = await removeDishFromToTry(user.uid, dish.id);
    if (!ok) return;
    const refreshed = await getToTryDishesFromFirestore(user.uid);
    setToTryDishes(refreshed);
    setToastVariant("success");
    setToast("Removed from To Try");
    setTimeout(() => setToast(""), 1200);
  };

  const handleEditProfile = async () => {
    if (!user?.uid || savingProfile) return;
    const cleanedName = newName.trim() || user.displayName || "Unnamed";
    const cleanedBio = newBio.trim();
    setSavingProfile(true);
    try {
      if (await isDisplayNameTaken(cleanedName, user.uid)) {
        throw new Error("That display name is already taken.");
      }
      const currentPhotoURL = profileMeta.photoURL || user?.photoURL || "";
      let nextPhotoURL = currentPhotoURL;

      if (removePhoto) {
        nextPhotoURL = "";
      }
      if (newPhotoFile) {
        nextPhotoURL = await uploadProfileImage(newPhotoFile, user.uid);
      }

      const currentAuthUser = auth.currentUser;
      if (!currentAuthUser) throw new Error("No authenticated user.");

      await updateProfile(currentAuthUser, {
        displayName: cleanedName,
        photoURL: nextPhotoURL ? nextPhotoURL : null,
      });
      await currentAuthUser.reload();

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: cleanedName,
          displayNameLower: cleanedName.toLowerCase(),
          photoURL: nextPhotoURL || "",
          bio: cleanedBio,
          email: currentAuthUser.email || user.email || "",
        },
        { merge: true }
      );

      setProfileMeta((prev) => ({
        ...prev,
        photoURL: nextPhotoURL || "",
        bio: cleanedBio,
      }));
      setNewName(cleanedName);
      setNewPhotoPreview(nextPhotoURL || "");
      setEditProfileModal(false);
      setNewPhotoFile(null);
      setRemovePhoto(false);
      setToastVariant("success");
      setToast("Profile updated");
      setTimeout(() => setToast(""), 1200);

      updateOwnerNameForDishes(user.uid, cleanedName, nextPhotoURL || "").catch((err) => {
        console.warn("Failed to update owner metadata on dishes:", err);
      });

      if ((newPhotoFile || removePhoto) && currentPhotoURL && currentPhotoURL !== nextPhotoURL) {
        deleteImageByUrl(currentPhotoURL).catch((err) => {
          console.warn("Failed to delete old profile image:", err);
        });
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setToastVariant("error");
      setToast(err?.message || "Profile update failed");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid || deletingAccount) return;
    setDeleteAccountError("");
    setDeletingAccount(true);
    try {
      await deleteAccount({ password: deletePassword });
      setDeleteAccountModal(false);
      alert("Your account has been deleted.");
      router.replace("/");
    } catch (err) {
      console.error("Failed to delete account:", err);
      setDeleteAccountError(err?.message || "Could not delete account. Please sign in again and retry.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const openShuffleDeck = (source) => {
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    const pool =
      source === "uploaded"
        ? uploadedDishes
        : source === "all_dishes"
          ? allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || []
        : source === "to_try"
          ? toTryDishes
          : source === "saved"
            ? savedDishes
            : customDishlist?.dishes || [];
    if (!pool.length) {
      alert("No dishes to shuffle.");
      return;
    }
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    const returnTo = encodeURIComponent(buildProfileReturnTo());
    if (customDishlist) {
      router.push(`/dish/${randomDish.id}?source=dishlist&listId=${customDishlist.id}&mode=shuffle&returnTo=${returnTo}`);
      return;
    }
    router.push(`/dish/${randomDish.id}?source=${source}&mode=shuffle&returnTo=${returnTo}`);
  };

  const removeDishFromProfileOnly = async (dish) => {
    const customMemberships = customDishlists.filter((dishlist) =>
      (dishlist.dishes || []).some((item) => item.id === dish.id)
    );
    await Promise.all(customMemberships.map((dishlist) => removeDishFromCustomDishlist(user.uid, dishlist.id, dish.id)));
    const savedMembership = savedDishes.some((item) => item.id === dish.id);
    const toTryMembership = toTryDishes.some((item) => item.id === dish.id);
    if (savedMembership) await removeSavedDishFromUser(user.uid, dish.id);
    if (toTryMembership) await removeDishFromToTry(user.uid, dish.id);
    if (dish.owner === user.uid) {
      await deleteDishAndImage(
        dish.id,
        dish.imageURL || dish.imageUrl || dish.image_url || dish.image
      );
      await removeDishFromAllUsers(dish.id);
    }
    const [refreshedUploaded, refreshedSaved, refreshedToTry] = await Promise.all([
      getDishesFromFirestore(user.uid),
      getSavedDishesFromFirestore(user.uid),
      getToTryDishesFromFirestore(user.uid),
    ]);
    setUploadedDishes(refreshedUploaded);
    setSavedDishes(refreshedSaved);
    setToTryDishes(refreshedToTry);
    await refreshCustomDishlists(user.uid);
  };

  const handleDishPreviewRemove = (dish, source) => {
    setRemovePreviewTarget({ dish, source });
  };

  const confirmDishPreviewRemove = async (scope) => {
    const target = removePreviewTarget;
    if (!target?.dish) return;
    const { dish, source } = target;
    if (scope === "profile") {
      await removeDishFromProfileOnly(dish);
      setToastVariant("success");
      setToast("Removed from profile");
      setTimeout(() => setToast(""), 1200);
      setRemovePreviewTarget(null);
      return;
    }
    if (source === "saved") {
      await handleRemoveSavedDish(dish);
      setRemovePreviewTarget(null);
      return;
    }
    if (source === "uploaded") {
      await handleDeleteDish(dish);
      setRemovePreviewTarget(null);
      return;
    }
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    if (customDishlist) {
      const ok = await removeDishFromCustomDishlist(user.uid, customDishlist.id, dish.id);
      if (ok) {
        await refreshCustomDishlists(user.uid);
        setToastVariant("success");
        setToast("Removed from dishlist");
        setTimeout(() => setToast(""), 1200);
      }
      setRemovePreviewTarget(null);
      return;
    }
    const allDishesMembership = [
      savedDishes.some((item) => item.id === dish.id) ? "saved" : null,
      ...customDishlists
        .filter((dishlist) => (dishlist.dishes || []).some((item) => item.id === dish.id))
        .map((dishlist) => dishlist.id),
      dish.owner === user.uid ? "uploaded" : null,
    ].filter(Boolean);
    const firstMembership = allDishesMembership[0];
    if (firstMembership === "saved") {
      await handleRemoveSavedDish(dish);
    } else if (firstMembership === "uploaded") {
      await handleDeleteDish(dish);
    } else if (firstMembership) {
      const ok = await removeDishFromCustomDishlist(user.uid, firstMembership, dish.id);
      if (ok) {
        await refreshCustomDishlists(user.uid);
        setToastVariant("success");
        setToast("Removed from dishlist");
        setTimeout(() => setToast(""), 1200);
      }
    }
    setRemovePreviewTarget(null);
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
        .map((snap) => ({ ...snap.data(), id: snap.id }));
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

  const getStoryPushCount = (dish) => Number(storyPushStats[dish?.id]?.count || 0);
  const sortDishlistDishes = (dishesList) =>
    [...(dishesList || [])].sort(
      (a, b) =>
        getStoryPushCount(b) - getStoryPushCount(a) ||
        Number(b?.saves || 0) - Number(a?.saves || 0)
    );

  const allDishesCollection = Array.from(
    new Map(
      [...uploadedDishes, ...savedDishes, ...toTryDishes, ...customDishlists.flatMap((dishlist) => dishlist.dishes || [])]
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );

  const allDishlists = [
    { id: "saved", name: "Top picks", type: "system", dishes: sortDishlistDishes(savedDishes), count: savedDishes.length },
    {
      id: "all_dishes",
      name: "All dishes",
      type: "system",
      dishes: sortDishlistDishes(allDishesCollection),
      count: allDishesCollection.length,
    },
    { id: "uploaded", name: "Uploaded", type: "system", dishes: sortDishlistDishes(uploadedDishes), count: uploadedDishes.length },
    ...customDishlists.map((dishlist) => ({
      ...dishlist,
      dishes: sortDishlistDishes(dishlist.dishes || []),
    })),
  ];

  const unfilteredActiveDishlist =
    allDishlists.find((dishlist) => dishlist.id === activeDishlistId) || allDishlists[0] || null;
  const activeDishlist = unfilteredActiveDishlist
    ? {
        ...unfilteredActiveDishlist,
        dishes: (unfilteredActiveDishlist.dishes || []).filter((dish) => dishModeMatches(dish, selectedDishMode)),
      }
    : null;
  const allDishesCount = allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.count || 0;
  const uploadedRestaurantGroups = useMemo(
    () => getRestaurantDishGroups(uploadedDishes),
    [uploadedDishes]
  );

  const selectedCreateDishes = Array.from(
    new Map(
      allDishlists
        .flatMap((dishlist) => dishlist.dishes || [])
        .filter((dish) => selectedDishIds.includes(dish.id))
        .map((dish) => [dish.id, dish])
  ).values()
  );
  const createSourceDishlist =
    allDishlists.find((dishlist) => dishlist.id === createSourceDishlistId) || allDishlists[0] || null;
  const createDishSearchTerm = createDishSearch.trim().toLowerCase();
  const createDishSearchPool =
    allDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
  const visibleCreateDishes = createDishSearchTerm
    ? createDishSearchPool.filter((dish) => (dish?.name || "").toLowerCase().includes(createDishSearchTerm))
    : createSourceDishlist?.dishes || [];

  const toggleDishSelection = (dish) => {
    if (!dish?.id) return;
    setSelectedDishIds((prev) =>
      prev.includes(dish.id) ? prev.filter((id) => id !== dish.id) : [...prev, dish.id]
    );
  };

  const handleOpenCreateDishlist = () => {
    setDishlistsOpen(false);
    setDishlistsEditMode(false);
    setCreateDishlistStep(0);
    setNewDishlistName("");
    setSelectedDishIds([]);
    setCreateSourceDishlistId(allDishlists[0]?.id || "saved");
    setCreateDishSearch("");
    setCreateDishlistOpen(true);
  };

  const getRemovalTargetMeta = (source) => {
    if (source === "saved") {
      return {
        label: "Top picks",
        description: "Remove it from Top picks only",
        buttonClass: "border-[#D8C66A] bg-[#FFFBE7]",
        iconClass: "border-[#D0B74A] bg-[#D0B74A] text-white",
      };
    }
    const customDishlist = customDishlists.find((dishlist) => dishlist.id === source);
    if (customDishlist) {
      return {
        label: customDishlist.name || "Dishlist",
        description: `Remove it from ${customDishlist.name || "this dishlist"} only`,
        buttonClass: "border-[#8FD7AE] bg-[#F3FFF7]",
        iconClass: "border-[#2F9B5F] bg-[#2F9B5F] text-white",
      };
    }
    return null;
  };

  const handleCreateDishlist = async () => {
    if (!user?.uid || creatingDishlist) return;
    if (!newDishlistName.trim()) return;
    setCreatingDishlist(true);
    try {
      const dishlistId = await createCustomDishlist(user.uid, newDishlistName, selectedCreateDishes);
      await refreshCustomDishlists(user.uid);
      if (dishlistId) {
        selectDishlist(dishlistId);
      }
      setCreateDishlistOpen(false);
      setToastVariant("success");
      setToast("Dishlist created");
      setTimeout(() => setToast(""), 1200);
    } catch (err) {
      console.error("Failed to create dishlist:", err);
      setToastVariant("error");
      setToast("Dishlist creation failed");
      setTimeout(() => setToast(""), 1400);
    } finally {
      setCreatingDishlist(false);
    }
  };

  const handleDeleteDishlist = async () => {
    if (!user?.uid || !dishlistDeleteTarget?.id) return;
    const deleted = await deleteCustomDishlist(user.uid, dishlistDeleteTarget.id);
    if (!deleted) {
      setToastVariant("error");
      setToast("Dishlist deletion failed");
      setTimeout(() => setToast(""), 1400);
      return;
    }
    await refreshCustomDishlists(user.uid);
    if (activeDishlistId === dishlistDeleteTarget.id) {
      selectDishlist("saved");
    }
    setDishlistDeleteTarget(null);
    setDishlistsEditMode(false);
    setToastVariant("success");
    setToast("Dishlist deleted");
    setTimeout(() => setToast(""), 1200);
  };

  const handleRenameDishlist = async () => {
    if (!user?.uid || !dishlistRenameTarget?.id || !dishlistRenameValue.trim()) return;
    const renamed = await updateCustomDishlistName(user.uid, dishlistRenameTarget.id, dishlistRenameValue);
    if (!renamed) {
      setToastVariant("error");
      setToast("Dishlist rename failed");
      setTimeout(() => setToast(""), 1400);
      return;
    }
    await refreshCustomDishlists(user.uid);
    setDishlistRenameTarget(null);
    setDishlistRenameValue("");
    setToastVariant("success");
    setToast("Dishlist renamed");
    setTimeout(() => setToast(""), 1200);
  };

  const renderDishCounters = (dish) => (
    <div className="flex items-center gap-3.5 text-[13px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
      <div className="inline-flex items-center gap-1.5">
        <StoryStatIcon size={14} />
        <span>: {getStoryPushCount(dish)}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleOpenSavers(dish);
        }}
        className="pointer-events-auto text-left"
      >
        saves: {Number(dish.saves || 0)}
      </button>
    </div>
  );


  if (loading) {
    return <FullScreenLoading title="Loading profile" />;
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
        <div className="mt-4 mb-3 flex items-center justify-between">
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
      <div className="grid grid-cols-2 gap-3">
        {dishes.length === 0 ? (
          <div className="col-span-2 bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
            No dishes here.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {dishes.map((dish, index) => (
              <motion.div
                key={`${dish.id}-${index}`}
                className={`pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative group border-2 ${String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"}`}
              >
                <Link
                  href={
                    source === "dishlist" || activeDishlist?.type === "custom"
                      ? `/dish/${dish.id}?source=dishlist&listId=${activeDishlist?.id}&mode=single&returnTo=${encodeURIComponent(buildProfileReturnTo())}`
                      : `/dish/${dish.id}?source=${source}&mode=single&returnTo=${encodeURIComponent(buildProfileReturnTo())}`
                  }
                  className="absolute inset-0 z-10"
                >
                  <span className="sr-only">Open dish</span>
                </Link>
                {(() => {
                  const imageSrc = getDishImageUrl(dish, "thumb");
                  return (
                    <img
                      src={imageSrc}
                      alt={dish.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_DISH_IMAGE;
                      }}
                    />
                  );
                })()}
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5 text-white pointer-events-none flex flex-col justify-end gap-1">
                  <div className="text-[17px] font-bold leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                    {dish.name || "Untitled dish"}
                  </div>
                  {renderDishCounters(dish)}
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
                    className="absolute top-2 right-2 z-20 bg-black text-white rounded-full px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-active:opacity-100 focus:opacity-100 transition"
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
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 mb-1 flex justify-end px-4 pb-1.5 relative">
        <div
          className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-nav-gap) + 1.2rem)" }}
        >
          <DishModeFilterButton
            value={selectedDishMode}
            onClick={() => setDishModeFilterOpen(true)}
            className="pointer-events-auto"
          />
        </div>
        <div ref={profileOptionsRef} className="relative z-20 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              router.push("/directs");
            }}
            className="top-action-btn relative"
            aria-label="Directs"
          >
            <Send size={18} />
            {hasUnreadDirects ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
          </button>
          <button
            type="button"
            onClick={() => setProfileOptionsOpen((prev) => !prev)}
            className="top-action-btn"
            aria-label="Profile options"
          >
            <Settings size={18} />
          </button>
          {profileOptionsOpen && (
            <div className="absolute top-full right-0 mt-2 z-[90] bg-white border border-black/10 rounded-2xl shadow-lg p-2 w-48">
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
              <div className="my-1 h-px bg-black/8" />
              <button
                type="button"
                onClick={() => {
                  setProfileOptionsOpen(false);
                  setDeletePassword("");
                  setDeleteAccountError("");
                  setDeleteAccountModal(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-sm font-medium text-red-600"
              >
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (hasStories) setStoriesOpen(true);
              }}
              className={`no-accent-border h-20 w-20 rounded-full p-[4px] ${hasStories ? "bg-[#2BD36B]" : "bg-transparent"}`}
              aria-label="Open your stories"
            >
              <div className="no-accent-border w-full h-full rounded-full bg-[#F6F6F2] p-[3px]">
                <div
                  className="no-accent-border w-full h-full rounded-full bg-black/10 flex items-center justify-center text-2xl font-bold overflow-hidden"
                  style={effectiveProfilePhotoURL ? undefined : { backgroundColor: avatarTone.bg }}
                >
                  {effectiveProfilePhotoURL ? (
                    <img
                      src={effectiveProfilePhotoURL}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span style={{ color: avatarTone.text }}>{user.displayName?.[0] || "U"}</span>
                  )}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStoryActionOpen(true)}
              className="no-accent-border absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-black text-white border-2 border-[#F6F6F2] flex items-center justify-center shadow-md"
              aria-label="Add story"
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="flex-1 min-h-20 flex flex-col justify-start py-0.5">
            <h1 className="text-[1.8rem] leading-none font-bold tracking-tight">{user.displayName || "My Profile"}</h1>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileMeta.followers.length}</div>
                <button
                  onClick={() => openConnections("followers")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  followers
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{profileMeta.following.length}</div>
                <button
                  onClick={() => openConnections("following")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  following
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{uploadedDishes.length}</div>
                <button
                  onClick={() => selectDishlist("uploaded")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  uploaded
                </button>
              </div>
              <div className="flex min-h-[44px] flex-col items-center justify-start text-center">
                <div className="text-[1.28rem] font-bold leading-none">{allDishesCount}</div>
                <button
                  onClick={() => selectDishlist("all_dishes")}
                  className="mt-1 text-[10px] leading-[1.1] text-black/50 hover:text-black"
                >
                  dishes
                </button>
              </div>
            </div>
          </div>
        </div>

        {profileMeta.bio ? (
          <p className="mt-4 max-w-xl text-sm leading-6 text-black/68 whitespace-pre-wrap">{profileMeta.bio}</p>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-center gap-2">
        {[
          { id: "saved", label: "Top picks" },
          { id: "uploaded", label: "Uploaded" },
          { id: "all_dishes", label: "All dishes" },
        ].map((item) => {
          const active = activeDishlistId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectDishlist(item.id)}
              className={`rounded-full border-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? item.id === "saved"
                    ? "border-[#D94A4A] bg-[linear-gradient(180deg,#FFE4E4_0%,#FFC4C4_100%)] text-[#7E1717] shadow-[0_10px_22px_rgba(217,74,74,0.18)]"
                    : item.id === "uploaded"
                      ? "border-[#D5B647] bg-[linear-gradient(180deg,#FFF8D9_0%,#F7E8A8_100%)] text-[#3F3100] shadow-[0_10px_22px_rgba(213,182,71,0.18)]"
                      : "border-[#1E8A4C] bg-[linear-gradient(180deg,#F4FFF7_0%,#DDF6E5_100%)] text-[#176A37] shadow-[0_10px_22px_rgba(43,211,107,0.16)]"
                  : "border-black/30 bg-white text-black"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        
        <button
          type="button"
          onClick={() => setDishlistsOpen(true)}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-black/35 bg-white text-black shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
          aria-label="Open all dishlists"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div className="mb-4 flex justify-center">
        <button
          type="button"
          onClick={() => setProfileMapOpen(true)}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-black/30 bg-white text-black shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
          aria-label="Open profile map"
        >
          <RestaurantMapIcon className="h-6 w-6 text-black" strokeWidth={2.15} />
        </button>
</div>

      <DishGrid
        title={activeDishlist?.name || "Top picks"}
        dishes={activeDishlist?.dishes || []}
        allowDelete={false}
        source={activeDishlist?.id || "saved"}
        onRemovePreview={(dish) => handleDishPreviewRemove(dish, activeDishlist?.type === "custom" ? activeDishlist.id : activeDishlist?.id)}
      />

      {/* Add Dish button */}
      <motion.button
        onClick={() => router.push(`/upload?targetList=${encodeURIComponent(getProfileAddTargetListId())}`)}
        className="bottom-nav-floating-action add-action-btn fixed right-6 w-16 h-16 text-[40px] z-50"
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
                    loading="lazy"
                    decoding="async"
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
          <motion.div
            className="fixed inset-0 bg-black/45 backdrop-blur-md flex items-center justify-center z-[80] overflow-hidden p-2"
            onClick={() => {
              setEditProfileModal(false);
              setRemovePhoto(false);
            }}
          >
            <motion.div
              className="w-full max-w-lg h-auto max-h-[calc(100dvh-0.75rem)] overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF6E8_100%)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.16)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                <div className="inline-flex items-center rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                  Profile
                </div>
                <h2 className="mt-3 text-[2rem] leading-none font-semibold text-black">Edit profile</h2>
                <p className="mt-3 text-sm text-black/58">Update your name, photo and bio.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileModal(false);
                    setRemovePhoto(false);
                  }}
                  className="w-10 h-10 shrink-0 rounded-[1rem] border border-black/10 bg-white/85 text-black/60 hover:text-black"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto pr-1 min-h-0 flex-1">
                <div>
                  <label className="mb-2 block text-sm font-medium text-black/72">Display name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-full border border-black/10 bg-white/92 px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>

                <div className="rounded-[1.6rem] border border-black/10 bg-white/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium text-black/72">Profile picture</label>
                    {newPhotoPreview ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewPhotoFile(null);
                          setNewPhotoPreview("");
                          setRemovePhoto(true);
                        }}
                        className="text-sm font-medium text-black/55 hover:text-black"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border border-black/10 bg-black/5 flex items-center justify-center text-2xl font-bold">
                      {newPhotoPreview ? (
                        <img
                          src={newPhotoPreview}
                          alt="Profile preview"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        newName?.[0] || user?.displayName?.[0] || "U"
                      )}
                    </div>
                    <label className="inline-flex items-center rounded-full border border-black/10 bg-[#EFE7D8] px-4 py-2 text-sm font-semibold text-black/78 shadow-[0_10px_22px_rgba(0,0,0,0.08)] cursor-pointer hover:text-black">
                      Change photo
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
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-black/72">Bio</label>
                  <textarea
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    rows={4}
                    placeholder="Add a short bio"
                    className="w-full rounded-[1.5rem] border border-black/10 bg-white/92 px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileModal(false);
                    setRemovePhoto(false);
                  }}
                  className="rounded-full border border-black/12 bg-white/82 px-5 py-3 font-medium text-black/72 hover:text-black"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditProfile}
                  disabled={savingProfile}
                  className={`rounded-full border border-black/10 px-6 py-3 font-semibold text-black shadow-[0_14px_30px_rgba(0,0,0,0.12)] ${
                    savingProfile ? "bg-black/10 text-black/40" : "bg-[#D7B443]"
                  }`}
                >
                  {savingProfile ? "Saving..." : "Save profile"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteAccountModal && (
          <motion.div
            className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (deletingAccount) return;
              setDeleteAccountModal(false);
              setDeletePassword("");
              setDeleteAccountError("");
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.22)]"
              initial={{ y: 18, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
                    Permanent
                  </div>
                  <h2 className="mt-3 text-[1.9rem] leading-none font-semibold text-black">Delete account</h2>
                  <p className="mt-3 text-sm leading-6 text-black/62">
                    This permanently deletes your profile, uploaded dishes, saved lists, stories, comments and direct messages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (deletingAccount) return;
                    setDeleteAccountModal(false);
                    setDeletePassword("");
                    setDeleteAccountError("");
                  }}
                  className="h-10 w-10 shrink-0 rounded-2xl border border-black/10 bg-black/[0.03] text-black/60"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {user?.providerData?.some((provider) => provider.providerId === "password") ? (
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium text-black/68">Confirm your password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-full border border-black/10 bg-black/[0.03] px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Password"
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-[1.25rem] bg-black/[0.04] px-4 py-3 text-sm text-black/62">
                  You may be asked to confirm your sign-in before deletion.
                </p>
              )}

              {deleteAccountError ? (
                <p className="mt-4 rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-600">{deleteAccountError}</p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (deletingAccount) return;
                    setDeleteAccountModal(false);
                    setDeletePassword("");
                    setDeleteAccountError("");
                  }}
                  className="flex-1 rounded-full border border-black/12 bg-white px-4 py-3 font-semibold text-black/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 rounded-full border border-red-600 bg-red-600 px-4 py-3 font-semibold text-white shadow-[0_16px_32px_rgba(220,38,38,0.22)] disabled:opacity-55"
                >
                  {deletingAccount ? "Deleting..." : "Delete forever"}
                </button>
              </div>
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
                      href={u.id === user.uid ? "/profile" : `/profile/${encodeURIComponent(u.id)}`}
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

      <SaversModal
        open={saversOpen}
        onClose={() => setSaversOpen(false)}
        loading={saversLoading}
        users={saversUsers}
        currentUserId={user?.uid}
      />
      <AnimatePresence>
        {dishlistsOpen && (
          <motion.div
            className="fixed inset-0 z-[88] overflow-y-auto"
            style={{
              background: "#FFF8EF",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishlistsOpen(false)}
          >
            <motion.div
              className="min-h-screen w-full px-4 pb-28 pt-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setDishlistsOpen(false);
                  setDishlistsEditMode(false);
                }}
                className="fixed right-5 top-[calc(env(safe-area-inset-top,0px)+2.9rem)] z-[89] flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/92 text-black shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                aria-label="Close dishlists"
              >
                <X size={18} />
              </button>
              <div className="mx-auto w-full max-w-3xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                    Dishlists
                  </div>
                  <h3 className="mt-2 text-[1.9rem] leading-none font-bold text-black">Your DishLists</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDishlistsEditMode((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    dishlistsEditMode
                      ? "border border-[#D56A6A] bg-[#FFF1F1] text-[#B34747]"
                      : "border border-black/10 bg-white text-black/70"
                  }`}
                >
                  <Pencil size={14} />
                  {dishlistsEditMode ? "Done" : "Edit"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {allDishlists.map((dishlist) => {
                  const preview = [...(dishlist.dishes || [])]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 4);
                  return (
                    <div key={dishlist.id} className="rounded-[1.5rem] border border-black/10 bg-white p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            selectDishlist(dishlist.id);
                            setDishlistsOpen(false);
                            setDishlistsEditMode(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate pr-1 text-[1rem] font-bold text-black">{dishlist.name}</div>
                        </button>
                        {dishlistsEditMode && dishlist.type === "custom" ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDishlistRenameTarget(dishlist);
                                setDishlistRenameValue(dishlist.name || "");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] bg-white text-black shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
                              aria-label={`Rename ${dishlist.name}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDishlistDeleteTarget(dishlist);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D56A6A] bg-[#D56A6A] text-white shadow-[0_10px_20px_rgba(213,106,106,0.24)]"
                              aria-label={`Delete ${dishlist.name}`}
                            >
                              <Minus size={15} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          selectDishlist(dishlist.id);
                          setDishlistsOpen(false);
                          setDishlistsEditMode(false);
                        }}
                        className="block w-full"
                      >
                        <div className="grid grid-cols-2 gap-1.5">
                          {Array.from({ length: 4 }).map((_, index) => {
                            const dish = preview[index];
                            return dish ? (
                            <img
                              key={`${dishlist.id}-${dish.id}-${index}`}
                              src={getDishImageUrl(dish, "thumb")}
                              alt={dish.name || dishlist.name}
                              className="aspect-square w-full rounded-[0.85rem] border border-black/10 object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                  event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                }}
                              />
                            ) : (
                            <div
                              key={`${dishlist.id}-empty-${index}`}
                              className="aspect-square w-full rounded-[0.85rem] border border-black/10 bg-black/6"
                            />
                            );
                          })}
                        </div>
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleOpenCreateDishlist}
                  className="min-h-[11.4rem] rounded-[1.5rem] border-2 border-dashed border-[#2BD36B]/55 bg-[#F3FFF7] p-3 text-left"
                >
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#176A37]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2BD36B] text-white">
                      <Plus size={22} />
                    </div>
                    <div className="text-sm font-semibold">Create dishlist</div>
                  </div>
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {createDishlistOpen && (
          <motion.div
            className="fixed inset-0 z-[89] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (creatingDishlist) return;
              setCreateDishlistOpen(false);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-4 shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                    New Dishlist
                  </div>
                  <h3 className="mt-2 text-[1.7rem] leading-none font-semibold text-black">
                    {createDishlistStep === 0 ? "Name it" : "Add dishes"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateDishlistOpen(false)}
                  className="text-sm text-black/55"
                >
                  Close
                </button>
              </div>

              {createDishlistStep === 0 ? (
                <>
                  <input
                    type="text"
                    value={newDishlistName}
                    onChange={(event) => setNewDishlistName(event.target.value)}
                    placeholder="Dishlist name"
                    className="w-full rounded-full border border-black/10 bg-[#F7F4ED] px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                  {popularDishlistNames.length ? (
                    <div className="mt-4">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/42">
                        Popular names
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {popularDishlistNames.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setNewDishlistName(name)}
                            className="rounded-full border border-[#8FD7AE] bg-[#F3FFF7] px-3 py-1.5 text-[11px] font-semibold text-[#176A37]"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDishlistName.trim()) return;
                        setCreateDishlistStep(1);
                      }}
                      className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="max-h-[58vh] overflow-y-auto pr-1">
                    <div className="mb-4 flex items-center gap-2 rounded-[1.15rem] border border-black/10 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
                      <Search size={16} className="shrink-0 text-black/40" />
                      <input
                        type="text"
                        value={createDishSearch}
                        onChange={(e) => setCreateDishSearch(e.target.value)}
                        placeholder="Search your dishes"
                        className="min-w-0 flex-1 bg-transparent text-base text-black placeholder:text-black/35 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {allDishlists.map((dishlist) => {
                        const preview = [...(dishlist.dishes || [])].sort(() => Math.random() - 0.5).slice(0, 4);
                        const selected = dishlist.id === createSourceDishlist?.id;
                        return (
                          <button
                            key={`create-${dishlist.id}`}
                            type="button"
                            onClick={() => setCreateSourceDishlistId(dishlist.id)}
                            className={`rounded-[1.35rem] border p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${
                              selected ? "border-[#2BD36B] bg-[#F4FFF7]" : "border-black/10 bg-white"
                            }`}
                          >
                            <div className="mb-2 truncate text-sm font-semibold text-black">{dishlist.name}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {Array.from({ length: 4 }).map((_, index) => {
                                const dish = preview[index];
                                return dish ? (
                                  <img
                                    key={`${dishlist.id}-${dish.id}-${index}`}
                                    src={getDishImageUrl(dish, "thumb")}
                                    alt={dish.name || dishlist.name}
                                    className="aspect-square w-full rounded-[0.85rem] object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(event) => {
                                      event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                    }}
                                  />
                                ) : (
                                  <div
                                    key={`${dishlist.id}-empty-${index}`}
                                    className="aspect-square w-full rounded-[0.85rem] bg-black/6"
                                  />
                                );
                              })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {createSourceDishlist ? (
                      <div className="mt-5">
                        <div className="mb-2 text-sm font-semibold text-black">
                          {createDishSearchTerm ? "Search results" : createSourceDishlist.name}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {visibleCreateDishes.map((dish) => {
                            const selected = selectedDishIds.includes(dish.id);
                            return (
                              <button
                                key={`${createSourceDishlist.id}-${dish.id}`}
                                type="button"
                                onClick={() => toggleDishSelection(dish)}
                                className={`overflow-hidden rounded-[1rem] border text-left ${
                                  selected ? "border-[#2BD36B] ring-2 ring-[#2BD36B]/35" : "border-black/10"
                                }`}
                              >
                                <img
                                  src={getDishImageUrl(dish, "thumb")}
                                  alt={dish.name}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(event) => {
                                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                  }}
                                />
                                <div className="px-2 py-1.5 text-[11px] font-semibold text-black truncate">
                                  {dish.name || "Untitled dish"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {visibleCreateDishes.length === 0 ? (
                          <div className="mt-2 rounded-[1rem] border border-dashed border-black/10 bg-white/70 px-4 py-5 text-center text-sm text-black/50">
                            No matching dishes.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateDishlistStep(0)}
                      className="rounded-full border border-black/12 px-4 py-3 text-sm font-medium text-black/72"
                      disabled={creatingDishlist}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateDishlist}
                      disabled={creatingDishlist}
                      className="rounded-full bg-[#2BD36B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {creatingDishlist ? "Creating..." : `Create (${selectedCreateDishes.length})`}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dishlistDeleteTarget ? (
          <motion.div
            className="fixed inset-0 z-[91] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDishlistDeleteTarget(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)] px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/12" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B34747]">
                    Delete Dishlist
                  </p>
                  <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                    Delete {dishlistDeleteTarget.name}?
                  </h3>
                  <p className="mt-1 text-sm text-black/55">
                    This removes the dishlist itself, but keeps the dishes in your profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishlistDeleteTarget(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/60"
                  aria-label="Close delete dishlist dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDishlistDeleteTarget(null)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDishlist}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C93A3A] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(201,58,58,0.25)]"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {dishlistRenameTarget ? (
          <motion.div
            className="fixed inset-0 z-[91] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setDishlistRenameTarget(null);
              setDishlistRenameValue("");
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)] px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/12" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40">
                    Rename Dishlist
                  </p>
                  <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                    Edit the list name
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDishlistRenameTarget(null);
                    setDishlistRenameValue("");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/60"
                  aria-label="Close rename dishlist dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                value={dishlistRenameValue}
                onChange={(event) => setDishlistRenameValue(event.target.value)}
                placeholder="Dishlist name"
                className="w-full rounded-full border border-black/10 bg-[#F7F4ED] px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDishlistRenameTarget(null);
                    setDishlistRenameValue("");
                  }}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRenameDishlist}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  <Pencil size={15} />
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <StoryViewerModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        stories={activeStories}
        ownerName={user?.displayName || "You"}
        ownerPhotoURL={effectiveProfilePhotoURL}
        onViewed={handleStoryViewed}
        canDelete
        onDelete={handleDeleteStory}
        currentUser={user}
      />
      <AnimatePresence>
        {removePreviewTarget ? (
          (() => {
            const removalMeta = getRemovalTargetMeta(removePreviewTarget.source);
            return (
          <motion.div
            className="fixed inset-0 z-[92] bg-black/45 backdrop-blur-sm flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRemovePreviewTarget(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)] px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/12" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B34747]">
                    Remove Dish
                  </p>
                  <h3 className="mt-1 text-[1.4rem] font-semibold leading-tight text-black">
                    Choose how to remove it
                  </h3>
                  <p className="mt-1 text-sm text-black/55">{removePreviewTarget.dish?.name || "dish"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovePreviewTarget(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/60"
                  aria-label="Close remove options"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {removalMeta ? (
                  <button
                    type="button"
                    onClick={() => confirmDishPreviewRemove("list")}
                    className={`flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${removalMeta.buttonClass}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">
                        Remove from {removalMeta.label} only
                      </div>
                      <div className="mt-0.5 text-xs text-black/48">{removalMeta.description}</div>
                    </div>
                    <div className={`ml-4 flex h-9 w-9 items-center justify-center rounded-full border ${removalMeta.iconClass}`}>
                      <Minus size={16} />
                    </div>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => confirmDishPreviewRemove("profile")}
                  className="flex items-center justify-between rounded-[1.25rem] border border-[#D56A6A] bg-[#FFF1F1] px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-black">Remove from profile completely</div>
                    <div className="mt-0.5 text-xs text-black/48">Delete it from your saved lists and profile</div>
                  </div>
                  <div className="ml-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#C93A3A] bg-[#C93A3A] text-white">
                    <Trash2 size={16} />
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
            );
          })()
        ) : null}
      </AnimatePresence>
      <AppToast message={toast} variant={toastVariant} />
      <AnimatePresence>
        {storyActionOpen && (
          <motion.div
            className="fixed inset-0 z-[90] overflow-y-auto bg-black/45 backdrop-blur-sm flex items-center justify-center p-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStoryActionOpen(false)}
          >
            <motion.div
              className="no-accent-border my-auto w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-[2rem] bg-white p-4 shadow-2xl border border-black/10"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
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
                  className="w-full min-h-[15.5rem] rounded-[2rem] bg-[rgba(255,255,255,0.72)] text-black px-8 py-8 text-left shadow-[0_18px_40px_rgba(230,70,70,0.12)] transition-transform hover:scale-[1.01] border-[3px] border-[#E64646] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[2.15rem] font-semibold leading-none">Create dish</p>
                        <p className="mt-4 text-base text-black/78">Post directly to your story.</p>
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
                        {STORY_CHOOSER_STEPS.map((step) => (
                          <div key={step.label}>
                            <div className="mb-2 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                            <div className="text-[0.72rem] font-medium text-black/72">{step.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryActionOpen(false);
                    router.push("/dishes?storyPicker=1");
                  }}
                  className="w-full min-h-[15.5rem] rounded-[2rem] border-[3px] border-[#F0A623] bg-[rgba(255,255,255,0.72)] px-8 py-8 text-left shadow-[0_18px_40px_rgba(240,166,35,0.12)] transition-transform hover:scale-[1.01] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[2.15rem] font-semibold leading-none text-black">Find dish</p>
                        <p className="mt-4 text-base text-black/60">Pick an existing dish for your story.</p>
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
          </motion.div>
        )}
      </AnimatePresence>

      <DishModeFilterModal
        open={dishModeFilterOpen}
        value={selectedDishMode}
        onClose={() => setDishModeFilterOpen(false)}
        onSelect={(mode) => {
          setSelectedDishMode(mode);
          setDishModeFilterOpen(false);
        }}
      />
      <AnimatePresence>
        {profileMapOpen ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileMapOpen(false)}
          >
            <motion.div
              className="mx-auto flex w-full max-w-[25.5rem] max-h-[82dvh] flex-col overflow-hidden rounded-[1.6rem] bg-[#F6F6F2] p-3 shadow-2xl"
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                    Profile map
                  </div>
                  <h3 className="mt-2 text-[1.6rem] leading-none font-semibold text-black">
                    Restaurants you&apos;ve pinned
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileMapOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55"
                  aria-label="Close profile map"
                >
                  <X size={16} />
                </button>
              </div>
              <RestaurantMapView
                groups={uploadedRestaurantGroups}
                className="h-[48vh] min-h-[26rem] max-h-[34rem]"
                emptyTitle="No restaurant dishes yet"
                emptyText="Restaurant-mode dishes with a selected place will show up here."
                dishHrefBuilder={(dish) => `/dish/${dish.id}?source=uploaded&mode=single&returnTo=${encodeURIComponent("/profile?list=uploaded")}`}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
