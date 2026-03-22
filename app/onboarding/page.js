"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(["", "", ""]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = sessionStorage.getItem(NAMES_KEY);
    if (!existing) return;
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length) {
        setNames([parsed[0] || "", parsed[1] || "", parsed[2] || ""]);
      }
    } catch {}
  }, []);

  const trimmedNames = useMemo(() => names.map((n) => n.trim()).filter(Boolean), [names]);
  const canContinueNames = trimmedNames.length === 3;

  const handleNamesContinue = () => {
    if (!canContinueNames) {
      setError("Enter exactly 3 dishes.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.setItem(MODE_KEY, "names");
      sessionStorage.setItem(NAMES_KEY, JSON.stringify(trimmedNames));
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
    <div className="min-h-screen bg-transparent text-black px-6 py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo-real.png" alt="DishList logo" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-3xl font-bold">DishList</h1>
        </div>

        <motion.div
          className="bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF3DE_56%,#FFFBEF_100%)] rounded-[2rem] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.08)] border border-[#E3CFA7]"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              {[0, 1].map((bar) => (
                <span
                  key={bar}
                  className={`h-1.5 rounded-full transition-all ${
                    bar <= step ? (bar === 0 ? "w-10 bg-[#F59E0B]" : "w-10 bg-[#2BD36B]") : "w-7 bg-black/10"
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-black/35">
              {step === 0 ? "Start" : "3 Dishes"}
            </div>
          </div>

          {step === 0 ? (
            <>
              <div className="mb-6">
                <h2 className="text-[2.2rem] leading-[0.95] font-semibold text-black">
                  Build your DishList
                </h2>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-[1.8rem] bg-[linear-gradient(135deg,#111111_0%,#2B2B2B_100%)] text-white px-6 py-6 text-left shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
                >
                  <p className="text-2xl font-semibold leading-none">Write 3 dishes</p>
                  <p className="mt-3 text-sm text-white/70">
                    Start with three dishes you like making at home.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleBrowseFeed}
                  className="w-full rounded-[1.8rem] border border-[#D8C9AF] bg-[linear-gradient(135deg,#F4E9D5_0%,#FCF5E7_100%)] px-6 py-6 text-left shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
                >
                  <p className="text-2xl font-semibold leading-none">Browse the feed</p>
                  <p className="mt-3 text-sm text-black/65">
                    Swipe and add up to three dishes. Account creation happens after the third.
                  </p>
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="mt-6 w-full text-sm text-black/60 hover:text-black"
              >
                Skip for now
              </button>
            </>
          ) : (
            <>
              <div className="mb-5">
                <div className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-black/55">
                  Step 1
                </div>
                <h2 className="text-[2rem] leading-none font-semibold mt-3 text-black">
                  Add 3 dishes
                </h2>
                <p className="mt-3 text-sm text-black/60">
                  We’ll save these to your profile when you create an account.
                </p>
              </div>

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
                    className="w-full p-4 rounded-full bg-white/90 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/35"
                  />
                ))}
              </div>

              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm"
                  aria-label="Previous step"
                >
                  <ArrowLeft size={20} />
                </button>

                <button
                  type="button"
                  onClick={handleNamesContinue}
                  disabled={!canContinueNames}
                  className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#111111_0%,#2B2B2B_100%)] text-white flex items-center justify-center shadow-lg disabled:opacity-40"
                  aria-label="Continue"
                >
                  <ArrowRight size={22} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
