import { db, storage } from "./firebase";
import { dispatchPushEvent } from "./pushClient";
import {
  collection,
  collectionGroup,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  orderBy,
  limit as limitResults,
  startAfter,
  updateDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  increment,
  runTransaction,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { normalizeRestaurant } from "./restaurants";
import { buildDefaultTagDishlists, getTagForDishlistId, isTagDishlistId } from "./tagDishlists";

const OWNER_PHOTO_CACHE_TTL = 2 * 60 * 1000;
const ownerPhotoCache = new Map();
const DATA_CACHE_TTL = 45 * 1000;
const dataCache = new Map();
const pendingCache = new Map();
const SYSTEM_DISHLIST_IDS = new Set(["saved", "to_try", "uploaded", "all_dishes"]);
const RESERVED_CUSTOM_DISHLIST_IDS = new Set([...SYSTEM_DISHLIST_IDS, "dishlist"]);
const RESERVED_CUSTOM_DISHLIST_NAME_KEYS = new Set([
  "all dishes",
  "tutti",
  "tutti i piatti",
  "saved",
  "salvati",
  "classici",
  "your classics",
  "i miei classici",
  "to try",
  "da provare",
  "uploaded",
  "caricati",
  "dishlist",
  "new dishlist",
  "nuova dishlist",
]);

function getCache(key) {
  const cached = dataCache.get(key);
  if (!cached || Date.now() - cached.cachedAt > DATA_CACHE_TTL) return null;
  return cached.value;
}

async function cachedRead(key, loader) {
  const cached = getCache(key);
  if (cached) return cached;
  if (pendingCache.has(key)) return pendingCache.get(key);

  const pending = loader()
    .then((value) => {
      dataCache.set(key, { value, cachedAt: Date.now() });
      pendingCache.delete(key);
      return value;
    })
    .catch((err) => {
      pendingCache.delete(key);
      throw err;
    });
  pendingCache.set(key, pending);
  return pending;
}

function clearReadCache(userId = null) {
  dataCache.delete("dishes:all");
  Array.from(dataCache.keys()).forEach((key) => {
    if (key.startsWith("dishes:page:")) dataCache.delete(key);
    if (userId && key.includes(`:${userId}:`)) dataCache.delete(key);
  });
  Array.from(pendingCache.keys()).forEach((key) => {
    if (key === "dishes:all" || key.startsWith("dishes:page:")) pendingCache.delete(key);
    if (userId && key.includes(`:${userId}:`)) pendingCache.delete(key);
  });
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 6);
}

function normalizeDishCommentScope(scope = "dish") {
  return scope === "recipe" ? "recipe" : "dish";
}

function getDishCommentsCollection(dishId, scope = "dish") {
  const normalizedScope = normalizeDishCommentScope(scope);
  const subcollection = normalizedScope === "recipe" ? "recipeComments" : "comments";
  return collection(db, "dishes", dishId, subcollection);
}

function getStoryCommentsCollection(ownerId, storyId) {
  return collection(db, "users", ownerId, "stories", storyId, "comments");
}

function leaderboardQuestionsCollection() {
  return collection(db, "leaderboardQuestions");
}

function leaderboardQuestionDoc(questionId) {
  return doc(db, "leaderboardQuestions", questionId);
}

function leaderboardAnswersCollection(questionId) {
  return collection(db, "leaderboardQuestions", questionId, "answers");
}

function leaderboardAnswerDoc(questionId, answerId) {
  return doc(db, "leaderboardQuestions", questionId, "answers", answerId);
}

async function getUserIdsWithDishInAnyDishlist(dishId) {
  if (!dishId) return [];
  const userIds = new Set();
  const [dishSnap, savedSnap, toTrySnap, customItemsSnap] = await Promise.all([
    getDoc(doc(db, "dishes", dishId)),
    getDocs(collectionGroup(db, "saved")),
    getDocs(collectionGroup(db, "toTry")),
    getDocs(collectionGroup(db, "items")),
  ]);

  if (dishSnap.exists()) {
    const ownerId = String(dishSnap.data()?.owner || "").trim();
    if (ownerId) userIds.add(ownerId);
  }

  const collectParentUserId = (docSnap) => {
    const userId = docSnap.ref.parent.parent?.parent?.parent?.id || docSnap.ref.parent.parent?.id;
    if (userId) userIds.add(userId);
  };

  savedSnap.docs.forEach((docSnap) => {
    const linkedDishId = docSnap.data()?.dishId || docSnap.id;
    if (linkedDishId === dishId) collectParentUserId(docSnap);
  });

  toTrySnap.docs.forEach((docSnap) => {
    const linkedDishId = docSnap.data()?.dishId || docSnap.id;
    if (linkedDishId === dishId) collectParentUserId(docSnap);
  });

  customItemsSnap.docs.forEach((docSnap) => {
    const linkedDishId = docSnap.data()?.dishId || docSnap.id;
    if (linkedDishId === dishId) collectParentUserId(docSnap);
  });

  return Array.from(userIds);
}

function buildDishPayload(dishId, dishData = null) {
  return dishData
    ? {
        dishId,
        name: dishData.name || "",
        description: dishData.description || "",
        dishLink: dishData.dishLink || "",
        dishMode: dishData.dishMode || "",
        restaurant: normalizeRestaurant(dishData.restaurant),
        mediaType: dishData.mediaType || (dishData.mediaMimeType?.startsWith("video/") ? "video" : "image"),
        mediaMimeType: dishData.mediaMimeType || "",
        recipeIngredients: dishData.recipeIngredients || "",
        recipeMethod: dishData.recipeMethod || "",
        rating: Math.max(0, Math.min(5, Math.round((Number(dishData.rating) || 0) * 2) / 2)),
        price: Number.isFinite(Number(dishData.price ?? dishData.priceAmount ?? dishData.restaurantPrice)) && Number(dishData.price ?? dishData.priceAmount ?? dishData.restaurantPrice) > 0 ? Number(dishData.price ?? dishData.priceAmount ?? dishData.restaurantPrice) : null,
        priceCurrency: dishData.priceCurrency || dishData.currency || "",
        tags: normalizeTags(dishData.tags),
        isPublic: dishData.isPublic !== false,
        cardURL: dishData.cardURL || dishData.imageURL || dishData.imageUrl || "",
        thumbURL: dishData.thumbURL || dishData.thumbnailURL || dishData.cardURL || dishData.imageURL || "",
        imageURL:
          dishData.imageURL || dishData.imageUrl || dishData.image_url || dishData.image || "",
        owner: dishData.owner || "",
        ownerName: dishData.ownerName || "",
        ownerPhotoURL: dishData.ownerPhotoURL || "",
        saves: Math.max(0, Number(dishData.saves || 0)),
        addedAt: dishData.addedAt || dishData.savedAt || null,
        savedAt: dishData.savedAt || null,
        createdAt: dishData.createdAt || new Date(),
      }
    : { dishId, createdAt: new Date() };
}

async function hydrateDishPayload(dishId, payload) {
  try {
    const dishSnap = await getDoc(doc(db, "dishes", dishId));
    if (!dishSnap.exists()) return payload;
    const data = dishSnap.data();
    return {
      dishId,
      name: data.name || payload?.name || "",
      description: data.description || payload?.description || "",
      dishLink: data.dishLink || payload?.dishLink || "",
      dishMode: data.dishMode || payload?.dishMode || "",
      restaurant: normalizeRestaurant(data.restaurant || payload?.restaurant),
      mediaType:
        data.mediaType ||
        payload?.mediaType ||
        (data.mediaMimeType?.startsWith("video/") || payload?.mediaMimeType?.startsWith("video/")
          ? "video"
          : "image"),
      mediaMimeType: data.mediaMimeType || payload?.mediaMimeType || "",
      recipeIngredients: data.recipeIngredients || payload?.recipeIngredients || "",
      recipeMethod: data.recipeMethod || payload?.recipeMethod || "",
      rating: Math.max(0, Math.min(5, Math.round((Number(data.rating ?? payload?.rating) || 0) * 2) / 2)),
      price: Number.isFinite(Number(data.price ?? data.priceAmount ?? data.restaurantPrice ?? payload?.price ?? payload?.priceAmount ?? payload?.restaurantPrice)) && Number(data.price ?? data.priceAmount ?? data.restaurantPrice ?? payload?.price ?? payload?.priceAmount ?? payload?.restaurantPrice) > 0 ? Number(data.price ?? data.priceAmount ?? data.restaurantPrice ?? payload?.price ?? payload?.priceAmount ?? payload?.restaurantPrice) : null,
      priceCurrency: data.priceCurrency || data.currency || payload?.priceCurrency || payload?.currency || "",
      tags: normalizeTags(data.tags || payload?.tags),
      isPublic: data.isPublic !== false,
      cardURL: data.cardURL || data.imageURL || data.imageUrl || payload?.cardURL || "",
      thumbURL:
        data.thumbURL || data.thumbnailURL || data.cardURL || data.imageURL || payload?.thumbURL || "",
      imageURL:
        data.imageURL || data.imageUrl || data.image_url || data.image || payload?.imageURL || "",
      owner: data.owner || payload?.owner || "",
      ownerName: data.ownerName || payload?.ownerName || "",
      ownerPhotoURL: data.ownerPhotoURL || payload?.ownerPhotoURL || "",
      saves: Math.max(0, Number(data.saves ?? payload?.saves ?? 0)),
      addedAt: payload?.addedAt || payload?.savedAt || null,
      savedAt: payload?.savedAt || null,
      createdAt: data.createdAt || payload?.createdAt || new Date(),
    };
  } catch (err) {
    console.warn("Failed to hydrate dish payload, continuing:", err);
    return payload;
  }
}

function dishActivityOwnerId(payload = null) {
  return String(payload?.owner || payload?.ownerId || payload?.userId || payload?.uploadedBy || payload?.createdBy || "").trim();
}

async function recordDishSaveActivity(userId, dishId, payload = null) {
  const ownerId = dishActivityOwnerId(payload);
  if (!ownerId || !userId || ownerId === userId || !dishId) return;
  try {
    const activityRef = doc(db, "users", ownerId, "activity", `save_${dishId}_${userId}`);
    const existingActivity = await getDoc(activityRef);
    await setDoc(
      activityRef,
      {
        kind: "save",
        actorId: userId,
        dishId,
        dishName: payload?.name || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    if (!existingActivity.exists()) {
      await dispatchPushEvent("dish_saved", {
        actorId: userId,
        dishId,
      });
    }
  } catch (err) {
    console.warn("Failed to record dish save activity:", err);
  }
}

async function recordDishLikeActivity(userId, dishId, payload = null) {
  const ownerId = dishActivityOwnerId(payload);
  if (!ownerId || !userId || ownerId === userId || !dishId) return;
  try {
    const activityRef = doc(db, "users", ownerId, "activity", `like_${dishId}_${userId}`);
    const existingActivity = await getDoc(activityRef);
    await setDoc(
      activityRef,
      {
        kind: "like",
        actorId: userId,
        dishId,
        dishName: payload?.name || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    if (!existingActivity.exists()) {
      await dispatchPushEvent("dish_liked", {
        actorId: userId,
        dishId,
      });
    }
  } catch (err) {
    console.warn("Failed to record dish like activity:", err);
  }
}

export async function recordFollowActivity(actorId, targetUserId) {
  if (!actorId || !targetUserId || actorId === targetUserId) return false;
  try {
    await setDoc(
      doc(db, "users", targetUserId, "activity", `follow_${actorId}`),
      {
        kind: "follow",
        actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
    return true;
  } catch (err) {
    console.warn("Failed to record follow activity:", err);
    return false;
  }
}

export async function deleteFollowActivity(actorId, targetUserId) {
  if (!actorId || !targetUserId || actorId === targetUserId) return false;
  try {
    await deleteDoc(doc(db, "users", targetUserId, "activity", `follow_${actorId}`));
    return true;
  } catch (err) {
    console.warn("Failed to delete follow activity:", err);
    return false;
  }
}

async function mergeDishesWithCanonical(dishes = []) {
  const items = (Array.isArray(dishes) ? dishes : []).filter((dish) => dish?.id);
  if (!items.length) return [];

  const canonicalSnaps = await Promise.all(
    items.map((dish) => getDoc(doc(db, "dishes", dish.id)))
  );
  const canonicalMap = new Map();
  canonicalSnaps.forEach((snap) => {
    if (snap.exists()) canonicalMap.set(snap.id, snap.data());
  });

  return items.map((dish) => {
    const canonical = canonicalMap.get(dish.id);
    if (!canonical) {
      return {
        ...dish,
        saves: Math.max(0, Number(dish.saves || 0)),
      };
    }
    return {
      ...dish,
      name: canonical.name || dish.name || "",
      description: canonical.description || dish.description || "",
      dishLink: canonical.dishLink || dish.dishLink || "",
      dishMode: canonical.dishMode || dish.dishMode || "",
      restaurant: normalizeRestaurant(canonical.restaurant || dish.restaurant),
      mediaType:
        canonical.mediaType ||
        dish.mediaType ||
        (canonical.mediaMimeType?.startsWith("video/") || dish.mediaMimeType?.startsWith("video/")
          ? "video"
          : "image"),
      mediaMimeType: canonical.mediaMimeType || dish.mediaMimeType || "",
      recipeIngredients: canonical.recipeIngredients || dish.recipeIngredients || "",
      recipeMethod: canonical.recipeMethod || dish.recipeMethod || "",
      rating: Math.max(0, Math.min(5, Math.round((Number(canonical.rating ?? dish.rating) || 0) * 2) / 2)),
      price: Number.isFinite(Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice)) && Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice) > 0 ? Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice) : null,
      priceCurrency: canonical.priceCurrency || canonical.currency || dish.priceCurrency || dish.currency || "",
      tags: normalizeTags(canonical.tags || dish.tags),
      isPublic: canonical.isPublic !== false,
      cardURL:
        canonical.cardURL ||
        canonical.imageURL ||
        canonical.imageUrl ||
        dish.cardURL ||
        dish.imageURL ||
        "",
      thumbURL:
        canonical.thumbURL ||
        canonical.thumbnailURL ||
        canonical.cardURL ||
        canonical.imageURL ||
        dish.thumbURL ||
        dish.cardURL ||
        dish.imageURL ||
        "",
      imageURL:
        canonical.imageURL ||
        canonical.imageUrl ||
        canonical.image_url ||
        canonical.image ||
        dish.imageURL ||
        dish.imageUrl ||
        dish.image_url ||
        dish.image ||
        "",
      owner: canonical.owner || dish.owner || "",
      ownerName: canonical.ownerName || dish.ownerName || "",
      ownerPhotoURL: canonical.ownerPhotoURL || dish.ownerPhotoURL || "",
      saves: Math.max(0, Number(canonical.saves ?? dish.saves ?? 0)),
      addedAt: dish.addedAt || dish.savedAt || null,
      savedAt: dish.savedAt || null,
      createdAt: canonical.createdAt || dish.createdAt || null,
    };
  });
}

function normalizeDishlistName(name) {
  return String(name || "").trim().slice(0, 40);
}

function normalizeDishlistNameKey(name) {
  return normalizeDishlistName(name).toLowerCase();
}

export function isValidCustomDishlist(dishlist = {}) {
  const id = String(dishlist?.id || "").trim();
  const name = normalizeDishlistName(dishlist?.name || "");
  const nameKey = normalizeDishlistNameKey(name);
  if (!id) return false;
  if (isTagDishlistId(id)) return Boolean(getTagForDishlistId(id));
  if (RESERVED_CUSTOM_DISHLIST_IDS.has(id)) return false;
  if (!name) return false;
  if (RESERVED_CUSTOM_DISHLIST_NAME_KEYS.has(nameKey)) return false;
  return true;
}

function normalizeDisplayNameKey(name) {
  return String(name || "").trim().toLowerCase();
}

export function normalizeProfilePhotoURL(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.endsWith("/default.png") || lower.includes("default.png") || lower.includes("default-avatar")) return "";
  return value;
}

export async function isDisplayNameTaken(displayName, excludeUid = "") {
  const normalized = normalizeDisplayNameKey(displayName);
  if (!normalized) return false;
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.some((userDoc) => {
    if (excludeUid && userDoc.id === excludeUid) return false;
    const data = userDoc.data() || {};
    const existing =
      data.displayNameLower ||
      normalizeDisplayNameKey(data.displayName);
    return existing === normalized;
  });
}

export function getAvatarTone(name = "") {
  const tones = [
    "#F4B942",
    "#E85D75",
    "#49C172",
    "#45A6FF",
    "#A78BFA",
    "#F97316",
    "#20C7A5",
    "#EF4444",
  ];
  const source = String(name || "").trim().toUpperCase() || "U";
  const hash = Array.from(source).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return { bg: undefined, text: tones[hash % tones.length] };
}

function customDishlistsCollection(userId) {
  return collection(db, "users", userId, "dishlists");
}

function customDishlistDoc(userId, dishlistId) {
  return doc(db, "users", userId, "dishlists", dishlistId);
}

function customDishlistItemsCollection(userId, dishlistId) {
  return collection(db, "users", userId, "dishlists", dishlistId, "items");
}

function customDishlistItemDoc(userId, dishlistId, dishId) {
  return doc(db, "users", userId, "dishlists", dishlistId, "items", dishId);
}

function makeSystemDishlist(id, name, dishes) {
  return {
    id,
    name,
    type: "system",
    dishes,
    dishIds: dishes.map((dish) => dish.id).filter(Boolean),
    count: dishes.length,
  };
}

function dedupeDishArray(dishes) {
  return Array.from(
    new Map(
      (dishes || [])
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );
}

async function enrichWithOwnerPhotos(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const ownerIds = Array.from(new Set(items.map((i) => i.owner).filter(Boolean)));
  if (ownerIds.length === 0) return items;

  const now = Date.now();
  const missingOwnerIds = ownerIds.filter((uid) => {
    const cached = ownerPhotoCache.get(uid);
    return !cached || now - cached.cachedAt > OWNER_PHOTO_CACHE_TTL;
  });
  if (missingOwnerIds.length > 0) {
    const userSnaps = await Promise.all(missingOwnerIds.map((uid) => getDoc(doc(db, "users", uid))));
    userSnaps.forEach((snap) => {
      ownerPhotoCache.set(snap.id, {
        photoURL: snap.exists() ? normalizeProfilePhotoURL(snap.data()?.photoURL || "") : "",
        cachedAt: now,
      });
    });
  }

  return items.map((item) => ({
    ...item,
    ownerPhotoURL: normalizeProfilePhotoURL(item.ownerPhotoURL || ownerPhotoCache.get(item.owner)?.photoURL || ""),
  }));
}

// Upload dish image to Firebase Storage
export async function uploadImage(file, userId) {
  if (!file || !userId) {
    throw new Error("Missing file or userId for upload.");
  }
  const safeName = file.name ? file.name.replace(/\s+/g, "-") : "upload";
  const uniqueName = `${Date.now()}-${safeName}`;
  const storageRef = ref(storage, `dishImages/${userId}/${uniqueName}`);
  const snapshot = await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || undefined,
      cacheControl: "public,max-age=31536000,immutable",
    });
    task.on(
      "state_changed",
      undefined,
      (error) => reject(error),
      () => resolve(task.snapshot)
    );
  });
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

function blobToFile(blob, name) {
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function resizeImageFile(file, maxSize, quality = 0.78) {
  if (typeof window === "undefined" || !file?.type?.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  if (scale >= 0.98 && file.size < maxSize * 1200) {
    bitmap.close?.();
    return file;
  }
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;
  const baseName = file.name ? file.name.replace(/\.[^.]+$/, "") : "dish";
  return blobToFile(blob, `${baseName}-${maxSize}.jpg`);
}

export async function uploadDishImageVariants(file, userId) {
  if (!file || !userId) {
    throw new Error("Missing file or userId for upload.");
  }
  if (file.type?.startsWith("video/")) {
    const videoURL = await uploadImage(file, userId);
    return {
      imageURL: videoURL,
      cardURL: videoURL,
      thumbURL: videoURL,
      mediaType: "video",
      mediaMimeType: file.type || "",
    };
  }
  const [cardFile, thumbFile] = await Promise.all([
    resizeImageFile(file, 1400, 0.82),
    resizeImageFile(file, 420, 0.72),
  ]);
  const [cardURL, thumbURL] = await Promise.all([
    uploadImage(cardFile, userId),
    uploadImage(thumbFile, userId),
  ]);
  return {
    imageURL: cardURL,
    cardURL,
    thumbURL,
    mediaType: "image",
    mediaMimeType: file.type || "",
  };
}

export async function uploadProfileImage(file, userId) {
  if (!file || !userId) {
    throw new Error("Missing file or userId for profile upload.");
  }
  const safeName = file.name ? file.name.replace(/\s+/g, "-") : "profile";
  const uniqueName = `${Date.now()}-${safeName}`;
  const storageRef = ref(storage, `profileImages/${userId}/${uniqueName}`);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

function refFromStorageUrl(url) {
  if (!url) return null;
  if (url.startsWith("gs://")) {
    return ref(storage, url);
  }
  const match = url.match(/\/o\/([^?]+)/);
  if (!match || !match[1]) return null;
  const path = decodeURIComponent(match[1]);
  return ref(storage, path);
}

export async function deleteImageByUrl(url) {
  if (!url) return;
  const imageRef = refFromStorageUrl(url);
  if (!imageRef) return;
  try {
    await deleteObject(imageRef);
  } catch (err) {
    if (err?.code === "storage/object-not-found") return;
    throw err;
  }
}

export async function deleteDishAndImage(dishId, imageURL) {
  if (imageURL) {
    try {
      await deleteImageByUrl(imageURL);
    } catch (err) {
      console.error("Failed to delete image:", err);
    }
  }
  await deleteDoc(doc(db, "dishes", dishId));
  clearReadCache();
}

export async function updateDishAndSavedCopies(dishId, updates) {
  if (!dishId || !updates || Object.keys(updates).length === 0) return;
  await updateDoc(doc(db, "dishes", dishId), updates);
  clearReadCache();
  dataCache.clear();
  pendingCache.clear();

  const savedUsersQuery = query(collection(db, "users"), where("savedDishes", "array-contains", dishId));
  const [savedUsersSnapshot, toTrySnapshot, storySnapshot, customItemsSnapshot] = await Promise.all([
    getDocs(savedUsersQuery),
    getDocs(collectionGroup(db, "toTry")),
    getDocs(collectionGroup(db, "stories")),
    getDocs(collectionGroup(db, "items")),
  ]);

  const commitRefs = [];

  savedUsersSnapshot.docs.forEach((userDoc) => {
    commitRefs.push(doc(db, "users", userDoc.id, "saved", dishId));
  });

  toTrySnapshot.docs.forEach((docSnap) => {
    const linkedDishId = docSnap.data()?.dishId || docSnap.id;
    if (linkedDishId === dishId) commitRefs.push(docSnap.ref);
  });

  storySnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const linkedDishId = data.dishId || docSnap.id;
    if (linkedDishId === dishId) commitRefs.push(docSnap.ref);
  });

  customItemsSnapshot.docs.forEach((docSnap) => {
    const linkedDishId = docSnap.data()?.dishId || docSnap.id;
    if (linkedDishId === dishId) commitRefs.push(docSnap.ref);
  });

  if (commitRefs.length === 0) return;

  for (let i = 0; i < commitRefs.length; i += 400) {
    const batch = writeBatch(db);
    commitRefs.slice(i, i + 400).forEach((refToUpdate) => {
      batch.set(refToUpdate, updates, { merge: true });
    });
    await batch.commit();
  }
}

// Save dish to global dishes collection
export async function saveDishToFirestore(dish) {
  const docRef = await addDoc(collection(db, "dishes"), dish);
  await syncDishSaveCount(docRef.id);
  clearReadCache(dish?.owner || null);
  return docRef.id;
}

export async function createDishForUser(dish) {
  const docRef = await addDoc(collection(db, "dishes"), dish);
  await syncDishSaveCount(docRef.id);
  clearReadCache(dish?.owner || null);
  return docRef.id;
}

// Get all dishes (for feed)
export async function getAllDishesFromFirestore() {
  return cachedRead("dishes:all", async () => {
    const snapshot = await getDocs(collection(db, "dishes"));
    const dishes = snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .filter((dish) => typeof dish.name === "string" && dish.name.trim().length > 0);
    return enrichWithOwnerPhotos(dishes);
  });
}

// Get a paginated page of dishes, newest first
export async function getDishesPage({ pageSize = 20, cursor = null, enrichOwners = true } = {}) {
  const cacheKey = cursor ? null : `dishes:page:first:${pageSize}:${enrichOwners ? "owners" : "raw"}`;
  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  const baseQuery = query(
    collection(db, "dishes"),
    orderBy("createdAt", "desc"),
    limitResults(pageSize)
  );
  const pagedQuery = cursor
    ? query(
        collection(db, "dishes"),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limitResults(pageSize)
      )
    : baseQuery;

  const snapshot = await getDocs(pagedQuery);
  const rawItems = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((dish) => typeof dish.name === "string" && dish.name.trim().length > 0);
  const items = enrichOwners ? await enrichWithOwnerPhotos(rawItems) : rawItems;
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const result = { items, lastDoc };
  if (cacheKey) dataCache.set(cacheKey, { value: result, cachedAt: Date.now() });
  return result;
}

export async function getFollowingForUser(userId, { force = false } = {}) {
  if (force) {
    dataCache.delete(`user:${userId}:following`);
    pendingCache.delete(`user:${userId}:following`);
  }
  return cachedRead(`user:${userId}:following`, async () => {
    const userRef = doc(db, "users", userId);
    const [userSnap, followerBacklinksSnap] = await Promise.all([
      getDoc(userRef),
      getDocs(query(collection(db, "users"), where("followers", "array-contains", userId))),
    ]);
    const explicitFollowing = userSnap.exists() && Array.isArray(userSnap.data()?.following) ? userSnap.data().following : [];
    const backlinkFollowing = followerBacklinksSnap.docs.flatMap((snap) => {
      const data = snap.data() || {};
      return [snap.id, data.uid, data.userId, data.authUid, data.appleUserId, data.appleSub ? `apple:${data.appleSub}` : "", data.appleSub];
    });
    return Array.from(
      new Set(
        [...explicitFollowing, ...backlinkFollowing]
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );
  });
}

// Get dishes uploaded by specific user
export async function getDishesFromFirestore(userId) {
  return cachedRead(`user:${userId}:uploaded`, async () => {
    const q = query(collection(db, "dishes"), where("owner", "==", userId));
    const snapshot = await getDocs(q);
    const dishes = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    return enrichWithOwnerPhotos(dishes);
  });
}

export async function getUploadedDishesForUserAliases(userIds = []) {
  const aliases = Array.from(
    new Set(
      userIds
        .map((userId) => String(userId || "").trim())
        .filter(Boolean)
    )
  );
  if (!aliases.length) return [];

  const snapshots = await Promise.all(
    aliases.map((ownerId) => getDocs(query(collection(db, "dishes"), where("owner", "==", ownerId))))
  );
  const dishes = snapshots.flatMap((snapshot) =>
    snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }))
  );
  const unique = Array.from(new Map(dishes.filter((dish) => dish?.id).map((dish) => [dish.id, dish])).values());
  return enrichWithOwnerPhotos(unique);
}

// Save a dish reference (by ID) to a user's saved dishes
export async function saveDishReferenceToUser(userId, dishId, dishData = null) {
  if (!userId || !dishId) throw new Error("Missing userId or dishId");

  let payload = buildDishPayload(dishId, dishData);
  payload = await hydrateDishPayload(dishId, payload);
  payload = { ...payload, savedAt: serverTimestamp(), addedAt: serverTimestamp() };

  // Persist the saved dish doc (source of truth) with a short verify + retry
  const savedRef = doc(db, "users", userId, "saved", dishId);
  const attemptSave = async () => {
    await setDoc(savedRef, payload, { merge: true });
    const verifySnap = await getDoc(savedRef);
    return verifySnap.exists();
  };

  let ok = await attemptSave();
  if (!ok) {
    await new Promise((r) => setTimeout(r, 200));
    ok = await attemptSave();
  }
  if (!ok) {
    if (typeof globalThis !== "undefined") {
      globalThis.__lastSave = {
        ok: false,
        dishId,
        userId,
        error: "Save did not persist.",
        ts: Date.now(),
      };
    }
    throw new Error("Save did not persist.");
  }

  // Best-effort: keep a savedDishes array for quick lookups
  try {
    const refDoc = doc(db, "users", userId);
    await setDoc(refDoc, { savedDishes: arrayUnion(dishId), toTryDishes: arrayRemove(dishId) }, { merge: true });
    await deleteDoc(doc(db, "users", userId, "toTry", dishId));
  } catch (err) {
    console.warn("Failed to update saved/to-try arrays, continuing:", err);
  }

  if (typeof globalThis !== "undefined") {
    globalThis.__lastSave = {
      ok: true,
      dishId,
      userId,
      ts: Date.now(),
    };
  }

  await syncDishSaveCount(dishId);
  await recordDishSaveActivity(userId, dishId, payload);
  clearReadCache(userId);
  return true;
}

export async function removeSavedDishFromUser(userId, dishId) {
  if (!userId || !dishId) return false;
  const refDoc = doc(db, "users", userId);
  const savedDocRef = doc(db, "users", userId, "saved", dishId);
  try {
    await updateDoc(refDoc, { savedDishes: arrayRemove(dishId) });
    await deleteDoc(savedDocRef);
    await syncDishSaveCount(dishId);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to remove saved dish:", err);
    return false;
  }
}

// Save a swiped dish reference so it doesn't reappear
export async function saveSwipedDishForUser(userId, dishId) {
  const refDoc = doc(db, "users", userId);
  const userSnap = await getDoc(refDoc);
  const current = userSnap.exists() ? userSnap.data().swipedDishes || [] : [];
  const updated = Array.from(new Set([...current, dishId]));
  await setDoc(refDoc, { swipedDishes: updated }, { merge: true });
}

// Get swiped dish ids for a user
export async function getSwipedDishesForUser(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];
  return userSnap.data().swipedDishes || [];
}

export async function clearSwipedDishesForUser(userId) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { swipedDishes: [] }, { merge: true });
}

// Alias for naming consistency
export async function saveDishToUserList(userId, dishId, dishData = null) {
  if (!userId || !dishId) return false;

  const payload = await hydrateDishPayload(dishId, buildDishPayload(dishId, dishData));
  const savedPayload = { ...payload, savedAt: serverTimestamp(), addedAt: serverTimestamp() };

  const userRef = doc(db, "users", userId);
  const savedDocRef = doc(db, "users", userId, "saved", dishId);
  try {
    await setDoc(userRef, { savedDishes: arrayUnion(dishId), toTryDishes: arrayRemove(dishId) }, { merge: true });
    await setDoc(savedDocRef, savedPayload, { merge: true });
    await deleteDoc(doc(db, "users", userId, "toTry", dishId));
    await syncDishSaveCount(dishId);
    await recordDishSaveActivity(userId, dishId, savedPayload);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to add saved dish:", err);
    return false;
  }
}

export async function addDishToToTryList(userId, dishId, dishData = null) {
  if (!userId || !dishId) return false;

  const payload = await hydrateDishPayload(dishId, buildDishPayload(dishId, dishData));
  const toTryPayload = { ...payload, addedAt: serverTimestamp() };

  const userRef = doc(db, "users", userId);
  const savedDocRef = doc(db, "users", userId, "saved", dishId);
  const toTryDocRef = doc(db, "users", userId, "toTry", dishId);
  try {
    const savedSnap = await getDoc(savedDocRef);
    if (savedSnap.exists()) {
      await removeDishFromToTry(userId, dishId);
      return true;
    }
    await setDoc(userRef, { toTryDishes: arrayUnion(dishId) }, { merge: true });
    await setDoc(toTryDocRef, toTryPayload, { merge: true });
    await syncDishSaveCount(dishId);
    await recordDishSaveActivity(userId, dishId, toTryPayload);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to add to To Try list:", err);
    return false;
  }
}

export async function removeDishFromToTry(userId, dishId) {
  if (!userId || !dishId) return false;
  const userRef = doc(db, "users", userId);
  const toTryDocRef = doc(db, "users", userId, "toTry", dishId);
  try {
    await updateDoc(userRef, { toTryDishes: arrayRemove(dishId) });
  } catch (err) {
    console.warn("Failed to update toTryDishes array, continuing:", err);
  }
  try {
    await deleteDoc(toTryDocRef);
    await syncDishSaveCount(dishId);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to delete toTry dish doc:", err);
    return false;
  }
}

export async function upgradeToMyDishlist(userId, dish) {
  if (!userId || !dish?.id) return false;
  const saved = await saveDishToUserList(userId, dish.id, dish);
  if (!saved) return false;
  await removeDishFromToTry(userId, dish.id);
  return true;
}

export async function getToTryDishesFromFirestore(userId, { force = false } = {}) {
  if (force) clearReadCache(userId);
  return cachedRead(`user:${userId}:toTry`, async () => {
    const toTrySub = await getDocs(collection(db, "users", userId, "toTry"));
    const results = toTrySub.docs.map((d) => ({ id: d.id, ...d.data() }));
    const merged = await mergeDishesWithCanonical(results);
    return enrichWithOwnerPhotos(merged);
  });
}

export async function getCustomDishlistsForUser(userId) {
  if (!userId) return [];
  return cachedRead(`user:${userId}:customDishlists`, async () => {
    const snapshot = await getDocs(customDishlistsCollection(userId));
    const items = await Promise.all(
      snapshot.docs.map(async (dishlistDoc) => {
        const data = dishlistDoc.data() || {};
        const tag = getTagForDishlistId(dishlistDoc.id);
        const isTagSystem = isTagDishlistId(dishlistDoc.id) && Boolean(tag);
        if (!isTagSystem && !isValidCustomDishlist({ id: dishlistDoc.id, name: data.name })) return null;
        const itemSnap = await getDocs(customDishlistItemsCollection(userId, dishlistDoc.id));
        const dishes = itemSnap.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
        const merged = await mergeDishesWithCanonical(dishes);
        const enriched = await enrichWithOwnerPhotos(merged);
        return {
          id: dishlistDoc.id,
          name: isTagSystem ? tag : data.name || "Dishlist",
          type: isTagSystem ? "tag_system" : "custom",
          tag: isTagSystem ? tag : undefined,
          coverURL: data.coverURL || data.coverUrl || "",
          coverCardURL: data.coverCardURL || data.coverURL || data.coverUrl || "",
          coverThumbURL: data.coverThumbURL || data.coverCardURL || data.coverURL || data.coverUrl || "",
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          dishIds: enriched.map((dish) => dish.id).filter(Boolean),
          count: enriched.length,
          dishes: enriched,
        };
      })
    );
    return items.filter(Boolean).sort((a, b) => {
      const aTime = a?.updatedAt?.seconds || a?.createdAt?.seconds || 0;
      const bTime = b?.updatedAt?.seconds || b?.createdAt?.seconds || 0;
      return bTime - aTime;
    });
  });
}

export async function getCustomDishlistDishes(userId, dishlistId) {
  if (!userId || !dishlistId) return [];
  return cachedRead(`user:${userId}:customDishlist:${dishlistId}`, async () => {
    const snapshot = await getDocs(customDishlistItemsCollection(userId, dishlistId));
    const dishes = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
    const merged = await mergeDishesWithCanonical(dishes);
    return enrichWithOwnerPhotos(merged);
  });
}

export async function getAllDishlistsForUser(userId) {
  if (!userId) return [];
  const [saved, toTry, uploaded, custom] = await Promise.all([
    getSavedDishesFromFirestore(userId),
    getToTryDishesFromFirestore(userId),
    getDishesFromFirestore(userId),
    getCustomDishlistsForUser(userId),
  ]);
  const allDishes = dedupeDishArray([
    ...uploaded,
    ...saved,
    ...toTry,
    ...custom.flatMap((dishlist) => dishlist.dishes || []),
  ]);
  const savedIds = new Set(saved.map((dish) => dish?.id).filter(Boolean));
  const toTryCollection = dedupeDishArray([
    ...toTry.filter((dish) => dish?.id && !savedIds.has(dish.id)),
  ]);
  const tagDishlists = buildDefaultTagDishlists(custom);
  const nonTagCustom = custom.filter((dishlist) => !isTagDishlistId(dishlist.id));
  return [
    makeSystemDishlist("saved", "Your Classics", saved),
    makeSystemDishlist("to_try", "To Try", toTryCollection),
    makeSystemDishlist("uploaded", "Uploaded", uploaded),
    makeSystemDishlist("all_dishes", "All dishes", allDishes),
    ...tagDishlists,
    ...nonTagCustom,
  ];
}

function mergeCustomDishlistsById(groups = []) {
  const byId = new Map();
  groups.flat().forEach((dishlist) => {
    if (!dishlist?.id) return;
    const existing = byId.get(dishlist.id);
    if (!existing) {
      byId.set(dishlist.id, { ...dishlist, dishes: dedupeDishArray(dishlist.dishes || []) });
      return;
    }
    const dishes = dedupeDishArray([...(existing.dishes || []), ...(dishlist.dishes || [])]);
    byId.set(dishlist.id, {
      ...existing,
      ...dishlist,
      dishes,
      dishIds: dishes.map((dish) => dish.id).filter(Boolean),
      count: dishes.length,
      createdAt: existing.createdAt || dishlist.createdAt || null,
      updatedAt: existing.updatedAt || dishlist.updatedAt || null,
    });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = a?.updatedAt?.seconds || a?.createdAt?.seconds || 0;
    const bTime = b?.updatedAt?.seconds || b?.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export async function getAllDishlistsForUserAliases(userIds = []) {
  const aliases = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((userId) => String(userId || "").trim())
        .filter(Boolean)
    )
  );
  if (!aliases.length) return [];
  if (aliases.length === 1) return getAllDishlistsForUser(aliases[0]);

  const [savedGroups, toTryGroups, uploaded, customGroups] = await Promise.all([
    Promise.all(aliases.map((userId) => getSavedDishesFromFirestore(userId))),
    Promise.all(aliases.map((userId) => getToTryDishesFromFirestore(userId))),
    getUploadedDishesForUserAliases(aliases),
    Promise.all(aliases.map((userId) => getCustomDishlistsForUser(userId))),
  ]);

  const saved = dedupeDishArray(savedGroups.flat());
  const toTry = dedupeDishArray(toTryGroups.flat());
  const custom = mergeCustomDishlistsById(customGroups);
  const allDishes = dedupeDishArray([
    ...uploaded,
    ...saved,
    ...toTry,
    ...custom.flatMap((dishlist) => dishlist.dishes || []),
  ]);
  const savedIds = new Set(saved.map((dish) => dish?.id).filter(Boolean));
  const toTryCollection = dedupeDishArray(toTry.filter((dish) => dish?.id && !savedIds.has(dish.id)));

  const tagDishlists = buildDefaultTagDishlists(custom);
  const nonTagCustom = custom.filter((dishlist) => !isTagDishlistId(dishlist.id));
  return [
    makeSystemDishlist("saved", "Your Classics", saved),
    makeSystemDishlist("to_try", "To Try", toTryCollection),
    makeSystemDishlist("uploaded", "Uploaded", uploaded),
    makeSystemDishlist("all_dishes", "All dishes", allDishes),
    ...tagDishlists,
    ...nonTagCustom,
  ];
}

export async function createCustomDishlist(userId, name, initialDishes = []) {
  const cleanedName = normalizeDishlistName(name);
  if (!userId || !cleanedName) return null;
  if (!isValidCustomDishlist({ id: "custom-dishlist", name: cleanedName })) return null;
  const dishlistRef = doc(customDishlistsCollection(userId));
  const now = serverTimestamp();
  const uniqueDishes = Array.from(
    new Map(
      initialDishes
        .filter((dish) => dish?.id)
        .map((dish) => [dish.id, dish])
    ).values()
  );
  await setDoc(dishlistRef, {
    name: cleanedName,
    createdAt: now,
    updatedAt: now,
    dishIds: uniqueDishes.map((dish) => dish.id),
  });
  if (uniqueDishes.length) {
    const batch = writeBatch(db);
    for (const dish of uniqueDishes) {
      const payload = await hydrateDishPayload(dish.id, buildDishPayload(dish.id, dish));
      batch.set(customDishlistItemDoc(userId, dishlistRef.id, dish.id), payload, { merge: true });
    }
    await batch.commit();
    await Promise.all(uniqueDishes.map((dish) => syncDishSaveCount(dish.id)));
  }
  clearReadCache(userId);
  return dishlistRef.id;
}

export async function getPopularCustomDishlistNames(max = 8) {
  try {
    const snapshot = await getDocs(collectionGroup(db, "dishlists"));
    const reserved = new Set(["top picks", "favorites", "your classics", "to try", "all dishes", "uploaded"]);
    const counts = new Map();

    snapshot.docs.forEach((dishlistDoc) => {
      const rawName = dishlistDoc.data()?.name || "";
      const cleanedName = normalizeDishlistName(rawName);
      const key = normalizeDishlistNameKey(cleanedName);
      if (!cleanedName || reserved.has(key)) return;
      const existing = counts.get(key) || { name: cleanedName, count: 0 };
      existing.count += 1;
      if (cleanedName.length < existing.name.length) existing.name = cleanedName;
      counts.set(key, existing);
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, max)
      .map((entry) => entry.name);
  } catch (err) {
    console.error("Failed to fetch popular dishlist names:", err);
    return [];
  }
}

export async function addDishToCustomDishlist(userId, dishlistId, dishId, dishData = null) {
  if (!userId || !dishlistId || !dishId) return false;
  if (!isTagDishlistId(dishlistId)) {
    const targetSnap = await getDoc(customDishlistDoc(userId, dishlistId));
    if (!targetSnap.exists() || !isValidCustomDishlist({ id: dishlistId, name: targetSnap.data()?.name })) return false;
  }
  const payload = await hydrateDishPayload(dishId, buildDishPayload(dishId, dishData));
  try {
    await setDoc(
      customDishlistDoc(userId, dishlistId),
      {
        updatedAt: serverTimestamp(),
        dishIds: arrayUnion(dishId),
      },
      { merge: true }
    );
    await setDoc(customDishlistItemDoc(userId, dishlistId, dishId), payload, { merge: true });
    await syncDishSaveCount(dishId);
    await recordDishSaveActivity(userId, dishId, payload);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to add dish to custom dishlist:", err);
    return false;
  }
}

export async function removeDishFromCustomDishlist(userId, dishlistId, dishId) {
  if (!userId || !dishlistId || !dishId) return false;
  try {
    await setDoc(
      customDishlistDoc(userId, dishlistId),
      {
        updatedAt: serverTimestamp(),
        dishIds: arrayRemove(dishId),
      },
      { merge: true }
    );
    await deleteDoc(customDishlistItemDoc(userId, dishlistId, dishId));
    await syncDishSaveCount(dishId);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to remove dish from custom dishlist:", err);
    return false;
  }
}

export async function deleteCustomDishlist(userId, dishlistId) {
  if (!userId || !dishlistId) return false;
  try {
    const itemsSnap = await getDocs(customDishlistItemsCollection(userId, dishlistId));
    const affectedDishIds = Array.from(
      new Set(
        itemsSnap.docs
          .map((itemDoc) => itemDoc.data()?.dishId || itemDoc.id)
          .filter(Boolean)
      )
    );
    const batch = writeBatch(db);
    itemsSnap.docs.forEach((itemDoc) => {
      batch.delete(itemDoc.ref);
    });
    batch.delete(customDishlistDoc(userId, dishlistId));
    await batch.commit();
    if (affectedDishIds.length) {
      await Promise.all(affectedDishIds.map((dishId) => syncDishSaveCount(dishId)));
    }
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to delete custom dishlist:", err);
    return false;
  }
}

export async function updateCustomDishlistName(userId, dishlistId, name) {
  const cleanedName = normalizeDishlistName(name);
  if (!userId || !dishlistId || !cleanedName) return false;
  if (!isValidCustomDishlist({ id: dishlistId, name: cleanedName })) return false;
  try {
    await setDoc(
      customDishlistDoc(userId, dishlistId),
      {
        name: cleanedName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to rename custom dishlist:", err);
    return false;
  }
}

export async function updateCustomDishlistDetails(userId, dishlistId, updates = {}) {
  if (!userId || !dishlistId) return false;
  const payload = { updatedAt: serverTimestamp() };
  if (Object.prototype.hasOwnProperty.call(updates, "name")) {
    const cleanedName = normalizeDishlistName(updates.name);
    if (!cleanedName || !isValidCustomDishlist({ id: dishlistId, name: cleanedName })) return false;
    payload.name = cleanedName;
  }
  ["coverURL", "coverCardURL", "coverThumbURL"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      payload[key] = String(updates[key] || "").trim();
    }
  });
  try {
    await setDoc(customDishlistDoc(userId, dishlistId), payload, { merge: true });
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to update custom dishlist:", err);
    return false;
  }
}

export async function saveDishToSelectedDishlist(userId, dishlistId, dishData) {
  if (!userId || !dishData?.id || !dishlistId) return false;
  if (dishlistId === "uploaded") return true;
  if (dishlistId === "all_dishes") return true;
  if (dishlistId === "saved") return saveDishToUserList(userId, dishData.id, dishData);
  if (dishlistId === "to_try") return addDishToToTryList(userId, dishData.id, dishData);
  return addDishToCustomDishlist(userId, dishlistId, dishData.id, dishData);
}

export async function queueDishForDishlistSorting(userId, dishData) {
  if (!userId || !dishData?.id) return false;
  try {
    const payload = await hydrateDishPayload(dishData.id, buildDishPayload(dishData.id, dishData));
    await setDoc(
      doc(db, "users", userId, "pendingDishlistSorting", dishData.id),
      {
        ...payload,
        queuedAt: serverTimestamp(),
      },
      { merge: true }
    );
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to queue dish for dishlist sorting:", err);
    return false;
  }
}

export async function getPendingDishlistSorting(userId) {
  if (!userId) return [];
  try {
    const snapshot = await getDocs(query(collection(db, "users", userId, "pendingDishlistSorting"), orderBy("queuedAt", "asc")));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Failed to load pending dishlist sorting:", err);
    return [];
  }
}

export async function removePendingDishlistSorting(userId, dishId) {
  if (!userId || !dishId) return false;
  try {
    await deleteDoc(doc(db, "users", userId, "pendingDishlistSorting", dishId));
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to remove pending dishlist sorting:", err);
    return false;
  }
}

export async function getUsersWhoSavedDish(dishId) {
  if (!dishId) return [];
  try {
    const userIds = await getUserIdsWithDishInAnyDishlist(dishId);
    const docs = await Promise.all(userIds.map((uid) => getDoc(doc(db, "users", uid))));
    return docs
      .filter((snap) => snap.exists())
      .map((snap) => ({ id: snap.id, ...snap.data(), photoURL: normalizeProfilePhotoURL(snap.data()?.photoURL || "") }));
  } catch (err) {
    console.error("Failed to fetch users who saved dish:", err);
    return [];
  }
}

export async function getUsersByIds(userIds = []) {
  const ids = Array.from(
    new Set(
      (userIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return [];
  try {
    const docs = await Promise.all(ids.map((uid) => getDoc(doc(db, "users", uid))));
    return docs
      .filter((snap) => snap.exists())
      .map((snap) => ({ id: snap.id, ...snap.data(), photoURL: normalizeProfilePhotoURL(snap.data()?.photoURL || "") }));
  } catch (err) {
    console.error("Failed to load users by ids:", err);
    return [];
  }
}

export async function getLeaderboardQuestions(max = 12) {
  try {
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const timestampToMs = (value) => {
      if (!value) return 0;
      if (typeof value.toMillis === "function") return value.toMillis();
      if (typeof value.seconds === "number") return value.seconds * 1000;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const snapshot = await getDocs(
      query(leaderboardQuestionsCollection(), orderBy("createdAt", "desc"), limitResults(max))
    );
    const questions = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const answersSnap = await getDocs(leaderboardAnswersCollection(docSnap.id));
        const answers = answersSnap.docs.map((answerDoc) => ({ id: answerDoc.id, ...answerDoc.data() }));
        const totalVotes = answers.reduce((sum, answer) => sum + (Array.isArray(answer.votes) ? answer.votes.length : 0), 0);
        const recentVotes = answers.reduce((sum, answer) => {
          const votes = Array.isArray(answer.votes) ? answer.votes : [];
          const voteTimestamps = answer.voteTimestamps && typeof answer.voteTimestamps === "object" ? answer.voteTimestamps : null;
          if (voteTimestamps) {
            return sum + votes.filter((userId) => timestampToMs(voteTimestamps[userId]) >= weekAgoMs).length;
          }
          return sum + (timestampToMs(answer.createdAt) >= weekAgoMs ? votes.length : 0);
        }, 0);
        const topAnswer = answers
          .slice()
          .sort((a, b) => (Array.isArray(b.votes) ? b.votes.length : 0) - (Array.isArray(a.votes) ? a.votes.length : 0))[0] || null;
        return {
          id: docSnap.id,
          ...docSnap.data(),
          answerCount: answers.length,
          totalVotes,
          recentVotes,
          topAnswerText: topAnswer?.text || "",
        };
      })
    );
    return questions.sort((a, b) => Number(b.recentVotes || 0) - Number(a.recentVotes || 0) || Number(b.totalVotes || 0) - Number(a.totalVotes || 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (err) {
    console.error("Failed to load leaderboard questions:", err);
    return [];
  }
}

export async function getLeaderboardQuestion(questionId) {
  if (!questionId) return null;
  try {
    const snap = await getDoc(leaderboardQuestionDoc(questionId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error("Failed to load leaderboard question:", err);
    return null;
  }
}

export async function getLeaderboardAnswers(questionId) {
  if (!questionId) return [];
  try {
    const snapshot = await getDocs(leaderboardAnswersCollection(questionId));
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const voteDelta = (Array.isArray(b.votes) ? b.votes.length : 0) - (Array.isArray(a.votes) ? a.votes.length : 0);
        if (voteDelta !== 0) return voteDelta;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
  } catch (err) {
    console.error("Failed to load leaderboard answers:", err);
    return [];
  }
}

export async function createLeaderboardQuestion(userId, question) {
  const title = String(question?.title || "").trim();
  if (!userId || !title) return null;
  try {
    const now = serverTimestamp();
    const refDoc = doc(leaderboardQuestionsCollection());
    await setDoc(refDoc, {
      title,
      label: String(question?.label || "IN TREND").trim(),
      accent: String(question?.accent || "red").trim(),
      dishMode: question?.dishMode === "home" ? "home" : "restaurant",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      closesAt: question?.closesAt || null,
      active: true,
    });
    return refDoc.id;
  } catch (err) {
    console.error("Failed to create leaderboard question:", err);
    return null;
  }
}

export async function updateLeaderboardQuestion(questionId, userId, updates = {}) {
  const title = String(updates?.title || "").trim();
  if (!questionId || !userId || !title) return false;
  try {
    await setDoc(
      leaderboardQuestionDoc(questionId),
      {
        title,
        label: String(updates?.label || "IN TREND").trim(),
        accent: String(updates?.accent || "red").trim(),
        dishMode: updates?.dishMode === "home" ? "home" : "restaurant",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to update leaderboard question:", err);
    return false;
  }
}

export async function deleteLeaderboardQuestion(questionId, userId) {
  if (!questionId || !userId) return false;
  try {
    const questionSnap = await getDoc(leaderboardQuestionDoc(questionId));
    if (!questionSnap.exists()) return false;
    const answersSnap = await getDocs(leaderboardAnswersCollection(questionId));
    const batch = writeBatch(db);
    answersSnap.docs.forEach((answerDoc) => batch.delete(answerDoc.ref));
    batch.delete(leaderboardQuestionDoc(questionId));
    await batch.commit();
    return true;
  } catch (err) {
    console.error("Failed to delete leaderboard question:", err);
    return false;
  }
}

export async function addLeaderboardAnswer(questionId, user, answer) {
  const text = String(answer?.text || "").trim();
  if (!questionId || !user?.uid || !text) return null;
  try {
    const answersSnap = await getDocs(leaderboardAnswersCollection(questionId));
    const refDoc = doc(leaderboardAnswersCollection(questionId));
    const batch = writeBatch(db);
    answersSnap.docs.forEach((answerDoc) => {
      const data = answerDoc.data();
      if (Array.isArray(data.votes) && data.votes.includes(user.uid)) {
        batch.update(answerDoc.ref, {
          votes: arrayRemove(user.uid),
          [`voteTimestamps.${user.uid}`]: deleteField(),
          [`voteAnonymous.${user.uid}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    batch.set(refDoc, {
      text,
      note: String(answer?.note || "").trim(),
      restaurant: answer?.restaurant || null,
      anonymous: Boolean(answer?.anonymous),
      userId: user.uid,
      userName: user.displayName || "User",
      userPhotoURL: normalizeProfilePhotoURL(user.photoURL || ""),
      votes: arrayUnion(user.uid),
      voteTimestamps: {
        [user.uid]: serverTimestamp(),
      },
      voteAnonymous: {
        [user.uid]: Boolean(answer?.anonymous),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return refDoc.id;
  } catch (err) {
    console.error("Failed to add leaderboard answer:", err);
    return null;
  }
}

export async function getLeaderboardRestaurantAnswers(maxQuestions = 50) {
  try {
    const questionsSnap = await getDocs(
      query(leaderboardQuestionsCollection(), orderBy("createdAt", "desc"), limitResults(maxQuestions))
    );
    const groups = await Promise.all(
      questionsSnap.docs.map(async (questionDoc) => {
        const question = { id: questionDoc.id, ...questionDoc.data() };
        if ((question.dishMode || "restaurant") === "home") return [];
        const answersSnap = await getDocs(leaderboardAnswersCollection(question.id));
        return answersSnap.docs
          .map((answerDoc) => ({ id: answerDoc.id, ...answerDoc.data() }))
          .filter((answer) => normalizeRestaurant(answer.restaurant))
          .map((answer) => ({
            ...answer,
            kind: "leaderboardAnswer",
            questionId: question.id,
            questionTitle: question.title,
            questionLabel: question.label,
            questionAccent: question.accent,
            questionDishMode: question.dishMode || "restaurant",
            voteCount: Array.isArray(answer.votes) ? answer.votes.length : 0,
          }));
      })
    );
    return groups.flat();
  } catch (err) {
    console.error("Failed to load leaderboard restaurant answers:", err);
    return [];
  }
}

export async function voteLeaderboardAnswer(questionId, answerId, userId, options = {}) {
  if (!questionId || !answerId || !userId) return false;
  try {
    const answersSnap = await getDocs(leaderboardAnswersCollection(questionId));
    const batch = writeBatch(db);
    answersSnap.docs.forEach((answerDoc) => {
      const data = answerDoc.data();
      if (answerDoc.id === answerId) {
        const alreadyVoted = Array.isArray(data.votes) && data.votes.includes(userId);
        if (alreadyVoted && options?.toggle) {
          batch.update(answerDoc.ref, {
            votes: arrayRemove(userId),
            [`voteTimestamps.${userId}`]: deleteField(),
            [`voteAnonymous.${userId}`]: deleteField(),
            updatedAt: serverTimestamp(),
          });
          return;
        }
        batch.update(answerDoc.ref, {
          votes: arrayUnion(userId),
          [`voteTimestamps.${userId}`]: serverTimestamp(),
          [`voteAnonymous.${userId}`]: Boolean(options?.anonymous),
          updatedAt: serverTimestamp(),
        });
        return;
      }
      if (Array.isArray(data.votes) && data.votes.includes(userId)) {
        batch.update(answerDoc.ref, {
          votes: arrayRemove(userId),
          [`voteTimestamps.${userId}`]: deleteField(),
          [`voteAnonymous.${userId}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error("Failed to vote leaderboard answer:", err);
    return false;
  }
}

export async function getLeaderboardAnswersForUser(userIds = [], includeAnonymous = false) {
  const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : [userIds]).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) return [];
  try {
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const timestampToMs = (value) => {
      if (!value) return 0;
      if (typeof value.toMillis === "function") return value.toMillis();
      if (typeof value.seconds === "number") return value.seconds * 1000;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const questionsSnap = await getDocs(
      query(leaderboardQuestionsCollection(), orderBy("createdAt", "desc"), limitResults(50))
    );
    const groups = await Promise.all(
      questionsSnap.docs.map(async (questionDoc) => {
        const question = { id: questionDoc.id, ...questionDoc.data() };
        const answersSnap = await getDocs(leaderboardAnswersCollection(question.id));
        const answers = answersSnap.docs.map((answerDoc) => ({ id: answerDoc.id, ...answerDoc.data() }));
        const totalVotes = answers.reduce((sum, answer) => sum + (Array.isArray(answer.votes) ? answer.votes.length : 0), 0);
        const recentVotes = answers.reduce((sum, answer) => {
          const votes = Array.isArray(answer.votes) ? answer.votes : [];
          const voteTimestamps = answer.voteTimestamps && typeof answer.voteTimestamps === "object" ? answer.voteTimestamps : null;
          if (voteTimestamps) {
            return sum + votes.filter((userId) => timestampToMs(voteTimestamps[userId]) >= weekAgoMs).length;
          }
          return sum + (timestampToMs(answer.createdAt) >= weekAgoMs ? votes.length : 0);
        }, 0);
        return answers
          .flatMap((answer) => {
            const votedByUser = Array.isArray(answer.votes) && ids.some((id) => answer.votes.includes(id));
            if (!votedByUser) return [];
            const matchingVoteId = ids.find((id) => Array.isArray(answer.votes) && answer.votes.includes(id)) || "";
            const anonymousVote = Boolean(answer.voteAnonymous?.[matchingVoteId]);
            if (!includeAnonymous && anonymousVote) return [];
            return [
              {
                ...answer,
                anonymous: anonymousVote,
                takeKind: "vote",
                questionId: question.id,
                questionTitle: question.title,
                questionLabel: question.label,
                questionAccent: question.accent,
                questionDishMode: question.dishMode || "restaurant",
                questionTotalVotes: totalVotes,
                questionRecentVotes: recentVotes,
              },
            ];
          });
      })
    );
    return groups
      .flat()
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (err) {
    console.error("Failed to load user leaderboard answers:", err);
    return [];
  }
}

export async function getCommentsForDish(dishId, max = 20, scope = "dish", direction = "desc") {
  if (!dishId) return [];
  try {
    const q = query(
      getDishCommentsCollection(dishId, scope),
      orderBy("createdAt", direction === "asc" ? "asc" : "desc"),
      limitResults(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Failed to load comments:", err);
    return [];
  }
}

export async function getDishLikeState(dishId, userId = null) {
  if (!dishId) return { count: 0, liked: false };
  try {
    const [dishSnap, likeSnap] = await Promise.all([
      getDoc(doc(db, "dishes", dishId)),
      userId ? getDoc(doc(db, "dishes", dishId, "likes", userId)) : Promise.resolve(null),
    ]);
    const count = Math.max(0, Number(dishSnap.exists() ? dishSnap.data()?.likes || 0 : 0));
    return { count, liked: Boolean(likeSnap?.exists?.()) };
  } catch (err) {
    console.error("Failed to load dish like state:", err);
    return { count: 0, liked: false };
  }
}

export async function toggleDishLike(dishId, userId) {
  if (!dishId || !userId) return null;
  try {
    const result = await runTransaction(db, async (transaction) => {
      const dishRef = doc(db, "dishes", dishId);
      const likeRef = doc(db, "dishes", dishId, "likes", userId);
      const [dishSnap, likeSnap] = await Promise.all([
        transaction.get(dishRef),
        transaction.get(likeRef),
      ]);
      const dishData = dishSnap.exists() ? dishSnap.data() || {} : {};
      const ownerId = dishActivityOwnerId(dishData);
      const dishName = dishData.name || "";
      const currentCount = Math.max(0, Number(dishSnap.exists() ? dishSnap.data()?.likes || 0 : 0));
      if (likeSnap.exists()) {
        const nextCount = Math.max(0, currentCount - 1);
        transaction.delete(likeRef);
        transaction.set(dishRef, { likes: nextCount }, { merge: true });
        return { liked: false, count: nextCount, ownerId, dishName };
      }
      const nextCount = currentCount + 1;
      transaction.set(likeRef, { userId, createdAt: serverTimestamp() }, { merge: true });
      transaction.set(dishRef, { likes: nextCount }, { merge: true });
      return { liked: true, count: nextCount, ownerId, dishName };
    });
    if (result?.ownerId && result.ownerId !== userId) {
      if (result.liked) {
        await recordDishLikeActivity(userId, dishId, { owner: result.ownerId, name: result.dishName });
      } else {
        await deleteDoc(doc(db, "users", result.ownerId, "activity", `like_${dishId}_${userId}`)).catch((err) => {
          console.warn("Failed to remove dish like activity:", err);
        });
      }
    }
    clearReadCache();
    return result;
  } catch (err) {
    console.error("Failed to toggle dish like:", err);
    return null;
  }
}

export async function addCommentToDish(dishId, payload, scope = "dish") {
  if (!dishId || !payload?.userId || !payload?.text) return false;
  try {
    await addDoc(getDishCommentsCollection(dishId, scope), {
      userId: payload.userId,
      userName: payload.userName || "User",
      userPhotoURL: payload.userPhotoURL || "",
      text: payload.text,
      parentId: payload.parentId || null,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Failed to add comment:", err);
    return false;
  }
}

export async function deleteCommentThread(dishId, commentId, scope = "dish") {
  if (!dishId || !commentId) return false;
  try {
    const commentsRef = getDishCommentsCollection(dishId, scope);
    const q = query(commentsRef, where("parentId", "==", commentId));
    const repliesSnap = await getDocs(q);
    const batch = writeBatch(db);
    repliesSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(doc(commentsRef, commentId));
    await batch.commit();
    return true;
  } catch (err) {
    console.error("Failed to delete comment thread:", err);
    return false;
  }
}

export async function getCommentsForStory(ownerId, storyId, max = 20) {
  if (!ownerId || !storyId) return [];
  try {
    const q = query(
      getStoryCommentsCollection(ownerId, storyId),
      orderBy("createdAt", "desc"),
      limitResults(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Failed to load story comments:", err);
    return [];
  }
}

export async function addCommentToStory(ownerId, storyId, payload) {
  if (!ownerId || !storyId || !payload?.userId || !payload?.text) return false;
  try {
    await addDoc(getStoryCommentsCollection(ownerId, storyId), {
      userId: payload.userId,
      userName: payload.userName || "User",
      userPhotoURL: payload.userPhotoURL || "",
      text: payload.text,
      parentId: payload.parentId || null,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Failed to add story comment:", err);
    return false;
  }
}

export async function deleteStoryCommentThread(ownerId, storyId, commentId) {
  if (!ownerId || !storyId || !commentId) return false;
  try {
    const commentsRef = getStoryCommentsCollection(ownerId, storyId);
    const q = query(commentsRef, where("parentId", "==", commentId));
    const repliesSnap = await getDocs(q);
    const batch = writeBatch(db);
    repliesSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(doc(commentsRef, commentId));
    await batch.commit();
    return true;
  } catch (err) {
    console.error("Failed to delete story comment thread:", err);
    return false;
  }
}

const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

function buildStoryPayload(userId, story) {
  return {
    dishId: story.dishId || story.id || "",
    owner: userId,
    ownerName: story.ownerName || "",
    ownerPhotoURL: story.ownerPhotoURL || "",
    name: story.name || story.dishName || story.title || "",
    description: story.description || "",
    mediaType: story.mediaType || (story.mediaMimeType?.startsWith("video/") ? "video" : "image"),
    mediaMimeType: story.mediaMimeType || "",
    recipeIngredients: story.recipeIngredients || "",
    recipeMethod: story.recipeMethod || "",
    taggedUserName: story.taggedUserName || "",
    taggedUserId: story.taggedUserId || "",
    storyMealTag: story.storyMealTag || story.mealTag || "",
    tags: normalizeTags(story.tags),
    restaurant: story.restaurant || null,
    cardURL: story.cardURL || story.imageURL || story.imageUrl || "",
    thumbURL: story.thumbURL || story.thumbnailURL || story.cardURL || story.imageURL || "",
    imageURL: story.imageURL || story.imageUrl || story.image_url || story.image || "",
    createdAt: serverTimestamp(),
    expiresAtMs: Date.now() + STORY_DURATION_MS,
    viewedBy: [],
  };
}

export async function publishDishAsStory(userId, dish, storyMeta = {}) {
  if (!userId || !dish?.id) return false;
  try {
    const publishedAtMs = Date.now();
    const storyRef = doc(db, "users", userId, "stories", dish.id);
    const storyPushRef = doc(db, "users", userId, "storyPushes", dish.id);
    await setDoc(storyRef, buildStoryPayload(userId, { ...dish, ...storyMeta, dishId: dish.id }), { merge: true });
    await setDoc(
      doc(db, "users", userId),
      {
        hasActiveStory: true,
        storyUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const storyMealTag = storyMeta.storyMealTag || storyMeta.mealTag || "";
    const existingPushSnap = await getDoc(storyPushRef).catch(() => null);
    const existingHistory = existingPushSnap?.exists() ? existingPushSnap.data()?.history : [];
    const lastPush = Array.isArray(existingHistory) ? existingHistory[existingHistory.length - 1] : null;
    const lastPushMs = Number(lastPush?.pushedAtMs || Date.parse(lastPush?.pushedAtISO || "")) || 0;
    const isDuplicatePush = lastPushMs && publishedAtMs - lastPushMs < 3000 && (lastPush?.storyMealTag || "") === storyMealTag;
    if (isDuplicatePush) return true;
    await setDoc(
      storyPushRef,
      {
        dishId: dish.id,
        count: increment(1),
        history: arrayUnion({
          pushedAtMs: publishedAtMs,
          pushedAtISO: new Date(publishedAtMs).toISOString(),
          storyMealTag,
        }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to publish story:", err);
    return false;
  }
}

export async function publishCustomStory(userId, story) {
  if (!userId || !story?.id) return false;
  try {
    await setDoc(
      doc(db, "users", userId, "stories", story.id),
      buildStoryPayload(userId, story),
      { merge: true }
    );
    await setDoc(
      doc(db, "users", userId),
      {
        hasActiveStory: true,
        storyUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to publish custom story:", err);
    return false;
  }
}

export async function getActiveStoriesForUser(userId) {
  if (!userId) return [];
  try {
    const snapshot = await getDocs(
      query(collection(db, "users", userId, "stories"), orderBy("createdAt", "desc"))
    );
    const now = Date.now();
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((story) => (story.expiresAtMs || 0) > now);
  } catch (err) {
    console.error("Failed to load active stories:", err);
    return [];
  }
}

export async function markStoryViewed(ownerId, storyId, viewerId) {
  if (!ownerId || !storyId || !viewerId) return false;
  try {
    await setDoc(
      doc(db, "users", ownerId, "stories", storyId),
      { viewedBy: arrayUnion(viewerId) },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to mark story viewed:", err);
    return false;
  }
}

export async function deleteStory(userId, storyId) {
  if (!userId || !storyId) return false;
  try {
    await deleteDoc(doc(db, "users", userId, "stories", storyId));
    const remaining = await getActiveStoriesForUser(userId);
    await setDoc(
      doc(db, "users", userId),
      {
        hasActiveStory: remaining.length > 0,
        storyUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to delete story:", err);
    return false;
  }
}

export async function getTrendingStoryDishes(limitCount = 20) {
  try {
    const snapshot = await getDocs(collectionGroup(db, "stories"));
    const now = Date.now();
    const counts = new Map();
    const sample = new Map();
    snapshot.docs.forEach((docSnap) => {
      const story = { id: docSnap.id, ...docSnap.data() };
      if ((story.expiresAtMs || 0) <= now) return;
      const key = story.dishId || story.id;
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!sample.has(key)) sample.set(key, story);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitCount)
      .map(([key, count]) => ({
        ...sample.get(key),
        id: sample.get(key)?.dishId || key,
        storyCount: count,
      }));
  } catch (err) {
    console.error("Failed to load trending story dishes:", err);
    return [];
  }
}

export async function getStoryPushStatsForUser(userId) {
  if (!userId) return {};
  try {
    const snapshot = await getDocs(collection(db, "users", userId, "storyPushes"));
    const stats = {};
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      stats[docSnap.id] = {
        count: Number(data.count || 0),
        history: Array.isArray(data.history) ? data.history : [],
        updatedAt: data.updatedAt || null,
      };
    });
    return stats;
  } catch (err) {
    console.error("Failed to load story push stats:", err);
    return {};
  }
}

export function getConversationId(a, b) {
  if (!a || !b) return null;
  return [a, b].sort().join("_");
}

export async function getOrCreateConversation(currentUser, otherUser) {
  const convoId = getConversationId(currentUser?.uid, otherUser?.id || otherUser?.uid);
  if (!convoId) return null;
  const convoRef = doc(db, "conversations", convoId);
  const convoSnap = await getDoc(convoRef);
  if (!convoSnap.exists()) {
    await setDoc(convoRef, {
      participants: [currentUser.uid, otherUser.id || otherUser.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadBy: [],
      readBy: [],
    });
  }
  return convoId;
}

export async function getUserConversations(userId) {
  if (!userId) return [];
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function sendMessage(conversationId, message) {
  if (!conversationId || !message?.senderId || !message?.type) return false;
  const msgRef = collection(db, "conversations", conversationId, "messages");
  const payload = {
    senderId: message.senderId,
    type: message.type,
    text: message.text || "",
    dishId: message.dishId || "",
    createdAt: serverTimestamp(),
  };
  try {
    const convoRef = doc(db, "conversations", conversationId);
    const convoSnap = await getDoc(convoRef);
    const participants = convoSnap.exists() ? convoSnap.data()?.participants || [] : [];
    const unreadBy = participants.filter((participantId) => participantId && participantId !== message.senderId);
    await addDoc(msgRef, payload);
    await setDoc(
      convoRef,
      {
        lastMessage: {
          ...payload,
          createdAt: new Date(),
        },
        updatedAt: serverTimestamp(),
        unreadBy,
        readBy: [message.senderId],
      },
      { merge: true }
    );
    await dispatchPushEvent("direct_message", {
      conversationId,
      senderId: message.senderId,
      text: payload.text || "",
      type: payload.type || "text",
    });
    return true;
  } catch (err) {
    console.error("Failed to send message:", err);
    return false;
  }
}

export async function deleteMessageForSender(conversationId, messageId, userId) {
  if (!conversationId || !messageId || !userId) return false;
  try {
    const messageRef = doc(db, "conversations", conversationId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) return false;

    const messageData = messageSnap.data();
    if (messageData?.senderId !== userId) return false;

    await deleteDoc(messageRef);

    const convoRef = doc(db, "conversations", conversationId);
    const latestSnap = await getDocs(
      query(
        collection(db, "conversations", conversationId, "messages"),
        orderBy("createdAt", "desc"),
        limitResults(1)
      )
    );

    if (latestSnap.empty) {
      await setDoc(
        convoRef,
        {
          lastMessage: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    }

    const latest = latestSnap.docs[0].data();
    await setDoc(
      convoRef,
      {
        lastMessage: {
          senderId: latest.senderId || "",
          type: latest.type || "text",
          text: latest.text || "",
          dishId: latest.dishId || "",
          createdAt: latest.createdAt?.toDate?.() || new Date(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.error("Failed to delete message:", err);
    return false;
  }
}

export async function markConversationAsRead(conversationId, userId) {
  if (!conversationId || !userId) return false;
  try {
    await setDoc(
      doc(db, "conversations", conversationId),
      {
        unreadBy: arrayRemove(userId),
        readBy: arrayUnion(userId),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to mark conversation as read:", err);
    return false;
  }
}

// Get dishes saved by user
export async function getSavedDishesFromFirestore(userId, { force = false } = {}) {
  if (force) clearReadCache(userId);
  return cachedRead(`user:${userId}:saved`, async () => {
  const savedSub = await getDocs(collection(db, "users", userId, "saved"));
  const results = savedSub.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Always hydrate save counts and core fields from canonical dishes/{id}
  // so UI reflects the true global state across users.
  const canonicalSnaps = await Promise.all(
    results.map((dish) => getDoc(doc(db, "dishes", dish.id)))
  );
  const canonicalMap = new Map();
  canonicalSnaps.forEach((snap) => {
    if (snap.exists()) canonicalMap.set(snap.id, snap.data());
  });

  const merged = results.map((dish) => {
    const canonical = canonicalMap.get(dish.id);
    if (!canonical) return dish;
    return {
      ...dish,
      name: canonical.name || dish.name || "",
      description: canonical.description || dish.description || "",
      mediaType:
        canonical.mediaType ||
        dish.mediaType ||
        (canonical.mediaMimeType?.startsWith("video/") || dish.mediaMimeType?.startsWith("video/")
          ? "video"
          : "image"),
      dishMode: canonical.dishMode || dish.dishMode || "",
      restaurant: normalizeRestaurant(canonical.restaurant || dish.restaurant),
      mediaMimeType: canonical.mediaMimeType || dish.mediaMimeType || "",
      recipeIngredients: canonical.recipeIngredients || dish.recipeIngredients || "",
      recipeMethod: canonical.recipeMethod || dish.recipeMethod || "",
      rating: Math.max(0, Math.min(5, Math.round((Number(canonical.rating ?? dish.rating) || 0) * 2) / 2)),
      price: Number.isFinite(Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice)) && Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice) > 0 ? Number(canonical.price ?? canonical.priceAmount ?? canonical.restaurantPrice ?? dish.price ?? dish.priceAmount ?? dish.restaurantPrice) : null,
      priceCurrency: canonical.priceCurrency || canonical.currency || dish.priceCurrency || dish.currency || "",
      tags: normalizeTags(canonical.tags || dish.tags),
      isPublic: canonical.isPublic !== false,
      cardURL:
        canonical.cardURL ||
        canonical.imageURL ||
        canonical.imageUrl ||
        dish.cardURL ||
        dish.imageURL ||
        "",
      thumbURL:
        canonical.thumbURL ||
        canonical.thumbnailURL ||
        canonical.cardURL ||
        canonical.imageURL ||
        dish.thumbURL ||
        dish.cardURL ||
        dish.imageURL ||
        "",
      imageURL:
        canonical.imageURL ||
        canonical.imageUrl ||
        canonical.image_url ||
        canonical.image ||
        dish.imageURL ||
        dish.imageUrl ||
        dish.image_url ||
        dish.image ||
        "",
      owner: canonical.owner || dish.owner || "",
      ownerName: canonical.ownerName || dish.ownerName || "",
      ownerPhotoURL: canonical.ownerPhotoURL || dish.ownerPhotoURL || "",
      saves: Math.max(0, Number(canonical.saves || 0)),
    };
  });

  return enrichWithOwnerPhotos(merged);
  });
}

// Remove a dish reference from all users who saved it
export async function removeDishFromAllUsers(dishId) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("savedDishes", "array-contains", dishId));
  const snapshot = await getDocs(q);
  const swipedQuery = query(usersRef, where("swipedDishes", "array-contains", dishId));
  const swipedSnapshot = await getDocs(swipedQuery);

  if (snapshot.empty && swipedSnapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((userDoc) => {
    batch.update(userDoc.ref, { savedDishes: arrayRemove(dishId) });
    batch.delete(doc(db, "users", userDoc.id, "saved", dishId));
  });
  swipedSnapshot.docs.forEach((userDoc) => {
    batch.update(userDoc.ref, { swipedDishes: arrayRemove(dishId) });
  });
  await batch.commit();
  clearReadCache();
}

export async function recountDishSavesFromUsers() {
  const dishesSnap = await getDocs(collection(db, "dishes"));
  const entries = await Promise.all(
    dishesSnap.docs.map(async (dishDoc) => {
      const dishId = dishDoc.id;
      const userIds = await getUserIdsWithDishInAnyDishlist(dishId);
      return [dishId, userIds.length];
    })
  );
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    entries.slice(i, i + chunkSize).forEach(([dishId, saveCount]) => {
      batch.set(doc(db, "dishes", dishId), { saves: saveCount }, { merge: true });
    });
    await batch.commit();
  }

  return entries.length;
}

export async function syncDishSaveCount(dishId) {
  if (!dishId) return 0;
  const userIds = await getUserIdsWithDishInAnyDishlist(dishId);
  const saveCount = userIds.length;
  await setDoc(doc(db, "dishes", dishId), { saves: saveCount }, { merge: true });
  return saveCount;
}

// Update ownerName on all dishes for a user (used after profile rename)
export async function updateOwnerNameForDishes(userId, ownerName, ownerPhotoURL = null) {
  const q = query(collection(db, "dishes"), where("owner", "==", userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const updates = { ownerName };
  if (ownerPhotoURL !== null) {
    updates.ownerPhotoURL = ownerPhotoURL;
  }

  const batch = writeBatch(db);
  snapshot.docs.forEach((dishDoc) => {
    batch.update(dishDoc.ref, updates);
  });
  await batch.commit();
}

export async function deleteUserAccountData(userId) {
  if (!userId) return false;

  const commitBatch = async (items, writer) => {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((item) => writer(batch, item));
      await batch.commit();
    }
  };

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() || {} : {};

    if (userData.photoURL) {
      await deleteImageByUrl(userData.photoURL).catch((err) => {
        console.warn("Failed to delete profile photo during account deletion:", err);
      });
    }

    const ownedDishesSnap = await getDocs(query(collection(db, "dishes"), where("owner", "==", userId)));
    const ownedDishIds = ownedDishesSnap.docs.map((dishDoc) => dishDoc.id);
    for (const dishDoc of ownedDishesSnap.docs) {
      const dish = dishDoc.data() || {};
      await removeDishFromAllUsers(dishDoc.id);
      await deleteDishAndImage(dishDoc.id, dish.imageURL || dish.imageUrl || dish.image_url || dish.image || "");
    }

    const savedSnap = await getDocs(collection(db, "users", userId, "saved"));
    const toTrySnap = await getDocs(collection(db, "users", userId, "toTry"));
    const storiesSnap = await getDocs(collection(db, "users", userId, "stories"));
    await commitBatch([...savedSnap.docs, ...toTrySnap.docs, ...storiesSnap.docs], (batch, docSnap) => {
      batch.delete(docSnap.ref);
    });

    const usersSnap = await getDocs(collection(db, "users"));
    await commitBatch(usersSnap.docs.filter((docSnap) => docSnap.id !== userId), (batch, docSnap) => {
      const updates = {
        followers: arrayRemove(userId),
        following: arrayRemove(userId),
      };
      if (ownedDishIds.length > 0) {
        updates.savedDishes = arrayRemove(...ownedDishIds);
        updates.swipedDishes = arrayRemove(...ownedDishIds);
        updates.toTryDishes = arrayRemove(...ownedDishIds);
      }
      batch.set(docSnap.ref, updates, { merge: true });
    });

    const dishesWithUserCommentsSnap = await getDocs(collection(db, "dishes"));
    for (const dishDoc of dishesWithUserCommentsSnap.docs) {
      const commentsSnap = await getDocs(collection(db, "dishes", dishDoc.id, "comments"));
      const userCommentDocs = commentsSnap.docs.filter((commentDoc) => commentDoc.data()?.userId === userId);
      await commitBatch(userCommentDocs, (batch, docSnap) => {
        batch.delete(docSnap.ref);
      });
    }

    const conversationsSnap = await getDocs(
      query(collection(db, "conversations"), where("participants", "array-contains", userId))
    );
    for (const convoDoc of conversationsSnap.docs) {
      const messagesSnap = await getDocs(collection(db, "conversations", convoDoc.id, "messages"));
      await commitBatch(messagesSnap.docs, (batch, docSnap) => {
        batch.delete(docSnap.ref);
      });
      await deleteDoc(convoDoc.ref);
    }

    await deleteDoc(userRef);
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to delete user account data:", err);
    throw err;
  }
}

// One-time cleanup: remove stale "id" field from dishes to avoid collisions.
export async function cleanupDishIdField() {
  const snapshot = await getDocs(collection(db, "dishes"));
  let total = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data && Object.prototype.hasOwnProperty.call(data, "id")) {
      batch.update(docSnap.ref, { id: deleteField() });
      total += 1;
      ops += 1;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return total;
}

// One-time cleanup: delete dishes with missing/blank name, and remove references.
export async function cleanupNamelessDishes() {
  const snapshot = await getDocs(collection(db, "dishes"));
  let total = 0;
  for (const dishSnap of snapshot.docs) {
    const dish = dishSnap.data();
    const hasValidName = typeof dish?.name === "string" && dish.name.trim().length > 0;
    if (hasValidName) continue;

    await deleteDishAndImage(
      dishSnap.id,
      dish?.imageURL || dish?.imageUrl || dish?.image_url || dish?.image || ""
    );
    await removeDishFromAllUsers(dishSnap.id);
    total += 1;
  }
  return total;
}
