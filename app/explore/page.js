"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleUserRound, Search as SearchIcon, Send, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import BottomNav from "../../components/BottomNav";
import { getAllDishesFromFirestore, getTrendingStoryDishes } from "../lib/firebaseHelpers";
import { TAG_OPTIONS } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";

const BASE_LIMIT = 20;

function TopActionButton({ href, icon: Icon, label }) {
  return (
    <Link
      href={href}
      className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,244,236,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-transform hover:scale-[1.02]"
      aria-label={label}
    >
      <Icon size={18} className="text-black" />
    </Link>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-6">
      <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full pl-11 pr-4 py-3.5 rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] border border-black/10 text-black shadow-[0_12px_30px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-black/15 placeholder:text-black/38"
      />
    </div>
  );
}

function DishPreview({ dish, title }) {
  return (
    <div className="pressable-card relative w-full bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer">
      <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
        <span className="sr-only">Open dish card</span>
      </Link>
      <img
        src={getDishImageUrl(dish)}
        alt={dish.name}
        className="w-full h-32 object-cover"
        onError={(e) => {
          e.currentTarget.src = DEFAULT_DISH_IMAGE;
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none flex flex-col justify-end gap-0.5">
        <div className="text-[11px] font-semibold leading-tight truncate">
          {dish.name || "Untitled dish"}
        </div>
        <div className="text-[10px] text-white/80">saves: {Number(dish.saves || 0)}</div>
      </div>
    </div>
  );
}

function ExploreRow({ title, dishes, onExpand }) {
  const visible = dishes.slice(0, BASE_LIMIT);
  if (!visible.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {dishes.length > 3 ? (
          <button
            type="button"
            onClick={onExpand}
            className="w-10 h-10 rounded-[1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center"
            aria-label={`Open ${title}`}
          >
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((dish) => (
          <div key={`${title}-${dish.id}`} className="snap-start basis-[31.5%] min-w-[31.5%] shrink-0">
            <DishPreview dish={dish} title={title} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpandedCategoryModal({ row, onClose }) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-[#F7F2E8]/95 backdrop-blur-md overflow-y-auto">
      <div className="min-h-screen px-5 pt-6 pb-24 text-black">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{row.title}</h1>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {row.dishes.map((dish) => (
            <div key={`${row.key}-${dish.id}`} className="relative bg-white rounded-2xl overflow-hidden shadow-md">
              <Link href={`/dish/${dish.id}?source=public&mode=single`} className="absolute inset-0 z-10">
                <span className="sr-only">Open dish card</span>
              </Link>
              <img
                src={getDishImageUrl(dish)}
                alt={dish.name}
                className="w-full h-32 object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_DISH_IMAGE;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white pointer-events-none">
                <div className="text-[11px] font-semibold leading-tight truncate">
                  {dish.name || "Untitled dish"}
                </div>
                <div className="text-[10px] text-white/80">saves: {Number(dish.saves || 0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const { user } = useAuth();
  const [allDishes, setAllDishes] = useState([]);
  const [trendingDishes, setTrendingDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);

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
    rows.push({
      key: "most-saved",
      title: "Most Saved",
      dishes: [...basePool].sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0)).slice(0, BASE_LIMIT),
    });

    const trendingPool = term
      ? trendingDishes.filter((dish) => {
          const name = String(dish.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || tags.some((tag) => tag.includes(term));
        })
      : trendingDishes;
    rows.push({
      key: "trending",
      title: "Trending Now",
      dishes: trendingPool.slice(0, BASE_LIMIT),
    });

    TAG_OPTIONS.forEach((tag) => {
      const tagged = basePool.filter(
        (dish) =>
          Array.isArray(dish.tags) &&
          dish.tags.some((dishTag) => String(dishTag).toLowerCase() === String(tag).toLowerCase())
      );
      rows.push({
        key: `tag-${tag}`,
        title: String(tag).replace(/\b\w/g, (char) => char.toUpperCase()),
        dishes: tagged.slice(0, BASE_LIMIT),
      });
    });

    return rows.filter((row) => row.dishes.length > 0);
  }, [allDishes, search, trendingDishes]);

  return (
    <div className="min-h-screen bg-transparent p-6 text-black relative pb-24">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Explore</h1>
        <div className="flex items-center gap-2">
          <TopActionButton href={user ? "/directs" : "/?auth=1"} icon={Send} label="Open directs" />
          <TopActionButton href={user ? "/profile" : "/?auth=1"} icon={CircleUserRound} label="Open profile" />
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search dishes or tags..."
      />

      {loading ? (
        <div className="text-black/60">Loading categories...</div>
      ) : (
        <div>
          {categoryRows.map((row) => (
            <ExploreRow key={row.key} title={row.title} dishes={row.dishes} onExpand={() => setExpandedRow(row)} />
          ))}
        </div>
      )}

      <ExpandedCategoryModal row={expandedRow} onClose={() => setExpandedRow(null)} />
      <BottomNav />
    </div>
  );
}
