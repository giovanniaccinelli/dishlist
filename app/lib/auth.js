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
const APPLE_WEB_CLIENT_ID = "com.giovanniaccinelli.dishlist.web";
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

const openAppleWebPopup = () => {
  const redirectUri = `${window.location.origin}/api/auth/apple-web/callback`;
  const params = new URLSearchParams({
    client_id: APPLE_WEB_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state: randomNonce(16),
  });
  const width = 460;
  const height = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    `https://appleid.apple.com/auth/authorize?${params.toString()}`,
    "dishlistAppleSignIn",
    `width=${width},height=${height},left=${left},top=${top}`
  );
  if (!popup) throw new Error("Apple sign-in popup was blocked.");

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apple sign in timed out."));
    }, 120000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      interval && window.clearInterval(interval);
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "dishlist-apple-auth") return;
      cleanup();
      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error || "Apple sign in failed."));
    };

    const interval = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Apple sign in was cancelled."));
      }
    }, 500);

    window.addEventListener("message", handleMessage);
  });
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveUserDoc = async (userData) => {
    if (!userData) return;
    const userRef = doc(db, "users", userData.uid);
    const existing = await getDoc(userRef);
    const cleanedDisplayName = String(userData.displayName || "Unnamed").trim() || "Unnamed";
    if (!existing.exists()) {
      await setDoc(
        userRef,
        {
          displayName: cleanedDisplayName,
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
        displayName: cleanedDisplayName,
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

    if (shouldUseRedirectForWebApple()) {
      const redirectUri = `${window.location.origin}/api/auth/apple-web/callback`;
      const params = new URLSearchParams({
        client_id: APPLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code id_token",
        response_mode: "form_post",
        scope: "name email",
        state: randomNonce(16),
      });
      window.location.assign(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
      return;
    }

    const data = await openAppleWebPopup();
    const result = await signInWithCustomToken(auth, data.customToken);
    if (data.displayName && !result.user.displayName) {
      await firebaseUpdateProfile(result.user, { displayName: data.displayName });
    }
    await saveUserDoc({
      ...result.user,
      displayName: data.displayName || result.user.displayName,
      email: data.email || result.user.email,
    });
  };

  const signInWithEmail = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required");
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUserDoc(result.user);
  };

  const signUpWithEmail = async (email, password, displayName = "") => {
    if (!email || !password) throw new Error("Email and password are required");
    const cleanedName = displayName.trim();
    const result = await createUserWithEmailAndPassword(auth, email, password);
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
