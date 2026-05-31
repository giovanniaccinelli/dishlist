"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import AuthPromptModal from "../../../components/AuthPromptModal";
import AppBackButton from "../../../components/AppBackButton";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../../lib/dishImage";
import { deleteMessageForSender, getAllDishlistsForUser, markConversationAsRead, sendMessage } from "../../lib/firebaseHelpers";
import { ArrowLeft, Check, CheckCheck, Plus, Search, SendHorizonal, Trash2, Users, X } from "lucide-react";
import { useLanguage } from "../../../components/LanguageProvider";

const readMarksKey = (userId) => `directs:readMarks:${userId}`;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const formatMessageDay = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatMessageTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const isSameDay = (left, right) => {
  const leftDate = toDate(left);
  const rightDate = toDate(right);
  if (!leftDate || !rightDate) return false;
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const getLastActiveMs = (user) => {
  const date = toDate(user?.lastActiveAt);
  return date?.getTime?.() || 0;
};

const isUserOnline = (user) => {
  const lastActiveMs = getLastActiveMs(user);
  return lastActiveMs > 0 && Date.now() - lastActiveMs < 2 * 60 * 1000;
};

const formatActiveStatus = (user, t) => {
  const lastActiveMs = getLastActiveMs(user);
  if (!lastActiveMs) return "";
  if (Date.now() - lastActiveMs < 2 * 60 * 1000) return t("Online");
  const diffMinutes = Math.max(1, Math.round((Date.now() - lastActiveMs) / 60000));
  if (diffMinutes < 60) return `${t("Active")} ${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${t("Active")} ${diffHours}h`;
  return t("Active recently");
};

export default function DirectChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { darkMode, t } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [input, setInput] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserId, setOtherUserId] = useState("");
  const [dishMap, setDishMap] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDish, setConfirmDish] = useState(null);
  const [pickerDishlists, setPickerDishlists] = useState([]);
  const [pickerDishlistId, setPickerDishlistId] = useState("saved");
  const [pickerSearch, setPickerSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dragOffsets, setDragOffsets] = useState({});
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isRestaurantDish = (dish) => String(dish?.dishMode || "").trim().toLowerCase() === "restaurant";
  const otherOnline = isUserOnline(otherUser);
  const otherActiveLabel = formatActiveStatus(otherUser, t);
  const latestOwnMessageId = [...messages].reverse().find((message) => message?.senderId === user?.uid)?.id || "";
  const messageReadByOther = (message) =>
    message?.senderId === user?.uid &&
    otherUser?.id &&
    Array.isArray(conversation?.readBy) &&
    conversation.readBy.includes(otherUser.id);

  const DeliveryTicks = ({ message }) => {
    if (message?.senderId !== user?.uid) return null;
    if (message?.id !== latestOwnMessageId) return null;
    const read = messageReadByOther(message);
    const Icon = read ? CheckCheck : Check;
    return (
      <span className={`inline-flex items-center align-[-2px] ${read ? "text-[#5FA8F2]" : "text-current opacity-55"}`} aria-label={read ? t("Read") : t("Sent")}>
        <Icon size={12} strokeWidth={2.35} />
      </span>
    );
  };

  useEffect(() => {
    if (!user?.uid || !id) return;
    const convoRef = doc(db, "conversations", id);
    const unsubConvo = onSnapshot(convoRef, (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() };
      setConversation(data);
      const otherId = (data.participants || []).find((p) => p !== user.uid);
      setOtherUserId(otherId || "");
    });
    const msgsRef = collection(db, "conversations", id, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsubMsgs = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      markConversationAsRead(id, user.uid);
      if (typeof window !== "undefined") {
        try {
          const current = JSON.parse(localStorage.getItem(readMarksKey(user.uid)) || "{}");
          const next = { ...(current && typeof current === "object" ? current : {}), [id]: Date.now() };
          localStorage.setItem(readMarksKey(user.uid), JSON.stringify(next));
        } catch {}
      }
    });
    return () => {
      unsubConvo();
      unsubMsgs();
    };
  }, [id, user?.uid]);

  useEffect(() => {
    if (!otherUserId) {
      setOtherUser(null);
      return undefined;
    }
    return onSnapshot(doc(db, "users", otherUserId), (snap) => {
      setOtherUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [otherUserId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length) return;
    const dishIds = Array.from(
      new Set(messages.filter((m) => m.type === "dish" && m.dishId).map((m) => m.dishId))
    );
    dishIds.forEach(async (dishId) => {
      if (dishMap[dishId]) return;
      const snap = await getDoc(doc(db, "dishes", dishId));
      if (snap.exists()) {
        setDishMap((prev) => ({ ...prev, [dishId]: { id: snap.id, ...snap.data() } }));
      }
    });
  }, [messages, dishMap]);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const allDishlists = await getAllDishlistsForUser(user.uid);
      setPickerDishlists(allDishlists);
      setPickerDishlistId(allDishlists[0]?.id || "saved");
    })();
  }, [user?.uid]);

  const activePickerDishlist =
    pickerDishlists.find((dishlist) => dishlist.id === pickerDishlistId) || pickerDishlists[0] || null;
  const pickerSearchTerm = pickerSearch.trim().toLowerCase();
  const pickerSearchPool =
    pickerDishlists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
  const visiblePickerDishes = pickerSearchTerm
    ? pickerSearchPool.filter((dish) => (dish?.name || "").toLowerCase().includes(pickerSearchTerm))
    : activePickerDishlist?.dishes || [];

  const sendText = async () => {
    const text = input.trim();
    if (!text || !user?.uid) return;
    setInput("");
    const ok = await sendMessage(id, {
      senderId: user.uid,
      type: "text",
      text,
    });
    if (ok === false) setInput(text);
  };

  const sendDish = async () => {
    if (!confirmDish?.id || !user?.uid) return;
    const ok = await sendMessage(id, {
      senderId: user.uid,
      type: "dish",
      dishId: confirmDish.id,
      text: "",
    });
    if (!ok) return;
    setConfirmDish(null);
    setPickerOpen(false);
    setPickerSearch("");
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (message) => {
    if (!message || message.senderId !== user?.uid) return;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setDeleteTarget(message);
    }, 450);
  };

  const handleDeleteMessage = async () => {
    if (!deleteTarget?.id || !user?.uid) return;
    const ok = await deleteMessageForSender(id, deleteTarget.id, user.uid);
    if (ok) setDeleteTarget(null);
  };

  if (!user) {
    return (
      <div className={`min-h-screen bg-transparent flex items-center justify-center ${darkMode ? "text-white" : "text-black"}`}>
        <button
          onClick={() => setShowAuthPrompt(true)}
          className={`${darkMode ? "bg-white text-black" : "bg-black text-white"} px-6 py-3 rounded-full font-semibold`}
        >
          {t("Sign in to message")}
        </button>
        <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      </div>
    );
  }

  return (
    <div className={`bottom-nav-spacer h-[100dvh] overflow-hidden overscroll-none bg-transparent relative flex flex-col ${darkMode ? "text-white" : "text-black"}`}>
      <div className="app-top-nav flex shrink-0 items-center justify-between px-4 pb-2">
        <AppBackButton fallback="/directs" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-black ${
            darkMode ? "bg-white/10 text-white/70" : "bg-black/7 text-black/62"
          }`}>
            {otherUser?.photoURL ? (
              <img src={otherUser.photoURL} alt={otherUser?.displayName || "Profile"} className="h-full w-full object-cover" />
            ) : (
              otherUser?.displayName?.[0] || "U"
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xl font-bold leading-none">{otherUser?.displayName || t("Chat")}</div>
            {otherActiveLabel ? (
              <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold leading-none ${otherOnline ? "text-[#2BD36B]" : darkMode ? "text-white/58" : "text-black/52"}`}>
                {otherOnline ? <span className="h-1.5 w-1.5 rounded-full bg-[#2BD36B]" /> : null}
                <span>{otherActiveLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="w-[44px]" />
      </div>

      <div ref={scrollRef} className="bottom-nav-chat-scroll flex flex-1 min-h-0 flex-col overflow-y-auto px-4">
        <div className="mx-auto mt-auto flex w-full max-w-md flex-col gap-3">
        {messages.map((m, index) => {
          const isMine = m.senderId === user.uid;
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const showDayDivider = !previousMessage || !isSameDay(previousMessage.createdAt, m.createdAt);
          const dayLabel = formatMessageDay(m.createdAt);
          const messageTime = formatMessageTime(m.createdAt);
          const dragOffset = Number(dragOffsets[m.id] || 0);
          const revealedOffset = isMine ? Math.max(0, -dragOffset) : Math.max(0, dragOffset);
          const timeOpacity = Math.min(revealedOffset / 44, 1);
          if (m.type === "dish") {
            const dish = dishMap[m.dishId];
            const imageSrc = getDishImageUrl(dish, "thumb");
            return (
              <div key={m.id}>
                {showDayDivider && dayLabel ? (
                  <div className="flex justify-center py-1">
                    <div className={`no-accent-border rounded-full px-3 py-1 text-[11px] font-medium ${darkMode ? "bg-white/8 text-white/42" : "bg-black/6 text-black/45"}`}>
                      {dayLabel}
                    </div>
                  </div>
                ) : null}
                <div
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  onContextMenu={(e) => {
                    if (!isMine) return;
                    e.preventDefault();
                    setDeleteTarget(m);
                  }}
                  onTouchStart={() => startLongPress(m)}
                  onTouchEnd={clearLongPressTimer}
                  onTouchMove={clearLongPressTimer}
                  onMouseDown={() => startLongPress(m)}
                  onMouseUp={clearLongPressTimer}
                  onMouseLeave={clearLongPressTimer}
                >
                  <div className="relative w-full max-w-[78%]">
                    {messageTime ? (
                      <div
	                        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[11px] ${darkMode ? "text-white/38" : "text-black/42"} ${
                          isMine ? "right-0 text-right" : "left-0 text-left"
                        }`}
                        style={{ opacity: timeOpacity }}
                      >
                        {messageTime}
                      </div>
                    ) : null}
                    <motion.div
                      drag="x"
                      dragConstraints={isMine ? { left: -72, right: 0 } : { left: 0, right: 72 }}
                      dragElastic={0.08}
                      onDrag={(_, info) => {
                        setDragOffsets((prev) => ({ ...prev, [m.id]: info.offset.x }));
                      }}
                      onDragEnd={() => {
                        setDragOffsets((prev) => ({ ...prev, [m.id]: 0 }));
                      }}
                    >
                      <Link
                        href={`/dish/${m.dishId}?source=public&mode=single`}
                        className={`direct-dish-message ${isMine ? "direct-message--mine" : "direct-message--received"} pressable-card relative block w-full overflow-hidden rounded-[1.45rem] border shadow-[0_14px_30px_rgba(0,0,0,0.08)] ${
                          darkMode
                            ? isMine
                              ? "border-[#5FA8F2]/55 bg-[#163B5A] text-white"
                              : "border-white/14 bg-[#202020] text-white"
                            : isMine
                              ? "border-[#C9D7E8] bg-[linear-gradient(180deg,#FDFEFE_0%,#EEF5FB_100%)]"
                              : "border-black/10 bg-white"
                        }`}
                      >
                        <img
                          src={imageSrc}
                          alt={dish?.name || "Dish"}
                          className="w-full h-28 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_DISH_IMAGE;
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 via-55% to-transparent px-3 py-2 text-white pointer-events-none flex h-[56%] flex-col justify-end gap-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight">
                              {dish?.name || "Dish"}
                            </div>
                            <DeliveryTicks message={m} />
                          </div>
                          <div className="inline-flex items-center gap-1 text-[10px] text-white/80">
                            <Users size={10} strokeWidth={2.2} />
                            <span>{Math.max(0, Number(dish?.saves || 0))}</span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id}>
              {showDayDivider && dayLabel ? (
                <div className="flex justify-center py-1">
                  <div className={`rounded-full px-3 py-1 text-[11px] font-medium ${darkMode ? "bg-white/8 text-white/42" : "bg-black/6 text-black/45"}`}>
                    {dayLabel}
                  </div>
                </div>
              ) : null}
              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                onContextMenu={(e) => {
                  if (!isMine) return;
                  e.preventDefault();
                  setDeleteTarget(m);
                }}
                onTouchStart={() => startLongPress(m)}
                onTouchEnd={clearLongPressTimer}
                onTouchMove={clearLongPressTimer}
                onMouseDown={() => startLongPress(m)}
                onMouseUp={clearLongPressTimer}
                onMouseLeave={clearLongPressTimer}
              >
                <div className="relative max-w-[78%]">
                  {messageTime ? (
                    <div
	                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[11px] ${darkMode ? "text-white/38" : "text-black/42"} ${
                        isMine ? "right-0 text-right" : "left-0 text-left"
                      }`}
                      style={{ opacity: timeOpacity }}
                    >
                      {messageTime}
                    </div>
                  ) : null}
                  <motion.div
                    drag="x"
                    dragConstraints={isMine ? { left: -72, right: 0 } : { left: 0, right: 72 }}
                    dragElastic={0.08}
                    onDrag={(_, info) => {
                      setDragOffsets((prev) => ({ ...prev, [m.id]: info.offset.x }));
                    }}
                    onDragEnd={() => {
                      setDragOffsets((prev) => ({ ...prev, [m.id]: 0 }));
                    }}
                    className={`direct-text-message ${isMine ? "direct-message--mine" : "direct-message--received"} w-fit rounded-[1.35rem] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${
                      darkMode
                        ? isMine
                          ? "ml-auto border border-[#5FA8F2]/55 bg-[#1A5E91] text-white"
                          : "border border-white/14 bg-[#202020] text-white/92"
                        : isMine
                          ? "ml-auto bg-[linear-gradient(135deg,#0F3D63_0%,#2B74B8_100%)] text-white"
                          : "border border-[#E7DCC7] bg-[linear-gradient(180deg,#FFFDF7_0%,#F7F0E3_100%)] text-black"
                    }`}
                  >
                    <div className="text-[15px] leading-[1.35] whitespace-pre-wrap break-words">
                      {m.text}
                      {isMine ? <span className="ml-1.5"><DeliveryTicks message={m} /></span> : null}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
        </div>
      </div>

      <div className="bottom-nav-chat-bar fixed left-0 right-0 z-40 px-4">
        <div className={`mx-auto w-full max-w-md rounded-[24px] border p-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.12)] ${
          darkMode
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(28,28,26,0.98)_0%,rgba(13,13,12,0.98)_100%)]"
            : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,241,232,0.98)_100%)]"
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPickerOpen(true);
                setConfirmDish(null);
                setPickerSearch("");
              }}
	              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border shadow-[0_8px_20px_rgba(0,0,0,0.07)] ${
                  darkMode ? "border-white/12 bg-white/8 text-white" : "border-black/10 bg-white text-black"
                }`}
              aria-label="Share a dish"
            >
              <Plus size={22} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
	              placeholder={t("Message...")}
	              className={`h-12 min-w-0 flex-1 rounded-[1.1rem] border px-4 focus:outline-none focus:ring-2 ${
                  darkMode
                    ? "border-white/12 bg-white/8 text-white placeholder:text-white/35 focus:ring-white/18"
                    : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-[#2B74B8]/20"
                }`}
            />
            <button
              onClick={sendText}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-gradient-to-r from-[#0F3D63] to-[#2B74B8] text-white shadow-[0_10px_24px_rgba(43,116,184,0.24)]"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <div
          className="top-nav-modal-frame fixed inset-0 z-50 bg-black/45 px-4"
          onClick={() => {
            setPickerOpen(false);
            setConfirmDish(null);
            setPickerSearch("");
          }}
        >
          <div
            className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col rounded-[28px] bg-[#F7F6F1] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">Share Dish</div>
                <h2 className="mt-2 text-xl font-bold">Pick a dishlist first</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setConfirmDish(null);
                  setPickerSearch("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/70"
                aria-label="Close dish picker"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-[1.15rem] border border-black/10 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
                <Search size={16} className="shrink-0 text-black/40" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search your dishes"
                  className="min-w-0 flex-1 bg-transparent text-base text-black placeholder:text-black/35 focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pickerDishlists.map((dishlist) => {
                  const preview = [...(dishlist.dishes || [])].slice(0, 4);
                  const selected = dishlist.id === activePickerDishlist?.id;
                  return (
                    <button
                      key={dishlist.id}
                      type="button"
                      onClick={() => setPickerDishlistId(dishlist.id)}
                      className={`rounded-[1.35rem] border p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${
                        selected
                          ? darkMode
                            ? "border-[#2BD36B] bg-[#102817] text-white"
                            : "border-[#2BD36B] bg-[#F4FFF7] text-black"
                          : darkMode
                            ? "border-white/12 bg-[#1A1A1A] text-white"
                            : "border-black/10 bg-white text-black"
                      }`}
                    >
                      <div className={`mb-2 truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>{dishlist.name}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Array.from({ length: 4 }).map((_, index) => {
                          const dish = preview[index];
                          return dish ? (
                            <img
                              key={`${dishlist.id}-${dish.id}-${index}`}
                              src={getDishImageUrl(dish, "thumb")}
                              alt={dish.name || dishlist.name}
                              className="aspect-square w-full rounded-[0.85rem] object-cover"
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_DISH_IMAGE;
                              }}
                            />
                          ) : (
                            <div
                              key={`${dishlist.id}-empty-${index}`}
                              className="aspect-square w-full rounded-[0.85rem] bg-black/6"
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
              {activePickerDishlist ? (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ArrowLeft size={16} className="text-black/35 rotate-180" />
                    <div className="text-sm font-semibold text-black">
                      {pickerSearchTerm ? "Search results" : activePickerDishlist.name}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 content-start">
                    {visiblePickerDishes.map((dish) => {
                      const imageSrc = getDishImageUrl(dish, "thumb");
                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => setConfirmDish(dish)}
                          className={`relative block w-full aspect-[0.82] overflow-hidden rounded-[22px] border-2 ${isRestaurantDish(dish) ? "restaurant-accent-border" : "default-accent-border"} bg-white text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)]`}
                        >
                          <img
                            src={imageSrc}
                            alt={dish.name || "Dish"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_DISH_IMAGE;
                            }}
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-white">
                            <div className="truncate text-xs font-semibold">{dish.name || "Dish"}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {visiblePickerDishes.length === 0 ? (
                    <div className="mt-3 rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 px-4 py-6 text-center text-sm text-black/50">
                      No matching dishes.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDish ? (
        <div className="fixed inset-0 z-[60] bg-black/45 px-4 py-10" onClick={() => setConfirmDish(null)}>
          <div
            className="mx-auto max-w-sm rounded-[28px] bg-[#F7F6F1] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-lg font-bold">Send this dish?</div>
            <div className={`relative overflow-hidden rounded-[22px] border-2 ${isRestaurantDish(confirmDish) ? "restaurant-accent-border" : "default-accent-border"} bg-white shadow-[0_10px_26px_rgba(0,0,0,0.08)]`}>
              <img
                src={getDishImageUrl(confirmDish, "thumb")}
                alt={confirmDish.name || "Dish"}
                className="h-36 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_DISH_IMAGE;
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-3 text-white">
                <div className="font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                  {confirmDish.name || "Dish"}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDish(null)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendDish}
                className="rounded-full bg-gradient-to-r from-[#0F3D63] to-[#2B74B8] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(43,116,184,0.28)]"
              >
                Send dish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] bg-black/35 px-4 py-10" onClick={() => setDeleteTarget(null)}>
          <div
            className="mx-auto mt-auto max-w-sm rounded-[28px] border border-black/10 bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-lg font-bold text-black">Delete message?</div>
            <p className="mb-4 text-sm text-black/60">This removes the message you sent from the chat.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMessage}
                className="inline-flex items-center gap-2 rounded-full bg-[#C93A3A] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(201,58,58,0.25)]"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
