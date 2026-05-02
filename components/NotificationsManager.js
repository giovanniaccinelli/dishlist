"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { collection, collectionGroup, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { useAuth } from "../app/lib/auth";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";

const ASKED_KEY = "notifications:asked";
const ENABLED_KEY = "notifications:enabled";

async function showAppNotification(title, options = {}) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
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
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const followedIdsRef = useRef([]);
  const initialDishesLoadedRef = useRef(false);
  const initialStoriesLoadedRef = useRef(false);
  const initialConversationsLoadedRef = useRef(false);
  const notifiedKeysRef = useRef(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(localStorage.getItem(ENABLED_KEY) === "1" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.uid) {
      setShowPrompt(false);
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
  }, [user?.uid]);

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
    if (!user?.uid || !enabled) return;
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
    if (!user?.uid || !enabled) return;
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
    if (!user?.uid || !enabled) return;
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

  const permissionLabel = useMemo(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "";
    return Notification.permission;
  }, [showPrompt]);

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    localStorage.setItem(ASKED_KEY, "1");
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
          <div className="w-full max-w-md rounded-[1.6rem] border border-black/10 bg-white px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.16)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">
              Notifications
            </div>
            <div className="mt-2 text-lg font-semibold text-black">
              Stay on top of dishes, stories, and directs
            </div>
            <div className="mt-2 text-sm leading-6 text-black/58">
              We’ll let you know when people you follow post, or when somebody messages you.
            </div>
            {permissionLabel && permissionLabel !== "default" ? (
              <div className="mt-2 text-xs text-black/42">Current permission: {permissionLabel}</div>
            ) : null}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={requestNotifications}
                className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(ASKED_KEY, "1");
                  setShowPrompt(false);
                }}
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black/65"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
