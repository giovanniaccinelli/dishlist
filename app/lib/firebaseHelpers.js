import { db, storage } from "./firebase";
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
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const OWNER_PHOTO_CACHE_TTL = 2 * 60 * 1000;
const ownerPhotoCache = new Map();
const DATA_CACHE_TTL = 45 * 1000;
const dataCache = new Map();
const pendingCache = new Map();

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
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 6);
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
        photoURL: snap.exists() ? snap.data()?.photoURL || "" : "",
        cachedAt: now,
      });
    });
  }

  return items.map((item) => ({
    ...item,
    ownerPhotoURL: item.ownerPhotoURL || ownerPhotoCache.get(item.owner)?.photoURL || "",
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
  const snapshot = await uploadBytes(storageRef, file);
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

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("savedDishes", "array-contains", dishId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((userDoc) => {
    batch.set(doc(db, "users", userDoc.id, "saved", dishId), updates, { merge: true });
  });
  await batch.commit();
}

// Save dish to global dishes collection
export async function saveDishToFirestore(dish) {
  await addDoc(collection(db, "dishes"), dish);
  clearReadCache(dish?.owner || null);
}

export async function createDishForUser(dish) {
  const docRef = await addDoc(collection(db, "dishes"), dish);
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
export async function getDishesPage({ pageSize = 20, cursor = null } = {}) {
  const cacheKey = cursor ? null : `dishes:page:first:${pageSize}`;
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
  const items = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((dish) => typeof dish.name === "string" && dish.name.trim().length > 0);
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const result = { items, lastDoc };
  if (cacheKey) dataCache.set(cacheKey, { value: result, cachedAt: Date.now() });
  return result;
}

export async function getFollowingForUser(userId) {
  return cachedRead(`user:${userId}:following`, async () => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return [];
    return userSnap.data().following || [];
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

// Save a dish reference (by ID) to a user's saved dishes
export async function saveDishReferenceToUser(userId, dishId, dishData = null) {
  if (!userId || !dishId) throw new Error("Missing userId or dishId");

  let payload = dishData
    ? {
        dishId,
        name: dishData.name || "",
        description: dishData.description || "",
        recipeIngredients: dishData.recipeIngredients || "",
        recipeMethod: dishData.recipeMethod || "",
        tags: normalizeTags(dishData.tags),
        isPublic: dishData.isPublic !== false,
        cardURL: dishData.cardURL || dishData.imageURL || dishData.imageUrl || "",
        thumbURL: dishData.thumbURL || dishData.thumbnailURL || dishData.cardURL || dishData.imageURL || "",
        imageURL:
          dishData.imageURL || dishData.imageUrl || dishData.image_url || dishData.image || "",
        owner: dishData.owner || "",
        ownerName: dishData.ownerName || "",
        ownerPhotoURL: dishData.ownerPhotoURL || "",
        createdAt: new Date(),
      }
    : { dishId, createdAt: new Date() };

  // If payload is missing core fields, fetch from dishes/{id} to guarantee a complete saved card
  if (!payload.name) {
    try {
      const dishSnap = await getDoc(doc(db, "dishes", dishId));
      if (dishSnap.exists()) {
        const data = dishSnap.data();
        payload = {
          dishId,
          name: data.name || payload.name || "",
          description: data.description || payload.description || "",
          recipeIngredients: data.recipeIngredients || payload.recipeIngredients || "",
          recipeMethod: data.recipeMethod || payload.recipeMethod || "",
          tags: normalizeTags(data.tags || payload.tags),
          isPublic: data.isPublic !== false,
          cardURL: data.cardURL || data.imageURL || data.imageUrl || payload.cardURL || "",
          thumbURL: data.thumbURL || data.thumbnailURL || data.cardURL || data.imageURL || payload.thumbURL || "",
          imageURL:
            data.imageURL || data.imageUrl || data.image_url || data.image || payload.imageURL || "",
          owner: data.owner || payload.owner || "",
          ownerName: data.ownerName || payload.ownerName || "",
          ownerPhotoURL: data.ownerPhotoURL || payload.ownerPhotoURL || "",
          createdAt: data.createdAt || payload.createdAt || new Date(),
        };
      }
    } catch (err) {
      console.warn("Failed to hydrate saved dish payload, continuing:", err);
    }
  }

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
    await setDoc(refDoc, { savedDishes: arrayUnion(dishId) }, { merge: true });
  } catch (err) {
    console.warn("Failed to update savedDishes array, continuing:", err);
  }

  if (typeof globalThis !== "undefined") {
    globalThis.__lastSave = {
      ok: true,
      dishId,
      userId,
      ts: Date.now(),
    };
  }

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
    await setDoc(doc(db, "dishes", dishId), { saves: increment(-1) }, { merge: true });
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

  const payload = dishData
    ? {
        dishId,
        name: dishData.name || "",
        description: dishData.description || "",
        recipeIngredients: dishData.recipeIngredients || "",
        recipeMethod: dishData.recipeMethod || "",
        tags: normalizeTags(dishData.tags),
        isPublic: dishData.isPublic !== false,
        cardURL: dishData.cardURL || dishData.imageURL || dishData.imageUrl || "",
        thumbURL: dishData.thumbURL || dishData.thumbnailURL || dishData.cardURL || dishData.imageURL || "",
        imageURL:
          dishData.imageURL || dishData.imageUrl || dishData.image_url || dishData.image || "",
        owner: dishData.owner || "",
        ownerName: dishData.ownerName || "",
        ownerPhotoURL: dishData.ownerPhotoURL || "",
        createdAt: dishData.createdAt || new Date(),
      }
    : { dishId, createdAt: new Date() };

  const userRef = doc(db, "users", userId);
  const savedDocRef = doc(db, "users", userId, "saved", dishId);
  try {
    const existingSaved = await getDoc(savedDocRef);
    await updateDoc(userRef, { savedDishes: arrayUnion(dishId) });
    await setDoc(savedDocRef, payload, { merge: true });
    if (!existingSaved.exists()) {
      await setDoc(doc(db, "dishes", dishId), { saves: increment(1) }, { merge: true });
    }
    clearReadCache(userId);
    return true;
  } catch (err) {
    console.error("Failed to add saved dish:", err);
    return false;
  }
}

export async function addDishToToTryList(userId, dishId, dishData = null) {
  if (!userId || !dishId) return false;

  const payload = dishData
    ? {
        dishId,
        name: dishData.name || "",
        description: dishData.description || "",
        recipeIngredients: dishData.recipeIngredients || "",
        recipeMethod: dishData.recipeMethod || "",
        tags: normalizeTags(dishData.tags),
        isPublic: dishData.isPublic !== false,
        cardURL: dishData.cardURL || dishData.imageURL || dishData.imageUrl || "",
        thumbURL: dishData.thumbURL || dishData.thumbnailURL || dishData.cardURL || dishData.imageURL || "",
        imageURL:
          dishData.imageURL || dishData.imageUrl || dishData.image_url || dishData.image || "",
        owner: dishData.owner || "",
        ownerName: dishData.ownerName || "",
        ownerPhotoURL: dishData.ownerPhotoURL || "",
        createdAt: dishData.createdAt || new Date(),
      }
    : { dishId, createdAt: new Date() };

  const userRef = doc(db, "users", userId);
  const toTryDocRef = doc(db, "users", userId, "toTry", dishId);
  try {
    await setDoc(userRef, { toTryDishes: arrayUnion(dishId) }, { merge: true });
    await setDoc(toTryDocRef, payload, { merge: true });
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

export async function getToTryDishesFromFirestore(userId) {
  return cachedRead(`user:${userId}:toTry`, async () => {
    const toTrySub = await getDocs(collection(db, "users", userId, "toTry"));
    const results = toTrySub.docs.map((d) => ({ id: d.id, ...d.data() }));
    return enrichWithOwnerPhotos(results);
  });
}

export async function getUsersWhoSavedDish(dishId) {
  if (!dishId) return [];
  try {
    const q = query(collection(db, "users"), where("savedDishes", "array-contains", dishId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Failed to fetch users who saved dish:", err);
    return [];
  }
}

export async function getCommentsForDish(dishId, max = 20) {
  if (!dishId) return [];
  try {
    const q = query(
      collection(db, "dishes", dishId, "comments"),
      orderBy("createdAt", "desc"),
      limitResults(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Failed to load comments:", err);
    return [];
  }
}

export async function addCommentToDish(dishId, payload) {
  if (!dishId || !payload?.userId || !payload?.text) return false;
  try {
    await addDoc(collection(db, "dishes", dishId, "comments"), {
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

export async function deleteCommentThread(dishId, commentId) {
  if (!dishId || !commentId) return false;
  try {
    const commentsRef = collection(db, "dishes", dishId, "comments");
    const q = query(commentsRef, where("parentId", "==", commentId));
    const repliesSnap = await getDocs(q);
    const batch = writeBatch(db);
    repliesSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(doc(db, "dishes", dishId, "comments", commentId));
    await batch.commit();
    return true;
  } catch (err) {
    console.error("Failed to delete comment thread:", err);
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
    name: story.name || "",
    description: story.description || "",
    recipeIngredients: story.recipeIngredients || "",
    recipeMethod: story.recipeMethod || "",
    tags: normalizeTags(story.tags),
    cardURL: story.cardURL || story.imageURL || story.imageUrl || "",
    thumbURL: story.thumbURL || story.thumbnailURL || story.cardURL || story.imageURL || "",
    imageURL: story.imageURL || story.imageUrl || story.image_url || story.image || "",
    createdAt: serverTimestamp(),
    expiresAtMs: Date.now() + STORY_DURATION_MS,
    viewedBy: [],
  };
}

export async function publishDishAsStory(userId, dish) {
  if (!userId || !dish?.id) return false;
  try {
    const storyRef = doc(db, "users", userId, "stories", dish.id);
    await setDoc(storyRef, buildStoryPayload(userId, { ...dish, dishId: dish.id }), { merge: true });
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
    return true;
  } catch (err) {
    console.error("Failed to send message:", err);
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
export async function getSavedDishesFromFirestore(userId) {
  return cachedRead(`user:${userId}:saved`, async () => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];

  const savedDishIds = new Set(userSnap.data().savedDishes || []);
  const savedSub = await getDocs(collection(db, "users", userId, "saved"));
  const results = [];
  const missing = [];
  savedSub.docs.forEach((d) => {
    const data = d.data();
    savedDishIds.add(d.id);
    if (data) {
      results.push({ id: d.id, ...data });
    }
  });

  for (const id of savedDishIds) {
    if (results.find((r) => r.id === id)) continue;
    const dishSnap = await getDoc(doc(db, "dishes", id));
    if (dishSnap.exists()) {
      const data = dishSnap.data();
      results.push({ id: dishSnap.id, ...data });
    } else {
      missing.push(id);
      try {
        await deleteDoc(doc(db, "users", userId, "saved", id));
      } catch (err) {
        console.error("Failed to delete stale saved doc:", err);
      }
    }
  }

  if (missing.length > 0) {
    try {
      await updateDoc(userRef, {
        savedDishes: arrayRemove(...missing),
      });
    } catch (err) {
      console.warn("Failed to clean savedDishes array, continuing:", err);
    }
  }
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
      recipeIngredients: canonical.recipeIngredients || dish.recipeIngredients || "",
      recipeMethod: canonical.recipeMethod || dish.recipeMethod || "",
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
      saves: Number(canonical.saves || 0),
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
  const counts = new Map();
  dishesSnap.docs.forEach((d) => counts.set(d.id, 0));

  const savedDocsSnap = await getDocs(collectionGroup(db, "saved"));
  const uniquePairs = new Set();
  savedDocsSnap.docs.forEach((savedDoc) => {
    const uid = savedDoc.ref.parent.parent?.id;
    const dishId = savedDoc.data()?.dishId || savedDoc.id;
    if (!uid || !dishId) return;
    uniquePairs.add(`${uid}:${dishId}`);
  });
  uniquePairs.forEach((pair) => {
    const [, dishId] = pair.split(":");
    counts.set(dishId, (counts.get(dishId) || 0) + 1);
  });

  const entries = Array.from(counts.entries());
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
  const snapshot = await getDocs(collectionGroup(db, "saved"));
  const userIds = new Set();
  snapshot.docs.forEach((savedDoc) => {
    const savedDishId = savedDoc.data()?.dishId || savedDoc.id;
    if (savedDishId !== dishId) return;
    const uid = savedDoc.ref.parent.parent?.id;
    if (uid) userIds.add(uid);
  });
  const saveCount = userIds.size;
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
