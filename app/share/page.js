"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";

function getSharedParams() {
  if (typeof window === "undefined") return { url: "", text: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    url: String(params.get("url") || "").trim(),
    text: String(params.get("text") || "").trim(),
  };
}

function fallbackDraft(shared, language) {
  const title = shared.text.split(/\n|\. /)[0]?.slice(0, 90) || "";
  return {
    title,
    description: shared.text || "",
    ingredients: [],
    method: "",
    tags: [],
    error: shared.url || shared.text ? "" : language === "it" ? "Nessun link ricevuto." : "No shared link received.",
  };
}

export default function ShareIntakePage() {
  const router = useRouter();
  const { language, darkMode } = useLanguage();
  const [shared, setShared] = useState({ url: "", text: "" });
  const [draft, setDraft] = useState(null);
  const [extracting, setExtracting] = useState(true);

  useEffect(() => {
    const nextShared = getSharedParams();
    setShared(nextShared);

    if (!nextShared.url && !nextShared.text) {
      setDraft(fallbackDraft(nextShared, language));
      setExtracting(false);
      return undefined;
    }

    let active = true;
    setExtracting(true);
    fetch("/api/share/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextShared),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        setDraft(data || fallbackDraft(nextShared, language));
      })
      .catch(() => {
        if (active) setDraft(fallbackDraft(nextShared, language));
      })
      .finally(() => {
        if (active) setExtracting(false);
      });

    return () => {
      active = false;
    };
  }, [language]);

  const uploadHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("direct", "1");
    params.set("shared", "1");
    params.set("mode", "recipe");
    if (shared.url) params.set("sharedUrl", shared.url);
    if (shared.text) params.set("sharedText", shared.text.slice(0, 1200));
    if (draft?.title) params.set("sharedTitle", draft.title);
    if (draft?.description) params.set("sharedDescription", draft.description);
    if (draft?.servings) params.set("sharedServings", draft.servings);
    if (draft?.prepTime) params.set("sharedPrepTime", draft.prepTime);
    if (draft?.cookTime) params.set("sharedCookTime", draft.cookTime);
    if (draft?.totalTime) params.set("sharedTotalTime", draft.totalTime);
    if (Array.isArray(draft?.ingredients) && draft.ingredients.length) {
      params.set("sharedIngredients", draft.ingredients.join("\n"));
    }
    if (draft?.method) params.set("sharedMethod", draft.method);
    if (Array.isArray(draft?.tags) && draft.tags.length) {
      params.set("sharedTags", draft.tags.join(","));
    }
    return `/upload?${params.toString()}`;
  }, [draft, shared.text, shared.url]);

  useEffect(() => {
    if (extracting || !draft) return undefined;
    const timer = window.setTimeout(() => {
      router.replace(uploadHref);
    }, draft.error ? 900 : 150);
    return () => window.clearTimeout(timer);
  }, [draft, extracting, router, uploadHref]);

  const title = extracting
    ? language === "it"
      ? "Leggo il link"
      : "Reading link"
    : language === "it"
      ? "Apro l'upload"
      : "Opening upload";

  return (
    <main className={`min-h-screen pt-[calc(var(--safe-area-top)+1.5rem)] ${darkMode ? "bg-black text-white" : "bg-[#F9F4EA] text-black"}`}>
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[28rem] flex-col items-center justify-center px-6 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${darkMode ? "bg-white/10" : "bg-black/10"} text-[#2BD36B]`}>
          <Loader2 className="animate-spin" size={28} />
        </div>
        <h1 className="mt-5 text-[1.9rem] font-black leading-tight">{title}</h1>
        <p className={`mt-3 text-[0.95rem] font-bold leading-6 ${darkMode ? "text-white/54" : "text-black/54"}`}>
          {draft?.error || (language === "it" ? "Sto preparando la bozza del piatto." : "Preparing the dish draft.")}
        </p>
        <button
          type="button"
          onClick={() => router.replace(uploadHref)}
          className="no-accent-border mt-7 h-12 rounded-full bg-[#2BD36B] px-6 text-[0.95rem] font-black text-black"
        >
          {language === "it" ? "Apri upload" : "Open upload"}
        </button>
      </div>
    </main>
  );
}
