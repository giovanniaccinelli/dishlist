"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
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
const APPLE_SERVICE_ID = "com.giovanniaccinelli.dishlist.web";
const APPLE_REDIRECT_URI = "https://dishlist-7f0ae.firebaseapp.com/__/auth/handler";

const randomNonce = (length = 32) => {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => charset[value % charset.length]).join("");
};

const sha256 = async (input) => {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

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
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) await saveUserDoc(result.user);
      })
      .catch((err) => {
        console.error("Redirect sign-in failed:", err);
      });

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

  const getNativeAppleCredential = async () => {
    const nativeAppleSignIn =
      Capacitor.Plugins?.SignInWithApple || window?.Capacitor?.Plugins?.SignInWithApple;
    if (!nativeAppleSignIn?.authorize) {
      throw new Error("Native Sign in with Apple is not available in this build.");
    }

    const rawNonce = randomNonce();
    const hashedNonce = await sha256(rawNonce);
    const result = await nativeAppleSignIn.authorize({
      clientId: APPLE_SERVICE_ID,
      redirectURI: APPLE_REDIRECT_URI,
      scopes: "email name",
      state: randomNonce(16),
      nonce: hashedNonce,
    });

    const { identityToken, givenName, familyName } = result?.response || {};
    if (!identityToken) throw new Error("Apple did not return an identity token.");

    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce,
    });
    const displayName = [givenName, familyName].filter(Boolean).join(" ").trim();
    return { credential, displayName };
  };

  const signInWithApple = async () => {
    if (isNativeIOS()) {
      const { credential, displayName } = await getNativeAppleCredential();
      const result = await signInWithCredential(auth, credential);
      if (displayName && !result.user.displayName) {
        await firebaseUpdateProfile(result.user, { displayName });
      }
      await saveUserDoc({ ...result.user, displayName: displayName || result.user.displayName });
      return;
    }

    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithRedirect(auth, provider);
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
      if (isNativeIOS()) {
        const { credential } = await getNativeAppleCredential();
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        const provider = new OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");
        await reauthenticateWithPopup(currentUser, provider);
      }
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
