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
  signInWithCustomToken,
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

const shouldUseRedirectForWebApple = () => {
  if (typeof navigator === "undefined") return true;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

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

  const getNativeAppleIdentity = async () => {
    const nativeAppleSignIn =
      Capacitor.Plugins?.SignInWithApple || window?.Capacitor?.Plugins?.SignInWithApple;
    if (!nativeAppleSignIn?.authorize) {
      throw new Error("Native Sign in with Apple is not available in this build.");
    }

    const hashedNonce = await sha256(randomNonce());
    const result = await nativeAppleSignIn.authorize({
      scopes: "email name",
      state: randomNonce(16),
      nonce: hashedNonce,
    });

    const { identityToken, givenName, familyName, email } = result?.response || {};
    if (!identityToken) throw new Error("Apple did not return an identity token.");

    const displayName = [givenName, familyName].filter(Boolean).join(" ").trim();
    return { identityToken, displayName, email, nonce: hashedNonce };
  };

  const signInWithApple = async () => {
    if (isNativeIOS()) {
      const appleIdentity = await getNativeAppleIdentity();
      const response = await fetch("/api/auth/apple-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appleIdentity),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.customToken) {
        throw new Error(data.error || "Apple sign in failed.");
      }
      const result = await signInWithCustomToken(auth, data.customToken);
      if (data.displayName && !result.user.displayName) {
        await firebaseUpdateProfile(result.user, { displayName: data.displayName });
      }
      await saveUserDoc({
        ...result.user,
        displayName: data.displayName || result.user.displayName,
        email: data.email || result.user.email,
      });
      return;
    }

    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");

    if (shouldUseRedirectForWebApple()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      await saveUserDoc(result.user);
    } catch (error) {
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
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
      if (!isNativeIOS()) {
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
