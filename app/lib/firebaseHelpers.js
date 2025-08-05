import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Upload image to Storage
export async function uploadImage(file, userId) {
  const storageRef = ref(storage, `dishes/${userId}/${Date.now()}-${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// Save a new dish to Firestore
export async function saveDishToFirestore(dishData) {
  try {
    const docRef = await addDoc(collection(db, "dishes"), dishData);
    return docRef.id;
  } catch (error) {
    console.error("Error saving dish:", error);
    throw error;
  }
}

// Fetch dishes (all or user-specific)
export async function getDishesFromFirestore(userId = null) {
  try {
    let q;
    if (userId) {
      q = query(
        collection(db, "dishes"),
        where("owner", "==", userId),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "dishes"),
        orderBy("createdAt", "desc")
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching dishes:", error);
    return [];
  }
}
