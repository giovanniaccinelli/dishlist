"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import AuthPromptModal from "../../../components/AuthPromptModal";
import AppBackButton from "../../../components/AppBackButton";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../../lib/dishImage";
import { getSavedDishesFromFirestore, getDishesFromFirestore, getToTryDishesFromFirestore, markConversationAsRead, sendMessage } from "../../lib/firebaseHelpers";
import { Plus, SendHorizonal, X } from "lucide-react";

export default function DirectChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [dishMap, setDishMap] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDish, setConfirmDish] = useState(null);
  const [ownDishlist, setOwnDishlist] = useState([]);
  const [ownToTry, setOwnToTry] = useState([]);
  const [pickerTab, setPickerTab] = useState("dishlist");
  const endRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || !id) return;
    const convoRef = doc(db, "conversations", id);
    const unsubConvo = onSnapshot(convoRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const otherId = (data.participants || []).find((p) => p !== user.uid);
      if (otherId) {
        const userSnap = await getDoc(doc(db, "users", otherId));
        setOtherUser(userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null);
      }
    });
    const msgsRef = collection(db, "conversations", id, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsubMsgs = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      markConversationAsRead(id, user.uid);
    });
    return () => {
      unsubConvo();
      unsubMsgs();
    };
  }, [id, user?.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
      const [uploaded, saved, toTry] = await Promise.all([
        getDishesFromFirestore(user.uid),
        getSavedDishesFromFirestore(user.uid),
        getToTryDishesFromFirestore(user.uid),
      ]);
      const merged = [...uploaded, ...saved];
      const unique = [];
      const seen = new Set();
      merged.forEach((dish) => {
        if (!dish?.id || seen.has(dish.id)) return;
        seen.add(dish.id);
        unique.push(dish);
      });
      setOwnDishlist(unique);
      setOwnToTry(toTry);
    })();
  }, [user?.uid]);

  const sendText = async () => {
    if (!input.trim() || !user?.uid) return;
    await sendMessage(id, {
      senderId: user.uid,
      type: "text",
      text: input.trim(),
    });
    setInput("");
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
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-black">
        <button
          onClick={() => setShowAuthPrompt(true)}
          className="bg-black text-white px-6 py-3 rounded-full font-semibold"
        >
          Sign in to message
        </button>
        <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-black relative pb-24">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <AppBackButton fallback="/directs" />
        <div className="flex-1 px-4 text-center">
          <div className="text-xl font-bold leading-none">{otherUser?.displayName || "Chat"}</div>
        </div>
        <div className="w-[74px]" />
      </div>

      <div className="px-5 pb-36 space-y-3">
        {messages.map((m) => {
          const isMine = m.senderId === user.uid;
          if (m.type === "dish") {
            const dish = dishMap[m.dishId];
            const imageSrc = getDishImageUrl(dish, "thumb");
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <Link
                  href={`/dish/${m.dishId}?source=public&mode=single`}
                  className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative w-full max-w-[75%]"
                >
                  <img
                    src={imageSrc}
                    alt={dish?.name || "Dish"}
                    className="w-full h-28 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {dish?.name || "Dish"}
                    </div>
                    <div className="text-[10px] text-white/80">
                      saves: {Number(dish?.saves || 0)}
                    </div>
                  </div>
                </Link>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`w-fit max-w-[75%] rounded-2xl px-3 py-2 ${
                  isMine ? "bg-black text-white" : "bg-white border border-black/10"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-[84px] left-0 right-0 z-40 px-5">
        <div className="rounded-[28px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
              aria-label="Share a dish"
            >
              <Plus size={22} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 text-black focus:outline-none focus:ring-2 focus:ring-[#2B74B8]/20"
            />
            <button
              onClick={sendText}
              className="flex h-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-[#0F3D63] to-[#2B74B8] px-4 text-white shadow-[0_10px_24px_rgba(43,116,184,0.28)]"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 px-4 py-6"
          onClick={() => {
            setPickerOpen(false);
            setConfirmDish(null);
          }}
        >
          <div
            className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col rounded-[28px] bg-[#F7F6F1] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Share a dish</h2>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setConfirmDish(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black/70"
                aria-label="Close dish picker"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 flex justify-center">
              <div className="flex items-end gap-10 border-b border-black/12">
                <button
                  type="button"
                  onClick={() => setPickerTab("dishlist")}
                  className={`relative pb-2 text-sm font-semibold transition ${pickerTab === "dishlist" ? "text-black" : "text-black/45"}`}
                >
                  My DishList
                  {pickerTab === "dishlist" ? (
                    <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#23C268]" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab("to_try")}
                  className={`relative pb-2 text-sm font-semibold transition ${pickerTab === "to_try" ? "text-black" : "text-black/45"}`}
                >
                  To Try
                  {pickerTab === "to_try" ? (
                    <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#D9BC48]" />
                  ) : null}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              <div className="grid grid-cols-3 gap-3 content-start">
                {(pickerTab === "dishlist" ? ownDishlist : ownToTry).map((dish) => {
                const imageSrc = getDishImageUrl(dish, "thumb");
                return (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => setConfirmDish(dish)}
                    className="relative block w-full aspect-[0.82] overflow-hidden rounded-[22px] bg-white text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)]"
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
            <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_10px_26px_rgba(0,0,0,0.08)]">
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

      <BottomNav />
    </div>
  );
}
