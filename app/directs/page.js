"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import BottomNav from "../../components/BottomNav";
import AuthPromptModal from "../../components/AuthPromptModal";
import AppBackButton from "../../components/AppBackButton";

export default function Directs() {
  const { user } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const { unreadConversationIds } = useUnreadDirects(user?.uid);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => Array.isArray(c.participants) && c.participants.includes(user.uid));
      setConversations(items);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const otherIds = Array.from(
      new Set(
        conversations
          .flatMap((c) => c.participants || [])
          .filter((id) => id && id !== user.uid)
      )
    );
    if (otherIds.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        otherIds.map(async (id) => {
          const snap = await getDoc(doc(db, "users", id));
          return [id, snap.exists() ? snap.data() : null];
        })
      );
      setUsersMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [conversations, user?.uid]);

  const displayConvos = useMemo(() => {
    return conversations.map((c) => {
      const otherId = (c.participants || []).find((p) => p !== user?.uid);
      const otherUser = usersMap[otherId] || {};
      return { ...c, otherId, otherUser };
    });
  }, [conversations, usersMap, user?.uid]);

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        <button
          onClick={() => setShowAuthPrompt(true)}
          className="bg-black text-white px-6 py-3 rounded-full font-semibold"
        >
          Sign in to view directs
        </button>
        <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative pb-[72px]">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <AppBackButton fallback="/" />
        <h1 className="text-2xl font-bold">Directs</h1>
      </div>
      {displayConvos.length === 0 ? (
        <div className="bg-[#f0f0ea] rounded-xl h-32 flex items-center justify-center text-gray-500">
          No conversations yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {displayConvos.map((c) => (
            <Link
              key={c.id}
              href={`/directs/${c.id}`}
              className="bg-white rounded-2xl p-4 shadow-md border border-black/5 flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-black/10 flex items-center justify-center text-lg font-bold">
                {c.otherUser?.photoURL ? (
                  <img
                    src={c.otherUser.photoURL}
                    alt="Profile"
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  c.otherUser?.displayName?.[0] || "U"
                )}
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{c.otherUser?.displayName || "User"}</div>
                <div className="text-xs text-black/60 truncate">
                  {c.lastMessage?.type === "dish" ? "Shared a dish" : c.lastMessage?.text || ""}
                </div>
              </div>
              {unreadConversationIds.includes(c.id) ? (
                <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-[#E64646]" />
              ) : null}
            </Link>
          ))}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
