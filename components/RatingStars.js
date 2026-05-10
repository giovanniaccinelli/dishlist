"use client";

function normalizeRating(value) {
  const rating = Number(value) || 0;
  return Math.max(0, Math.min(5, Math.round(rating * 2) / 2));
}

export function RatingStars({ value = 0, onChange, size = "text-[1rem]", className = "", readOnly = false }) {
  const rating = normalizeRating(value);
  const interactive = typeof onChange === "function" && !readOnly;

  const chooseRating = (event, index) => {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const half = event.clientX - rect.left < rect.width / 2 ? 0.5 : 1;
    onChange(index + half);
  };

  if (!interactive && rating <= 0) return null;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-label={rating ? `${rating} stars` : "No rating"}>
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={(event) => chooseRating(event, index)}
            className={`relative inline-flex h-[1.15em] w-[1.05em] items-center justify-center overflow-hidden leading-none ${size} ${
              interactive ? "cursor-pointer" : "cursor-default"
            }`}
            aria-label={interactive ? `Set ${index + 1} stars` : undefined}
          >
            <span className="text-white/24">★</span>
            <span className="absolute inset-y-0 left-0 overflow-hidden text-[#FFC247]" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function normalizeDishRating(value) {
  return normalizeRating(value);
}
