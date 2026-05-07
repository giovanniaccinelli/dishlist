"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AppBackButton({
  fallback = "/",
  label = "Back",
  className = "",
  preferFallback = false,
  forceFallback = false,
}) {
  const router = useRouter();

  const goBack = () => {
    if (forceFallback) {
      router.push(fallback);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (preferFallback) {
      router.push(fallback);
      return;
    }
    router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex h-11 items-center gap-2 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] px-3 text-sm font-semibold text-black/72 shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition-transform hover:scale-[1.02] ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={18} />
      <span>{label}</span>
    </button>
  );
}
