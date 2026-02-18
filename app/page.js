"use client";
import { useState, useEffect } from "react";
import SwipeDeck from "../components/SwipeDeck";
import {
  getDishesPage,
  getSwipedDishesForUser,
  clearSwipedDishesForUser,
  getFollowingForUser,
} from "./lib/firebaseHelpers";
import { useAuth } from "./lib/auth";
import BottomNav from "../components/BottomNav";
import { collection, getDocs, query, where, orderBy, limit as limitResults } from "firebase/firestore";
import { db } from "./lib/firebase";

export default function Feed() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [swipedIds, setSwipedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("dish");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const filterNewItems = (items, swipedSet, existingIds) =>
    items.filter((d) => d?.id && !swipedSet.has(d.id) && !existingIds.has(d.id));

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const fetchFollowedDishes = async (followedIds) => {
    if (!followedIds.length) return [];
    const chunks = [];
    for (let i = 0; i < followedIds.length; i += 10) {
      chunks.push(followedIds.slice(i, i + 10));
    }
    const results = [];
    for (const chunk of chunks) {
      const q = query(
        collection(db, "dishes"),
        where("owner", "in", chunk),
        orderBy("createdAt", "desc"),
        limitResults(20)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
    }
    return results;
  };

  const buildMixedFeed = (followed, randomPool, pageSize, swipedSet) => {
    const out = [];
    const followedQueue = [...followed];
    const randomQueue = shuffle(randomPool);
    while (out.length < pageSize && (followedQueue.length || randomQueue.length)) {
      if (followedQueue.length) out.push(followedQueue.shift());
      if (out.length >= pageSize) break;
      if (randomQueue.length) out.push(randomQueue.shift());
    }
    const existing = new Set();
    return out.filter((d) => {
      if (!d?.id || swipedSet.has(d.id) || existing.has(d.id)) return false;
      existing.add(d.id);
      return true;
    });
  };

  const loadDishes = async () => {
    if (!user) return;
    setLoadingDishes(true);
    try {
      const swiped = await getSwipedDishesForUser(user.uid);
      setSwipedIds(swiped);
      const swipedSet = new Set(swiped);

      const followedIds = await getFollowingForUser(user.uid);
      const followedDishes = await fetchFollowedDishes(followedIds);

      const pageSize = 20;
      const { items, lastDoc: newLastDoc } = await getDishesPage({
        pageSize: 50,
      });
      const mixed = buildMixedFeed(followedDishes, items, pageSize, swipedSet);

      setDishes(mixed);
      setLastDoc(newLastDoc);
      setHasMore(Boolean(newLastDoc));
    } catch (err) {
      console.error("Failed to load dishes:", err);
      alert("Failed to load dishes. Please try again.");
    } finally {
      setLoadingDishes(false);
    }
  };

  const loadMoreDishes = async () => {
    if (!user || !lastDoc || loadingDishes) return;
    setLoadingDishes(true);
    try {
      const swipedSet = new Set(swipedIds);
      const followedIds = await getFollowingForUser(user.uid);
      const followedDishes = await fetchFollowedDishes(followedIds);

      const { items, lastDoc: newLastDoc } = await getDishesPage({
        pageSize: 50,
        cursor: lastDoc,
      });
      const mixed = buildMixedFeed(followedDishes, items, 20, swipedSet);
      setDishes((prev) => {
        const existing = new Set(prev.map((d) => d.id));
        const filtered = filterNewItems(mixed, swipedSet, existing);
        return [...prev, ...filtered];
      });
      setLastDoc(newLastDoc);
      setHasMore(Boolean(newLastDoc));
    } catch (err) {
      console.error("Failed to load more dishes:", err);
      alert("Failed to load more dishes. Please try again.");
    } finally {
      setLoadingDishes(false);
    }
  };

  useEffect(() => {
    loadDishes();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center text-white">
        <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-sm shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Sign in to browse dishes</h2>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold mb-4"
          >
            Sign in with Google
          </button>
          <hr className="border-gray-600 my-4" />
          <p className="text-gray-400 text-center mb-4">Or use email</p>

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={() => signInWithEmail(email, password)}
            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold mb-2"
          >
            Login
          </button>
          <button
            onClick={() => signUpWithEmail(email, password)}
            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black relative">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-3xl font-bold">DishList</h1>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full border border-black/20 flex items-center justify-center">
            <span className="text-xl">≡</span>
          </button>
          <button className="w-10 h-10 rounded-full border border-black/20 flex items-center justify-center">
            <span className="text-xl">👤</span>
          </button>
        </div>
      </div>
      <div className="px-5 pb-3">
        <div className="flex items-center justify-center gap-8 text-sm font-semibold text-black/70">
          <button
            onClick={() => setActiveTab("dish")}
            className={activeTab === "dish" ? "text-black" : ""}
          >
            dish
          </button>
          <button
            onClick={() => setActiveTab("recipe")}
            className={activeTab === "recipe" ? "text-black" : ""}
          >
            recipe
          </button>
        </div>
        <div className="mt-2 h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={`h-full rounded-full bg-black transition-all ${
              activeTab === "dish" ? "w-1/2" : "w-1/2 translate-x-full"
            }`}
          />
        </div>
      </div>
      {loadingDishes && dishes.length === 0 ? (
        <div className="flex items-center justify-center h-[70vh] text-black/60">
          Loading feed...
        </div>
      ) : (
        <SwipeDeck
          dishes={dishes}
          onSwiped={(id) => setSwipedIds((prev) => [...prev, id])}
          loadMoreDishes={loadMoreDishes}
          hasMore={hasMore}
          loadingMore={loadingDishes}
          onResetFeed={async () => {
            if (!user) return;
            await clearSwipedDishesForUser(user.uid);
            setSwipedIds([]);
            await loadDishes();
          }}
        />
      )}
      <BottomNav />
    </div>
  );
}
