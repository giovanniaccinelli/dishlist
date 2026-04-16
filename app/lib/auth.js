"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile as firebaseUpdateProfile,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { deleteUserAccountData } from "./firebaseHelpers";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveUserDoc = async (userData) => {
    if (!userData) return;
    const userRef = doc(db, "users", userData.uid);
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(
        userRef,
        {
          displayName: userData.displayName || "Unnamed",
          photoURL: userData.photoURL || "",
          email: userData.email,
          followers: [],
          following: [],
          savedDishes: [],
          swipedDishes: [],
        },
        { merge: true }
      );
      return;
    }
    await setDoc(
      userRef,
      {
        displayName: userData.displayName || "Unnamed",
        photoURL: userData.photoURL || "",
        email: userData.email,
      },
      { merge: true }
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        await saveUserDoc(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await saveUserDoc(result.user);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const result = await signInWithPopup(auth, provider);
    await saveUserDoc(result.user);
  };

  const signInWithEmail = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required");
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUserDoc(result.user);
  };

  const signUpWithEmail = async (email, password, displayName = "") => {
    if (!email || !password) throw new Error("Email and password are required");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const cleanedName = displayName.trim();
    if (cleanedName) {
      await firebaseUpdateProfile(result.user, { displayName: cleanedName });
    }
    await saveUserDoc({ ...result.user, displayName: cleanedName || result.user.displayName });
  };

  const updateProfile = async (newName) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    await firebaseUpdateProfile(auth.currentUser, { displayName: newName });
    await saveUserDoc({
      ...auth.currentUser,
      displayName: newName,
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const deleteAccount = async ({ password = "" } = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user logged in");

    const providerIds = currentUser.providerData.map((provider) => provider.providerId);
    if (providerIds.includes("password")) {
      if (!password) throw new Error("Password is required to delete this account.");
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    } else if (providerIds.includes("apple.com")) {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      await reauthenticateWithPopup(currentUser, provider);
    } else if (providerIds.includes("google.com")) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
    }

    await deleteUserAccountData(currentUser.uid);
    await deleteUser(currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        updateProfile,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
