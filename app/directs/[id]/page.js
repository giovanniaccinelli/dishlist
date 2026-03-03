"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import BottomNav from "../../../components/BottomNav";
import AuthPromptModal from "../../../components/AuthPromptModal";

export default function DirectChat() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [dishMap, setDishMap] = useState({});
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

  const sendText = async () => {
    if (!input.trim() || !user?.uid) return;
    await addDoc(collection(db, "conversations", id, "messages"), {
      senderId: user.uid,
      type: "text",
      text: input.trim(),
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, "conversations", id),
      { lastMessage: { type: "text", text: input.trim(), senderId: user.uid, createdAt: new Date() }, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setInput("");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black">
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
    <div className="min-h-screen bg-[#F6F6F2] text-black relative pb-24">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-black/60">
          ← Back
        </button>
        <div className="text-sm font-semibold">{otherUser?.displayName || "Chat"}</div>
        <div className="w-6" />
      </div>

      <div className="px-5 pb-28 space-y-3">
        {messages.map((m) => {
          if (m.type === "dish") {
            const dish = dishMap[m.dishId];
            const imageSrc =
              dish?.imageURL || dish?.imageUrl || dish?.image_url || dish?.image || "";
            return (
              <Link
                key={m.id}
                href={`/dish/${m.dishId}?source=public&mode=single`}
                className={`pressable-card bg-white rounded-2xl overflow-hidden shadow-md relative w-full max-w-[75%] ${
                  m.senderId === user.uid ? "ml-auto" : "mr-auto"
                }`}
              >
                {imageSrc ? (
                  <img src={imageSrc} alt={dish?.name || "Dish"} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center bg-neutral-200 text-gray-500">
                    No image
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
                  <div className="text-[11px] font-semibold leading-tight truncate">
                    {dish?.name || "Dish"}
                  </div>
                  <div className="text-[10px] text-white/80">tap to open</div>
                </div>
              </Link>
            );
          }
          return (
            <div
              key={m.id}
              className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                m.senderId === user.uid ? "bg-black text-white ml-auto" : "bg-white border border-black/10"
              }`}
            >
              <div className="text-sm">{m.text}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-5 pb-4 bg-[#F6F6F2]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 p-3 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
          />
          <button onClick={sendText} className="bg-black text-white px-4 rounded-xl font-semibold">
            Send
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
