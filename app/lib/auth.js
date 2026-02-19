"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile as firebaseUpdateProfile,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { setDoc, doc, getDoc } from "firebase/firestore";

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

  const signInWithEmail = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required");
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUserDoc(result.user);
  };

  const signUpWithEmail = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserDoc(result.user);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
