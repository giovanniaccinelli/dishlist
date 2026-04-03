"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, PenLine, Hand } from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { getDishImageUrl } from "../lib/dishImage";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";
const ONBOARDING_STEP_PREVIEW = [
  { label: "Dish 1", color: "#5FA8F2" },
  { label: "Dish 2", color: "#23C268" },
  { label: "Dish 3", color: "#D7B443" },
];

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const [ideaDishes, setIdeaDishes] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

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

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "dishes"), limit(60)));
      const dishes = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((dish) => dish?.name);
      const shuffled = [...dishes].sort(() => Math.random() - 0.5).slice(0, 6);
      setIdeaDishes(shuffled);
    } catch {
      setIdeaDishes([]);
    } finally {
      setIdeasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 0) return;
    loadIdeas();
  }, [step, loadIdeas]);

  const currentInputStep = step - 1;
  const currentName = names[currentInputStep] || "";
  const trimmedNames = useMemo(() => names.map((n) => n.trim()).filter(Boolean), [names]);

  const persistNamesAndEnter = () => {
    const cleaned = names.map((name) => name.trim());
    if (cleaned.some((name) => !name)) {
      setError("Enter all 3 dishes.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.setItem(MODE_KEY, "names");
      sessionStorage.setItem(NAMES_KEY, JSON.stringify(cleaned));
      sessionStorage.setItem(SAVED_KEY, JSON.stringify([]));
    }
    router.replace("/?onboarding=1");
  };

  const handleContinueName = () => {
    if (!currentName.trim()) {
      setError("Enter a dish name.");
      return;
    }
    setError("");
    if (step < 3) {
      setStep((prev) => prev + 1);
      return;
    }
    persistNamesAndEnter();
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
    <div className="min-h-screen bg-transparent text-black px-5 py-6">
      <div className="max-w-xl mx-auto min-h-[calc(100vh-3rem)] flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <img src="/logo-real.png" alt="DishList logo" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-3xl font-bold">DishList</h1>
        </div>

        <motion.div
          className="bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EF_100%)] rounded-[2rem] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.08)] border border-black/10 flex-1 flex flex-col"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {step === 0 ? (
            <>
              <div className="mb-6">
                <h2 className="text-[2.2rem] leading-[0.95] font-semibold text-black">
                  Save your first 3 dishes
                </h2>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full min-h-[15.5rem] rounded-[2rem] bg-[rgba(255,255,255,0.72)] text-black px-8 py-8 text-left shadow-[0_18px_40px_rgba(66,143,223,0.12)] border-[3px] border-[#5FA8F2] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-[1rem] bg-[#5FA8F2] text-white flex items-center justify-center shadow-[0_10px_24px_rgba(95,168,242,0.24)] shrink-0">
                          <PenLine size={20} />
                        </div>
                        <p className="text-[2.1rem] font-semibold leading-[0.95]">Got a few in mind?</p>
                      </div>
                      <p className="mt-4 text-base text-black/78 max-w-[18rem]">
                        Start by adding three dishes you already know you want in your DishList.
                      </p>
                    </div>
                    <div>
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                        Steps
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {ONBOARDING_STEP_PREVIEW.map((step) => (
                          <div key={step.label}>
                            <div className="mb-2 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                            <div className="text-[0.72rem] font-medium text-black/72">{step.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleBrowseFeed}
                  className="w-full min-h-[15.5rem] rounded-[2rem] border-[3px] border-[#1EA956] bg-[rgba(255,255,255,0.72)] px-8 py-8 text-left shadow-[0_18px_40px_rgba(23,130,67,0.12)] backdrop-blur-[6px]"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-[1rem] bg-[#1EA956] text-white flex items-center justify-center shadow-[0_10px_24px_rgba(30,169,86,0.24)] shrink-0">
                          <Hand size={20} />
                        </div>
                        <p className="text-[2.1rem] font-semibold leading-none">Swipe on the feed</p>
                      </div>
                      <p className="mt-4 text-base text-black/62 max-w-[17rem]">
                        Start swiping right away. After your third save, we ask you to create the profile.
                      </p>
                    </div>
                    <div>
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                        Tags you can explore
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["fit", "high protein", "veg", "easy", "comfort", "spicy", "quick", "budget"].map((tag) => (
                          <span
                            key={tag}
                            className={`px-3 py-1 rounded-full text-[11px] border ${tag === "high protein" ? "bg-[#E6F7EA] text-[#14532D] border-[#7BD49B]" : tag === "spicy" ? "bg-[#FFE6E1] text-[#9A3412] border-[#F4A090]" : tag === "comfort" ? "bg-[#FFF1D6] text-[#8A5A00] border-[#EAC46A]" : "bg-white/80 text-black/70 border-black/10"}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="mt-6 w-full rounded-2xl border border-black/12 bg-white px-5 py-4 text-base font-semibold text-black/72 hover:text-black shadow-sm"
              >
                Skip for now
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {[0, 1, 2].map((bar) => (
                    <span
                      key={bar}
                      className={`h-1.5 rounded-full transition-all ${
                        bar < step ? (bar == 0 ? "w-10 bg-[#E85D75]" : bar == 1 ? "w-10 bg-[#F59E0B]" : "w-10 bg-[#2BD36B]") : "w-7 bg-black/10"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-black/35">
                  Dish {step} of 3
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-[2rem] leading-none font-semibold mt-1 text-black">
                  Name a dish
                </h2>
                <p className="mt-3 text-sm text-black/60">You can add an image later.</p>
              </div>

              <input
                type="text"
                value={currentName}
                onChange={(e) => {
                  setError("");
                  setNames((prev) => {
                    const next = [...prev];
                    next[currentInputStep] = e.target.value;
                    return next;
                  });
                }}
                placeholder={`Dish ${step}`}
                className="w-full p-4 rounded-full bg-white/90 border border-[#D8C090] focus:outline-none focus:ring-2 focus:ring-[#E85D75]/20"
              />

              <div className="mt-5 flex-1">
                <p className="text-sm font-semibold text-black/70 mb-3">Some ideas</p>
                <div className="grid grid-cols-3 gap-2">
                  {ideaDishes.map((dish) => (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => {
                        setError("");
                        setNames((prev) => {
                          const next = [...prev];
                          next[currentInputStep] = dish.name || "";
                          return next;
                        });
                      }}
                      className="relative overflow-hidden rounded-[1.25rem] bg-white/85 border border-black/8 shadow-sm text-left"
                    >
                      <div className="aspect-[0.9] overflow-hidden">
                        <img
                          src={getDishImageUrl(dish)}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.72)_100%)] px-2 py-2">
                        <div className="text-[11px] font-medium leading-tight text-white line-clamp-2">
                          {dish.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!ideasLoading && !ideaDishes.length ? (
                  <p className="mt-3 text-sm text-black/45">No ideas yet.</p>
                ) : null}
              </div>

              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep((prev) => (prev > 1 ? prev - 1 : 0));
                  }}
                  className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm"
                  aria-label="Previous step"
                >
                  <ArrowLeft size={20} />
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleContinueName}
                    disabled={!currentName.trim()}
                    className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white flex items-center justify-center shadow-lg disabled:opacity-40"
                    aria-label="Continue"
                  >
                    <ArrowRight size={22} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={persistNamesAndEnter}
                    disabled={trimmedNames.length !== 3}
                    className="rounded-full px-6 py-3 bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white font-semibold shadow-lg disabled:opacity-40"
                  >
                    Enter DishList
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
