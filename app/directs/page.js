"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { MessageCircle, SendHorizonal } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import BottomNav from "../../components/BottomNav";
import { ListLoading } from "../../components/AppLoadingState";
import AuthPromptModal from "../../components/AuthPromptModal";
import AppBackButton from "../../components/AppBackButton";
import { useLanguage } from "../../components/LanguageProvider";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const formatConversationTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};

export default function Directs() {
  const { user } = useAuth();
  const { darkMode, t } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const { unreadConversationIds } = useUnreadDirects(user?.uid);
  const isInitialLoading = !!user?.uid && conversations.length === 0 && Object.keys(usersMap).length === 0;

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
      return {
        ...c,
        otherId,
        otherUser,
        preview:
          c.lastMessage?.type === "dish"
            ? t("Shared a dish")
            : c.lastMessage?.text || t("Start the conversation."),
        updatedLabel: formatConversationTime(c.updatedAt || c.lastMessage?.createdAt),
      };
    });
  }, [conversations, usersMap, user?.uid, t]);

  if (!user) {
    return (
      <div className={`min-h-screen bg-transparent flex items-center justify-center ${darkMode ? "text-white" : "text-black"}`}>
        <button
          onClick={() => setShowAuthPrompt(true)}
          className={`${darkMode ? "bg-white text-black" : "bg-black text-white"} px-6 py-3 rounded-full font-semibold`}
        >
          {t("Sign in to view directs")}
        </button>
        <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      </div>
    );
  }

  return (
    <div className={`bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 relative ${darkMode ? "text-white" : "text-black"}`}>
      <div className="app-top-nav -mx-4 mb-3 flex items-center justify-between gap-3 px-4 pb-2">
        <AppBackButton fallback="/" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <h1 className="truncate text-[1.55rem] font-black leading-none">{t("Directs")}</h1>
        </div>
        <div className="w-[44px]" />
      </div>
      <main className="mx-auto w-full max-w-3xl pb-4">
        {isInitialLoading ? (
          <ListLoading />
        ) : displayConvos.length === 0 ? (
          <div className={`flex min-h-[13rem] flex-col items-center justify-center rounded-[1.6rem] border px-6 text-center shadow-[0_16px_38px_rgba(0,0,0,0.08)] ${
            darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white"
          }`}>
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              darkMode ? "bg-white/10 text-white/70" : "bg-black/6 text-black/55"
            }`}>
              <MessageCircle size={24} />
            </div>
            <div className={`text-lg font-bold ${darkMode ? "text-white" : "text-black"}`}>{t("No conversations yet.")}</div>
            <div className={`mt-1 max-w-[15rem] text-sm leading-5 ${darkMode ? "text-white/55" : "text-black/55"}`}>{t("Start the conversation.")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {displayConvos.map((c) => {
              const unread = unreadConversationIds.includes(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/directs/${c.id}`}
                  className={`group flex items-center gap-3 rounded-[1.35rem] border p-3.5 transition active:scale-[0.99] ${
                    darkMode
                      ? unread
                        ? "border-[#E64646]/35 bg-[linear-gradient(145deg,rgba(230,70,70,0.16),rgba(255,255,255,0.06))] shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
                        : "border-white/10 bg-white/6 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                      : unread
                        ? "border-[#E64646]/25 bg-[linear-gradient(145deg,#FFF8F4_0%,#FFFFFF_100%)] shadow-[0_14px_30px_rgba(0,0,0,0.08)]"
                        : "border-black/8 bg-white shadow-[0_12px_26px_rgba(0,0,0,0.07)]"
                  }`}
                >
                  <div className={`relative flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-lg font-black ${
                    darkMode ? "bg-white/10 text-white/72" : "bg-black/7 text-black/62"
                  }`}>
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                      {c.otherUser?.photoURL ? (
                        <img
                          src={c.otherUser.photoURL}
                          alt={c.otherUser?.displayName || "Profile"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        c.otherUser?.displayName?.[0] || "U"
                      )}
                    </div>
                    {unread ? <span className={`no-accent-border absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 ${darkMode ? "border-[#151515]" : "border-white"} bg-[#E64646]`} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <div className={`truncate text-[1.02rem] font-bold leading-tight ${darkMode ? "text-white" : "text-black"}`}>{c.otherUser?.displayName || "User"}</div>
                      {c.updatedLabel ? (
                        <div className={`ml-auto shrink-0 text-[11px] font-semibold ${darkMode ? "text-white/40" : "text-black/38"}`}>{c.updatedLabel}</div>
                      ) : null}
                    </div>
                    <div className={`mt-1 flex min-w-0 items-center gap-1.5 text-sm ${unread ? "font-semibold" : "font-medium"} ${darkMode ? "text-white/58" : "text-black/55"}`}>
                      {c.lastMessage?.type === "dish" ? <SendHorizonal size={13} className="shrink-0" /> : null}
                      <span className="truncate">{c.preview}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
