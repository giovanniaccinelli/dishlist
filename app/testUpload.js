import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyBAos19VBROVcYRMu6I7Wg4tW2LnJbstnw",
  authDomain: "dishlist-7f0ae.firebaseapp.com",
  projectId: "dishlist-7f0ae",
  storageBucket: "dishlist-7f0ae.appspot.com",
  messagingSenderId: "938623496427",
  appId: "1:938623496427:web:bdddc75b0a747ab4e50eae"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

const fileBuffer = fs.readFileSync("./test.jpg"); // <-- put a small image in project root
const fileRef = ref(storage, `test/test_${Date.now()}.jpg`);

uploadBytes(fileRef, fileBuffer)
  .then(() => console.log("Upload successful"))
  .catch((err) => console.error("Upload failed:", err));
