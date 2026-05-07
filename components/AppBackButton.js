"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AppBackButton({
  fallback = "/",
  label = "Back",
  ariaLabel,
  className = "",
  preferFallback = false,
  forceFallback = false,
}) {
  const router = useRouter();

  const goBack = () => {
    if (forceFallback) {
      router.replace(fallback);
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
      className={`inline-flex h-11 items-center ${label ? "gap-2 px-3" : "justify-center px-0"} rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] text-sm font-semibold text-black/72 shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition-transform hover:scale-[1.02] ${className}`}
      aria-label={ariaLabel || label || "Back"}
    >
      <ArrowLeft size={18} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
