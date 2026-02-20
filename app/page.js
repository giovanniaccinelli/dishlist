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
      <div className="min-h-screen bg-[#F6F6F2] flex items-center justify-center text-black px-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-black/10">
          <h2 className="text-2xl font-bold mb-2 text-center">Welcome to DishList</h2>
          <p className="text-sm text-black/60 text-center mb-6">
            Sign in to browse and save dishes
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-black text-white py-3 rounded-full font-semibold mb-4 hover:opacity-90 transition"
          >
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-black/50">or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-3 rounded-full bg-[#F6F6F2] border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 mb-4 rounded-full bg-[#F6F6F2] border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {authError && (
            <p className="mb-3 text-sm text-red-500 text-center">{authError}</p>
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
            className="w-full bg-black text-white py-3 rounded-full font-semibold mb-2 hover:opacity-90 transition"
          >
            Log In
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
            className="w-full bg-white border border-black/20 py-3 rounded-full font-semibold hover:bg-black/5 transition"
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
          <button
            onClick={() => (window.location.href = "/profile")}
            className="w-10 h-10 rounded-full border border-black/20 flex items-center justify-center"
            aria-label="Profile"
          >
            <span className="text-xl">👤</span>
          </button>
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
