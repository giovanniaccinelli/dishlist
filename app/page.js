"use client";
import { useState, useEffect } from "react";
import SwipeDeck from "../components/SwipeDeck";
import { getAllDishesFromFirestore, cleanupDishIdField } from "./lib/firebaseHelpers";
import { useAuth } from "./lib/auth";
import BottomNav from "../components/BottomNav";

export default function Feed() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [activeTab, setActiveTab] = useState("dish");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadDishes = async () => {
    if (!user) return;
    setLoadingDishes(true);
    try {
      const all = await getAllDishesFromFirestore();
      setDishes(shuffle(all));
    } catch (err) {
      console.error("Failed to load dishes:", err);
      alert("Failed to load dishes. Please try again.");
    } finally {
      setLoadingDishes(false);
    }
  };

  useEffect(() => {
    loadDishes();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("migrate") === "1") {
      cleanupDishIdField()
        .then((count) => {
          alert(`Cleanup done. Removed id field from ${count} dishes.`);
        })
        .catch((err) => {
          console.error("Cleanup failed:", err);
          alert("Cleanup failed. Check console.");
        });
    }
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

          {authError && (
            <p className="mb-3 text-sm text-red-400 text-center">{authError}</p>
          )}

          <button
            onClick={async () => {
              setAuthError("");
              if (!email || !password) {
                setAuthError("Email and password are required.");
                return;
              }
              try {
                await signInWithEmail(email, password);
              } catch (err) {
                setAuthError(err?.message || "Login failed.");
              }
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold mb-2"
          >
            Login
          </button>
          <button
            onClick={async () => {
              setAuthError("");
              if (!email || !password) {
                setAuthError("Email and password are required.");
                return;
              }
              try {
                await signUpWithEmail(email, password);
              } catch (err) {
                setAuthError(err?.message || "Create account failed.");
              }
            }}
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
          trackSwipes={false}
          onDeckEmpty={loadDishes}
          loadMoreDishes={loadDishes}
          hasMore={false}
          loadingMore={loadingDishes}
          onResetFeed={loadDishes}
        />
      )}
      <BottomNav />
    </div>
  );
}
