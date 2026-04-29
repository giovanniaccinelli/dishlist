"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";

const readMarksKey = (userId) => `directs:readMarks:${userId}`;

const readTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

export function useUnreadDirects(userId) {
  const [conversations, setConversations] = useState([]);
  const [readMarks, setReadMarks] = useState({});

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      return undefined;
    }
    const conversationsQuery = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(conversationsQuery, (snap) => {
      const items = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((conversation) => Array.isArray(conversation.participants) && conversation.participants.includes(userId));
      setConversations(items);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setReadMarks({});
      return;
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(readMarksKey(userId)) || "{}");
      setReadMarks(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setReadMarks({});
    }

    const syncMarks = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(readMarksKey(userId)) || "{}");
        setReadMarks(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setReadMarks({});
      }
    };

    window.addEventListener("storage", syncMarks);
    window.addEventListener("focus", syncMarks);
    return () => {
      window.removeEventListener("storage", syncMarks);
      window.removeEventListener("focus", syncMarks);
    };
  }, [userId]);

  return useMemo(() => {
    const unreadConversationIds = conversations
      .filter((conversation) => {
        const lastSenderId = conversation?.lastMessage?.senderId;
        const unreadBy = Array.isArray(conversation.unreadBy) ? conversation.unreadBy : [];
        if (unreadBy.includes(userId)) return true;
        if (!lastSenderId || lastSenderId === userId) return false;
        const updatedAtMs = readTimestamp(conversation?.updatedAt || conversation?.lastMessage?.createdAt);
        const localReadAt = Number(readMarks?.[conversation.id] || 0);
        return localReadAt === 0 || updatedAtMs >= localReadAt;
      })
      .map((conversation) => conversation.id);
    return {
      hasUnread: unreadConversationIds.length > 0,
      unreadConversationIds,
      conversations,
    };
  }, [conversations, userId, readMarks]);
}
