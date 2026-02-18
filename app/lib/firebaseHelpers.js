import { db, storage } from "./firebase";
import {
  collection,
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
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

// Save dish to global dishes collection
export async function saveDishToFirestore(dish) {
  await addDoc(collection(db, "dishes"), dish);
}

// Get all dishes (for feed)
export async function getAllDishesFromFirestore() {
  const snapshot = await getDocs(collection(db, "dishes"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Save a dish reference (by ID) to a user's saved dishes
export async function saveDishReferenceToUser(userId, dishId) {
  const refDoc = doc(db, "users", userId);
  const userSnap = await getDoc(refDoc);
  const current = userSnap.exists() ? userSnap.data().savedDishes || [] : [];
  const updated = Array.from(new Set([...current, dishId]));
  await setDoc(refDoc, { savedDishes: updated }, { merge: true });
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
export async function saveDishToUserList(userId, dishId) {
  return saveDishReferenceToUser(userId, dishId);
}

// Get dishes saved by user
export async function getSavedDishesFromFirestore(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];

  const savedDishIds = userSnap.data().savedDishes || [];
  const results = [];
  const missing = [];

  for (const id of savedDishIds) {
    const dishSnap = await getDoc(doc(db, "dishes", id));
    if (dishSnap.exists()) {
      results.push({ id: dishSnap.id, ...dishSnap.data() });
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    await updateDoc(userRef, {
      savedDishes: arrayRemove(...missing),
    });
  }

  return results;
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
  });
  swipedSnapshot.docs.forEach((userDoc) => {
    batch.update(userDoc.ref, { swipedDishes: arrayRemove(dishId) });
  });
  await batch.commit();
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
