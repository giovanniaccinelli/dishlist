import { db, storage } from "./firebase";
import {
  collection,
  collectionGroup,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  orderBy,
  limit as limitResults,
  startAfter,
  updateDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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

  const userSnaps = await Promise.all(ownerIds.map((uid) => getDoc(doc(db, "users", uid))));
  const photoMap = new Map();
  userSnaps.forEach((snap) => {
    if (snap.exists()) {
      photoMap.set(snap.id, snap.data()?.photoURL || "");
    }
  });

  return items.map((item) => ({
    ...item,
    ownerPhotoURL: item.ownerPhotoURL || photoMap.get(item.owner) || "",
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
}

export async function updateDishAndSavedCopies(dishId, updates) {
  if (!dishId || !updates || Object.keys(updates).length === 0) return;
  await updateDoc(doc(db, "dishes", dishId), updates);

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
}

// Get all dishes (for feed)
export async function getAllDishesFromFirestore() {
  const snapshot = await getDocs(collection(db, "dishes"));
  const dishes = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter((dish) => typeof dish.name === "string" && dish.name.trim().length > 0);
  return enrichWithOwnerPhotos(dishes);
}

// Get a paginated page of dishes, newest first
export async function getDishesPage({ pageSize = 20, cursor = null } = {}) {
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
  return { items, lastDoc };
}

export async function getFollowingForUser(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];
  return userSnap.data().following || [];
}

// Get dishes uploaded by specific user
export async function getDishesFromFirestore(userId) {
  const q = query(collection(db, "dishes"), where("owner", "==", userId));
  const snapshot = await getDocs(q);
  const dishes = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  return enrichWithOwnerPhotos(dishes);
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
        cost: Math.max(1, Math.min(3, Number(dishData.cost) || 1)),
        time: Math.max(1, Math.min(3, Number(dishData.time ?? dishData.difficulty) || 1)),
        isPublic: dishData.isPublic !== false,
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
          cost: Math.max(1, Math.min(3, Number(data.cost) || Number(payload.cost) || 1)),
          time: Math.max(
            1,
            Math.min(3, Number(data.time ?? data.difficulty ?? payload.time ?? payload.difficulty) || 1)
          ),
          isPublic: data.isPublic !== false,
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
        cost: Math.max(1, Math.min(3, Number(dishData.cost) || 1)),
        time: Math.max(1, Math.min(3, Number(dishData.time ?? dishData.difficulty) || 1)),
        isPublic: dishData.isPublic !== false,
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
    await updateDoc(userRef, { savedDishes: arrayUnion(dishId) });
    await setDoc(savedDocRef, payload, { merge: true });
    await syncDishSaveCount(dishId);
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
        cost: Math.max(1, Math.min(3, Number(dishData.cost) || 1)),
        time: Math.max(1, Math.min(3, Number(dishData.time ?? dishData.difficulty) || 1)),
        isPublic: dishData.isPublic !== false,
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
  const toTrySub = await getDocs(collection(db, "users", userId, "toTry"));
  const results = toTrySub.docs.map((d) => ({ id: d.id, ...d.data() }));
  return enrichWithOwnerPhotos(results);
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

// Get dishes saved by user
export async function getSavedDishesFromFirestore(userId) {
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
      cost: Math.max(1, Math.min(3, Number(canonical.cost) || Number(dish.cost) || 1)),
      time: Math.max(
        1,
        Math.min(3, Number(canonical.time ?? canonical.difficulty ?? dish.time ?? dish.difficulty) || 1)
      ),
      isPublic: canonical.isPublic !== false,
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
export async function updateOwnerNameForDishes(userId, ownerName) {
  const q = query(collection(db, "dishes"), where("owner", "==", userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((dishDoc) => {
    batch.update(dishDoc.ref, { ownerName });
  });
  await batch.commit();
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
