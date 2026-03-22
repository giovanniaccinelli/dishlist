"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { getAllDishesFromFirestore, getTrendingStoryDishes } from "../lib/firebaseHelpers";
import { TAG_OPTIONS } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";

const BASE_LIMIT = 3;
const EXPANDED_LIMIT = 20;

function DishStrip({ title, dishes, expanded, onToggle }) {
  const visible = expanded ? dishes.slice(0, EXPANDED_LIMIT) : dishes.slice(0, BASE_LIMIT);
  if (!visible.length) return null;

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {dishes.length > BASE_LIMIT ? (
          <button
            type="button"
            onClick={onToggle}
            className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center shadow-sm"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          >
            <ChevronRight
              size={18}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : null}
      </div>
      <div className={`grid gap-3 ${expanded ? "grid-cols-3" : "grid-cols-3"}`}>
        {visible.map((dish, index) => (
          <div
            key={`${title}-${dish.id || index}`}
            className="pressable-card bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer relative"
          >
            <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
              <span className="sr-only">Open dish card</span>
            </Link>
            <img
              src={getDishImageUrl(dish)}
              alt={dish.name}
              className="w-full h-28 object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_DISH_IMAGE;
              }}
            />
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
              <div className="text-[11px] font-semibold leading-tight truncate">
                {dish.name || "Untitled dish"}
              </div>
              <div className="text-[10px] text-white/80">
                saves: {Number(dish.saves || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Explore() {
  const [allDishes, setAllDishes] = useState([]);
  const [trendingDishes, setTrendingDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [all, trending] = await Promise.all([
        getAllDishesFromFirestore(),
        getTrendingStoryDishes(20),
      ]);
      setAllDishes(all.filter((dish) => dish.isPublic !== false));
      setTrendingDishes(trending);
      setLoading(false);
    })();
  }, []);

  const categoryRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const basePool = term
      ? allDishes.filter((dish) => {
          const name = String(dish.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || tags.some((tag) => tag.includes(term));
        })
      : allDishes;
    const rows = [];
    const sortedBySaves = [...basePool]
      .sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0))
      .slice(0, EXPANDED_LIMIT);
    rows.push({ key: "most-saved", title: "Most Saved", dishes: sortedBySaves });
    const trendingPool = term
      ? trendingDishes.filter((dish) => {
          const name = String(dish.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || tags.some((tag) => tag.includes(term));
        })
      : trendingDishes;
    rows.push({ key: "trending", title: "Trending Now", dishes: trendingPool.slice(0, EXPANDED_LIMIT) });

    TAG_OPTIONS.forEach((tag) => {
      const tagged = basePool.filter((dish) =>
        Array.isArray(dish.tags) && dish.tags.some((dishTag) => String(dishTag).toLowerCase() === String(tag).toLowerCase())
      );
      rows.push({
        key: `tag-${tag}`,
        title: String(tag).replace(/\b\w/g, (char) => char.toUpperCase()),
        dishes: tagged.slice(0, EXPANDED_LIMIT),
      });
    });

    return rows.filter((row) => row.dishes.length > 0);
  }, [allDishes, search, trendingDishes]);

  return (
    <div className="min-h-screen bg-transparent p-6 text-black relative pb-24">
      <h1 className="text-3xl font-bold mb-5">Explore</h1>
      <input
        type="text"
        placeholder="Search dishes or tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-6 rounded-xl bg-white border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/30"
      />
      {loading ? (
        <div className="text-black/60">Loading categories...</div>
      ) : (
        <div>
          {categoryRows.map((row) => (
            <DishStrip
              key={row.key}
              title={row.title}
              dishes={row.dishes}
              expanded={Boolean(expandedSections[row.key])}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  [row.key]: !prev[row.key],
                }))
              }
            />
          ))}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
