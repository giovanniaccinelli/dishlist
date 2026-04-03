"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";

export function useUnreadDirects(userId) {
  const [conversations, setConversations] = useState([]);

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

  return useMemo(() => {
    const unreadConversationIds = conversations
      .filter((conversation) => {
        const lastSenderId = conversation?.lastMessage?.senderId;
        if (!lastSenderId || lastSenderId === userId) return false;
        const unreadBy = Array.isArray(conversation.unreadBy) ? conversation.unreadBy : [];
        const readBy = Array.isArray(conversation.readBy) ? conversation.readBy : [];
        if (unreadBy.includes(userId)) return true;
        return !readBy.includes(userId);
      })
      .map((conversation) => conversation.id);
    return {
      hasUnread: unreadConversationIds.length > 0,
      unreadConversationIds,
      conversations,
    };
  }, [conversations, userId]);
}
