"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [names, setNames] = useState(["", "", ""]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = sessionStorage.getItem(NAMES_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length) {
          setNames([
            parsed[0] || "",
            parsed[1] || "",
            parsed[2] || "",
          ]);
        }
      } catch {}
    }
  }, []);

  const canContinue = useMemo(() => {
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    return trimmed.length === 3;
  }, [names]);

  const handleNamesContinue = () => {
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    if (trimmed.length !== 3) {
      setError("Please enter exactly three dishes.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.setItem(MODE_KEY, "names");
      sessionStorage.setItem(NAMES_KEY, JSON.stringify(trimmed));
      sessionStorage.setItem(SAVED_KEY, JSON.stringify([]));
    }
    router.replace("/?onboarding=1");
  };

  const handleBrowseFeed = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.setItem(MODE_KEY, "feed");
      sessionStorage.setItem(SAVED_KEY, JSON.stringify([]));
      sessionStorage.removeItem(NAMES_KEY);
    }
    router.replace("/?onboarding=feed");
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.removeItem(MODE_KEY);
      sessionStorage.removeItem(NAMES_KEY);
      sessionStorage.removeItem(SAVED_KEY);
    }
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#F6F6F2] text-black px-6 py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo-real.png" alt="DishList logo" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-3xl font-bold">DishList</h1>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg border border-black/10 mb-6">
          <h2 className="text-2xl font-semibold mb-2">Start your DishList</h2>
          <p className="text-sm text-black/60 mb-4">
            Write down 3 dishes you love making at home. We’ll save them to your profile once you create an account.
          </p>
          <div className="space-y-3">
            {names.map((value, idx) => (
              <input
                key={`dish-${idx}`}
                type="text"
                value={value}
                onChange={(e) => {
                  setError("");
                  setNames((prev) => {
                    const next = [...prev];
                    next[idx] = e.target.value;
                    return next;
                  });
                }}
                placeholder={`Dish ${idx + 1}`}
                className="w-full p-3 rounded-xl bg-[#F6F6F2] border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
          <button
            onClick={handleNamesContinue}
            disabled={!canContinue}
            className="mt-5 w-full bg-black text-white py-3 rounded-full font-semibold disabled:opacity-40"
          >
            Continue
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg border border-black/10 mb-6">
          <h3 className="text-xl font-semibold mb-2">Not sure yet?</h3>
          <p className="text-sm text-black/60 mb-4">
            Browse the feed and add up to three dishes to your DishList. We’ll ask you to create an account after the third.
          </p>
          <button
            onClick={handleBrowseFeed}
            className="w-full bg-white border border-black/20 py-3 rounded-full font-semibold hover:bg-black/5"
          >
            Browse the feed
          </button>
        </div>

        <button
          onClick={handleSkip}
          className="w-full text-sm text-black/60 hover:text-black"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
