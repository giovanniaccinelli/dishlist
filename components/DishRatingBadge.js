"use client";

export default function DishRatingBadge({ dish, className = "" }) {
  const isRestaurant = String(dish?.dishMode || "").toLowerCase() === "restaurant";
  const rating = Math.max(0, Math.min(5, Math.round((Number(dish?.rating) || 0) * 2) / 2));
  if (!isRestaurant || rating <= 0) return null;

  return (
    <div
      className={`pointer-events-none absolute left-1.5 top-1.5 z-30 inline-flex items-center gap-0.5 rounded-full border border-white/18 bg-black/62 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#FFD166] shadow-[0_6px_14px_rgba(0,0,0,0.28)] backdrop-blur-md ${className}`}
    >
      <span aria-hidden="true">★</span>
      <span>{rating.toFixed(rating % 1 ? 1 : 0)}</span>
    </div>
  );
}
