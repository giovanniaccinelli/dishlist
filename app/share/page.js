"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChefHat, Loader2, Sparkles, Wand2 } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { useLanguage } from "../../components/LanguageProvider";

function getSharedParams() {
  if (typeof window === "undefined") return { url: "", text: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    url: String(params.get("url") || "").trim(),
    text: String(params.get("text") || "").trim(),
  };
}

export default function ShareIntakePage() {
  const router = useRouter();
  const { language, darkMode } = useLanguage();
  const [shared, setShared] = useState({ url: "", text: "" });
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const nextShared = getSharedParams();
    setShared(nextShared);
    let active = true;
    setExtracting(true);
    fetch("/api/share/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextShared),
    })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDraft(data);
      })
      .catch(() => {
        if (active) setDraft({ title: "", ingredients: [], method: "", description: "" });
      })
      .finally(() => {
        if (active) setExtracting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const uploadHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("direct", "1");
    params.set("shared", "1");
    params.set("mode", "recipe");
    if (shared.url) params.set("sharedUrl", shared.url);
    if (shared.text) params.set("sharedText", shared.text);
    if (draft?.title) params.set("sharedTitle", draft.title);
    if (Array.isArray(draft?.ingredients) && draft.ingredients.length) {
      params.set("sharedIngredients", draft.ingredients.join("\n"));
    }
    if (draft?.method) params.set("sharedMethod", draft.method);
    return `/upload?${params.toString()}`;
  }, [draft, shared.text, shared.url]);

  const title = draft?.title || shared.text || shared.url || (language === "it" ? "Nuovo piatto" : "New dish");
  const hasRecipeShape = Array.isArray(draft?.ingredients) && draft.ingredients.length > 0;

  return (
    <main className={`min-h-screen pb-[calc(var(--app-bottom-nav-height)+2rem)] pt-[calc(var(--safe-area-top)+1.5rem)] ${darkMode ? "bg-black text-white" : "bg-[#F9F4EA] text-black"}`}>
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-[31rem] flex-col px-5">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2BD36B]">
              <Sparkles size={18} strokeWidth={2.5} />
              <span className="text-[12px] font-black uppercase tracking-[0.18em]">
                {language === "it" ? "Da share sheet" : "From share sheet"}
              </span>
            </div>
            <h1 className="mt-2 text-[2.35rem] font-black leading-none tracking-tight">
              {language === "it" ? "Crea piatto" : "Create dish"}
            </h1>
          </div>
          <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[1.2rem] bg-[#2BD36B]/16 text-[#2BD36B] shadow-[0_16px_34px_rgba(43,211,107,0.12)]">
            <Wand2 size={25} strokeWidth={2.5} />
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111] p-5 text-white shadow-[0_24px_58px_rgba(0,0,0,0.22)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(43,211,107,0.2),transparent_35%),radial-gradient(circle_at_88%_18%,rgba(255,224,107,0.16),transparent_38%)]" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#2BD36B]">
                {extracting ? <Loader2 className="animate-spin" size={22} /> : <ChefHat size={22} strokeWidth={2.5} />}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.16em] text-white/42">
                  {extracting ? (language === "it" ? "Leggo il link" : "Reading link") : hasRecipeShape ? "Recipe found" : "Ready"}
                </div>
                <div className="truncate text-[1.22rem] font-black">{title}</div>
              </div>
            </div>

            {shared.url ? (
              <div className="mb-4 truncate rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[12px] font-semibold text-white/56">
                {shared.url}
              </div>
            ) : null}

            {hasRecipeShape ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {draft.ingredients.slice(0, 8).map((ingredient) => (
                  <span key={ingredient} className="rounded-full bg-[#FFBF3C]/16 px-3 py-1.5 text-[12px] font-black text-[#FFE6A0]">
                    {ingredient}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-[0.95rem] font-semibold leading-6 text-white/62">
                {language === "it"
                  ? "Lo preparo come bozza: nome e link entrano già nell'upload, poi puoi rifinirlo."
                  : "I will prepare this as a draft: name and link go into upload, then you can polish it."}
              </p>
            )}

            <button
              type="button"
              onClick={() => router.push(uploadHref)}
              disabled={extracting}
              className="no-accent-border flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[#2BD36B] px-5 text-[1rem] font-black text-black shadow-[0_16px_34px_rgba(43,211,107,0.24)] transition active:scale-[0.985] disabled:opacity-60"
            >
              {language === "it" ? "Apri upload" : "Open upload"}
              <ArrowRight size={18} strokeWidth={2.7} />
            </button>
          </div>
        </section>

        <Link href="/" className="mt-5 text-center text-sm font-bold text-white/42">
          {language === "it" ? "Torna a DishList" : "Back to DishList"}
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}
