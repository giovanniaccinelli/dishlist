"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, PenLine, Hand } from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { getDishImageUrl } from "../lib/dishImage";
import { useLanguage } from "../../components/LanguageProvider";

const DONE_KEY = "onboarding:done";
const MODE_KEY = "onboarding:mode";
const NAMES_KEY = "onboarding:dishNames";
const SAVED_KEY = "onboarding:guestSavedDishIds";
const SELECTED_DISHES_KEY = "onboarding:selectedDishIds";
const ONBOARDING_STEP_PREVIEW = [
  { label: "Dish 1", color: "#E64646" },
  { label: "Dish 2", color: "#F59E0B" },
  { label: "Dish 3", color: "#23C268" },
];

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(["", "", ""]);
  const [selectedDishIds, setSelectedDishIds] = useState([null, null, null]);
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
    const selected = sessionStorage.getItem(SELECTED_DISHES_KEY);
    if (!selected) return;
    try {
      const parsedSelected = JSON.parse(selected);
      if (Array.isArray(parsedSelected) && parsedSelected.length) {
        setSelectedDishIds([
          parsedSelected[0] || null,
          parsedSelected[1] || null,
          parsedSelected[2] || null,
        ]);
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
      setError(t("Enter all 3 dishes."));
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.setItem(MODE_KEY, "names");
      sessionStorage.setItem(NAMES_KEY, JSON.stringify(cleaned));
      sessionStorage.setItem(SELECTED_DISHES_KEY, JSON.stringify(selectedDishIds));
      sessionStorage.setItem(SAVED_KEY, JSON.stringify([]));
    }
    router.replace("/?onboarding=1");
  };

  const handleContinueName = () => {
    if (!currentName.trim()) {
      setError(t("Enter a dish name."));
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
      sessionStorage.removeItem(SELECTED_DISHES_KEY);
    }
    router.replace("/?onboarding=feed");
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.removeItem(MODE_KEY);
      sessionStorage.removeItem(NAMES_KEY);
      sessionStorage.removeItem(SELECTED_DISHES_KEY);
      sessionStorage.removeItem(SAVED_KEY);
    }
    router.replace("/");
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#050505] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1.1rem)] text-white">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-start">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo-real.png" alt="DishList logo" className="w-9 h-9 rounded-full object-cover" />
          <h1 className="text-[1.8rem] font-bold leading-none text-white">DishList</h1>
        </div>

        <motion.div
          className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] flex-col overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#101010] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.48)]"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {step === 0 ? (
            <>
              <div className="mb-3">
                <h2 className="text-[1.7rem] leading-[0.96] font-semibold text-white">
                  {t("Save your first 3 dishes")}
                </h2>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="preserve-blue-border w-full rounded-[1.4rem] border-[2px] border-[#E64646] bg-[#1A1111] px-4 py-3.5 text-left text-white shadow-[0_16px_34px_rgba(230,70,70,0.16)]"
                >
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[1.35rem] font-semibold leading-[0.96]">{t("Got a few in mind?")}</p>
                        <div className="h-10 w-10 rounded-[0.95rem] bg-[#E64646] text-white flex items-center justify-center shadow-[0_10px_24px_rgba(230,70,70,0.24)] shrink-0">
                          <PenLine size={18} />
                        </div>
                      </div>
                      <p className="mt-2 text-[0.88rem] leading-5 text-white/68 max-w-[17rem]">
                        {t("Start by adding three dishes you already know you want in your DishList.")}
                      </p>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                        {t("Steps")}
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {ONBOARDING_STEP_PREVIEW.map((step) => (
                          <div key={step.label}>
                            <div className="mb-1.5 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                            <div className="text-[0.72rem] font-medium text-white/62">{t(step.label)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleBrowseFeed}
                  className="preserve-green-border w-full rounded-[1.4rem] border-[2px] border-[#F0A623] bg-[#1D1708] px-4 py-3.5 text-left text-white shadow-[0_16px_34px_rgba(240,166,35,0.16)]"
                >
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[1.35rem] font-semibold leading-none">{t("Swipe on the feed")}</p>
                        <div className="h-10 w-10 rounded-[0.95rem] bg-[#F0A623] text-white flex items-center justify-center shadow-[0_10px_24px_rgba(240,166,35,0.24)] shrink-0">
                          <Hand size={18} />
                        </div>
                      </div>
                      <p className="mt-2 text-[0.88rem] leading-5 text-white/62 max-w-[17rem]">
                        {t("Start swiping right away. After your third save, we ask you to create the profile.")}
                      </p>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                        {t("Tags you can explore")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["fit", "high protein", "veg", "easy", "comfort", "spicy", "quick", "budget"].map((tag) => (
                          <span
                            key={tag}
                            className={`px-3 py-1 rounded-full text-[11px] border ${tag === "high protein" ? "bg-[#102817] text-[#D9FFE3] border-[#2BD36B]" : tag === "spicy" ? "bg-[#2A1212] text-[#FFD5D5] border-[#E64646]" : tag === "comfort" ? "bg-[#241A09] text-[#FFE2A0] border-[#F0A623]" : "bg-white/8 text-white/68 border-white/12"}`}
                          >
                            {t(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="mt-3 w-full rounded-[1.15rem] border border-white/10 bg-white/8 px-5 py-3 text-[0.95rem] font-semibold text-white/72 shadow-sm"
              >
                {t("Skip for now")}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  {[0, 1, 2].map((bar) => (
                    <span
                      key={bar}
                      className={`h-1.5 rounded-full transition-all ${
                        bar < step ? (bar == 0 ? "w-10 bg-[#E85D75]" : bar == 1 ? "w-10 bg-[#F59E0B]" : "w-10 bg-[#2BD36B]") : "w-7 bg-white/14"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/38">
                  {t("Dish")} {step} {t("of")} 3
                </div>
              </div>

              <div className="mb-4">
                <h2 className="text-[1.55rem] leading-none font-semibold mt-1 text-white">
                  {t("Name a dish")}
                </h2>
                <p className="mt-2 text-sm text-white/55">{t("You can add an image later.")}</p>
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
                  setSelectedDishIds((prev) => {
                    const next = [...prev];
                    next[currentInputStep] = null;
                    return next;
                  });
                }}
                placeholder={`${t("Dish")} ${step}`}
                className="w-full rounded-full border border-white/12 bg-[#181818] p-3.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#E85D75]/25"
              />

              <div className="mt-4">
                <p className="text-sm font-semibold text-white/68 mb-3">{t("Some ideas")}</p>
                <div className="grid grid-cols-2 gap-3">
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
                        setSelectedDishIds((prev) => {
                          const next = [...prev];
                          next[currentInputStep] = dish.id || null;
                          return next;
                        });
                      }}
                      className="relative overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#181818] text-left shadow-sm"
                    >
                      <div className="aspect-[0.9] overflow-hidden">
                        <img
                          src={getDishImageUrl(dish, "thumb")}
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
                  <p className="mt-3 text-sm text-white/45">{t("No ideas yet.")}</p>
                ) : null}
              </div>

              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep((prev) => (prev > 1 ? prev - 1 : 0));
                  }}
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/8 text-white shadow-sm"
                    aria-label={t("Previous step")}
                >
                  <ArrowLeft size={20} />
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleContinueName}
                    disabled={!currentName.trim()}
                    className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] text-white flex items-center justify-center shadow-lg disabled:opacity-40"
                    aria-label={t("Continue")}
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
                    {t("Enter DishList")}
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
