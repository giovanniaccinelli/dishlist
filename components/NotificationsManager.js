"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { collection, collectionGroup, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { useAuth } from "../app/lib/auth";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";
import { useLanguage } from "./LanguageProvider";
import {
  addNativePushListeners,
  disableNativePushToken,
  getNativePushPermissionState,
  getLastNativePushToken,
  isNativePushSupported,
  registerForNativePush,
  requestNativePushPermission,
  saveNativePushToken,
} from "../app/lib/pushClient";

const ASKED_KEY = "notifications:asked";
const ENABLED_KEY = "notifications:enabled";

function clearAppBadge() {
  if (typeof navigator === "undefined") return;
  try {
    if (typeof navigator.clearAppBadge === "function") {
      navigator.clearAppBadge();
      return;
    }
    if (typeof navigator.setAppBadge === "function") {
      navigator.setAppBadge(0);
    }
  } catch (error) {
    console.warn("Failed to clear app badge:", error);
  }
}

async function showAppNotification(title, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        ...options,
      });
      return;
    }
  } catch (error) {
    console.warn("Service worker notification failed:", error);
  }
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      const target = options?.data?.url;
      if (target) window.location.href = target;
      window.focus?.();
      notification.close();
    };
  } catch (error) {
    console.warn("Notification display failed:", error);
  }
}

export default function NotificationsManager() {
  const { user } = useAuth();
  const { darkMode, t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [nativePermission, setNativePermission] = useState("unsupported");
  const followedIdsRef = useRef([]);
  const initialDishesLoadedRef = useRef(false);
  const initialStoriesLoadedRef = useRef(false);
  const initialConversationsLoadedRef = useRef(false);
  const notifiedKeysRef = useRef(new Set());
  const nativePushTokenRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    clearAppBadge();
    if (isNativePushSupported()) {
      setEnabled(localStorage.getItem(ENABLED_KEY) === "1");
      getNativePushPermissionState().then(setNativePermission).catch(() => setNativePermission("unsupported"));
      return;
    }
    setEnabled(localStorage.getItem(ENABLED_KEY) === "1" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.uid) {
      setShowPrompt(false);
      return;
    }
    if (isNativePushSupported()) {
      const asked = localStorage.getItem(ASKED_KEY) === "1";
      if (nativePermission === "granted") {
        localStorage.setItem(ENABLED_KEY, "1");
        setEnabled(true);
        return;
      }
      if (!asked && (nativePermission === "prompt" || nativePermission === "unsupported")) {
        setShowPrompt(true);
      }
      return;
    }
    if (!("Notification" in window)) return;
    const asked = localStorage.getItem(ASKED_KEY) === "1";
    const granted = Notification.permission === "granted";
    if (granted) {
      localStorage.setItem(ENABLED_KEY, "1");
      setEnabled(true);
      return;
    }
    if (!asked && Notification.permission === "default") {
      setShowPrompt(true);
    }
  }, [nativePermission, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !isNativePushSupported()) return;
    let removeListeners = () => {};
    let cancelled = false;

    (async () => {
      removeListeners = await addNativePushListeners({
        onRegistration: async (event) => {
          const token = String(event?.token || event?.value || "").trim();
          if (!token || cancelled) return;
          nativePushTokenRef.current = token;
          await saveNativePushToken(user.uid, token);
          localStorage.setItem(ENABLED_KEY, "1");
          setEnabled(true);
        },
        onRegistrationError: (event) => {
          console.warn("Native push registration failed:", event);
        },
        onNotificationActionPerformed: (event) => {
          const target =
            event?.notification?.data?.url ||
            event?.notification?.url ||
            event?.data?.url ||
            "/";
          window.location.href = target;
        },
      });

      const shouldRegister =
        localStorage.getItem(ENABLED_KEY) === "1" ||
        enabled ||
        nativePermission === "granted";
      if (shouldRegister) {
        await registerForNativePush().catch((error) => {
          console.warn("Native push register failed:", error);
        });
        const cachedToken = await getLastNativePushToken().catch(() => "");
        if (cachedToken && !cancelled) {
          nativePushTokenRef.current = cachedToken;
          await saveNativePushToken(user.uid, cachedToken);
          localStorage.setItem(ENABLED_KEY, "1");
          setEnabled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, [enabled, nativePermission, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !enabled) return;
    let cancelled = false;
    (async () => {
      const ids = await getFollowingForUser(user.uid);
      if (!cancelled) {
        followedIdsRef.current = Array.isArray(ids) ? ids : [];
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !enabled || isNativePushSupported()) return;
    const dishesQuery = query(collection(db, "dishes"), orderBy("createdAt", "desc"));
    return onSnapshot(dishesQuery, (snap) => {
      const followed = new Set(followedIdsRef.current);
      snap.docChanges().forEach((change) => {
        const data = change.doc.data() || {};
        const owner = String(data.owner || "").trim();
        if (!followed.has(owner) || owner === user.uid || data.isPublic === false) return;
        const key = `dish:${change.doc.id}`;
        if (!initialDishesLoadedRef.current || notifiedKeysRef.current.has(key)) return;
        notifiedKeysRef.current.add(key);
        if (change.type === "added") {
          showAppNotification(`${data.ownerName || "Someone"} posted a dish`, {
            body: data.name || "Open DishList to see it",
            data: { url: `/dish/${change.doc.id}?source=public&mode=single` },
          });
        }
      });
      initialDishesLoadedRef.current = true;
    });
  }, [enabled, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !enabled || isNativePushSupported()) return;
    const storiesQuery = query(collectionGroup(db, "stories"), orderBy("createdAt", "desc"));
    return onSnapshot(storiesQuery, (snap) => {
      const followed = new Set(followedIdsRef.current);
      snap.docChanges().forEach((change) => {
        const data = change.doc.data() || {};
        const owner = String(data.owner || "").trim();
        if (!followed.has(owner) || owner === user.uid) return;
        const key = `story:${change.doc.id}:${owner}`;
        if (!initialStoriesLoadedRef.current || notifiedKeysRef.current.has(key)) return;
        notifiedKeysRef.current.add(key);
        if (change.type === "added") {
          showAppNotification(`${data.ownerName || "Someone"} added a story`, {
            body: data.name || "See what they posted",
            data: { url: `/profile/${encodeURIComponent(owner)}` },
          });
        }
      });
      initialStoriesLoadedRef.current = true;
    });
  }, [enabled, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !enabled || isNativePushSupported()) return;
    const conversationsQuery = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    return onSnapshot(conversationsQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        const data = change.doc.data() || {};
        if (!Array.isArray(data.participants) || !data.participants.includes(user.uid)) return;

        const lastMessage = data.lastMessage || {};
        const senderId = String(lastMessage.senderId || "").trim();
        if (!senderId || senderId === user.uid) return;
        const unreadBy = Array.isArray(data.unreadBy) ? data.unreadBy : [];
        if (!unreadBy.includes(user.uid)) return;
        const key = `direct:${change.doc.id}:${lastMessage.id || lastMessage.createdAt?.seconds || ""}`;
        if (!initialConversationsLoadedRef.current || notifiedKeysRef.current.has(key)) return;
        notifiedKeysRef.current.add(key);
        showAppNotification(lastMessage.senderName || "New message", {
          body: lastMessage.text || "Sent you a message on DishList",
          data: { url: `/directs/${change.doc.id}` },
        });
      });
      initialConversationsLoadedRef.current = true;
    });
  }, [enabled, user?.uid]);

  const requestNotifications = async () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ASKED_KEY, "1");
    if (isNativePushSupported()) {
      const result = await requestNativePushPermission();
      setNativePermission(result);
      if (result === "granted") {
        await registerForNativePush().catch((error) => {
          console.warn("Native push register failed:", error);
        });
        localStorage.setItem(ENABLED_KEY, "1");
        setEnabled(true);
      } else if (nativePushTokenRef.current) {
        await disableNativePushToken(user?.uid, nativePushTokenRef.current).catch(() => {});
      }
      setShowPrompt(false);
      return;
    }
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    if (result === "granted") {
      localStorage.setItem(ENABLED_KEY, "1");
      setEnabled(true);
    }
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt ? (
        <motion.div
          className="fixed inset-x-0 bottom-[calc(var(--app-bottom-nav-height)+0.75rem)] z-[140] flex justify-center px-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
        >
          <div className={`w-full max-w-sm rounded-[1.45rem] border px-4 py-4 shadow-[0_22px_54px_rgba(0,0,0,0.28)] ${
            darkMode ? "border-white/10 bg-[#101411] text-white" : "border-black/10 bg-white text-black"
          }`}>
            <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${darkMode ? "text-[#74E292]" : "text-[#15803D]"}`}>
              {t("Notifications")}
            </div>
            <div className="mt-2 text-[1.2rem] font-black leading-tight">
              {t("Turn on notifications")}
            </div>
            <div className={`mt-2 text-sm leading-5 ${darkMode ? "text-white/62" : "text-black/58"}`}>
              {t("Directs, comments, and new dishes when they matter.")}
            </div>
            <div className={`mt-2 text-xs font-semibold leading-5 ${darkMode ? "text-white/38" : "text-black/38"}`}>
              {t("If you have not already, update the app first.")}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={requestNotifications}
                className="rounded-full bg-[#2BD36B] px-4 py-2.5 text-sm font-black text-black shadow-[0_10px_24px_rgba(43,211,107,0.22)] active:scale-[0.98]"
              >
                {t("Turn on")}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(ASKED_KEY, "1");
                  setShowPrompt(false);
                }}
                className={`rounded-full border px-4 py-2.5 text-sm font-bold active:scale-[0.98] ${
                  darkMode ? "border-white/10 bg-white/6 text-white/62" : "border-black/10 bg-white text-black/55"
                }`}
              >
                {t("Not now")}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
