"use client";

export default function DishRatingBadge({ dish, className = "" }) {
  const isRestaurant = String(dish?.dishMode || "").toLowerCase() === "restaurant";
  const rating = Math.max(0, Math.min(5, Math.round((Number(dish?.rating) || 0) * 2) / 2));
  if (!isRestaurant || rating <= 0) return null;

  return (
    <div
      className={`pointer-events-none absolute left-1.5 top-1.5 z-30 inline-flex items-center gap-0.5 text-[11px] font-bold leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] ${className}`}
      aria-label={`${rating} star rating`}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className="relative inline-block text-white/35" aria-hidden="true">
            ★
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden text-[#FFD166]" style={{ width: `${fill * 100}%` }}>
                ★
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
