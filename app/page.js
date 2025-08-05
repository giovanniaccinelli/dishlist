"use client";
import { useState, useEffect } from "react";
import SwipeDeck from "../components/SwipeDeck";
import { getDishesFromFirestore } from "./lib/firebaseHelpers";
import { useAuth } from "./lib/auth";
import BottomNav from "../components/BottomNav";

export default function Feed() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadDishes = async () => {
    if (!user) return;
    try {
      const fetchedDishes = await getDishesFromFirestore(); // get ALL dishes, not just user’s
      console.log("Fetched dishes:", fetchedDishes);
      setDishes(fetchedDishes);
    } catch (err) {
      console.error("Failed to load dishes:", err);
      alert("Failed to load dishes. Please try again.");
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

  if (dishes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0E] text-white text-xl font-semibold">
        No dishes found. 
        <button
          onClick={loadDishes}
          className="ml-4 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white relative">
      <h1 className="text-3xl font-bold mb-6 p-6">Dishlist</h1>
      <SwipeDeck dishes={dishes} reloadDishes={loadDishes} />
      <BottomNav />
    </div>
  );
}
