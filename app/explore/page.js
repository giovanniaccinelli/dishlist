"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleUserRound, Flame, Search as SearchIcon, Send, Trophy, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import BottomNav from "../../components/BottomNav";
import { CategoryRowsLoading } from "../../components/AppLoadingState";
import { getAllDishesFromFirestore, getTrendingStoryDishes } from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";

const BASE_LIMIT = 20;
const ROW_PREVIEW_LIMIT = 10;
const TAG_DECOR = {
  "high protein": { icon: "🥩", className: "bg-[#FDE6D8] text-[#7C2D12] border-[#F2B38D]" },
  comfort: { icon: "🤤", className: "bg-[#FFE7C7] text-[#8A4B14] border-[#F5C37A]" },
  "carb heavy": { icon: "🌾", className: "bg-[#F8E6B8] text-[#7A5A10] border-[#E5C86D]" },
  quick: { icon: "⏱️", className: "bg-[#DDF5FF] text-[#124E68] border-[#96D7F2]" },
  cheat: { icon: "🍔", className: "bg-[#FFD8CC] text-[#8A2F16] border-[#F39B7A]" },
  easy: { icon: "✨", className: "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]" },
  fit: { icon: "🏋️", className: "bg-[#DDF7E7] text-[#17603A] border-[#9FDEB8]" },
  premium: { icon: "🪙", className: "bg-[#FFF1B8] text-[#8A6700] border-[#E8C95B]" },
  veg: { icon: "🍃", className: "bg-[#E4F8D9] text-[#236A1C] border-[#A9E08D]" },
  fancy: { icon: "🍽️", className: "bg-[#F1E8FF] text-[#5C2D91] border-[#CEB5F6]" },
  budget: { icon: "👛", className: "bg-[#F3E8E2] text-[#7A4B35] border-[#D6B6A6]" },
  winter: { icon: "❄️", className: "bg-[#E3F2FF] text-[#1E4F7A] border-[#A9D2F5]" },
  "late night": { icon: "🌙", className: "bg-[#E8E6FF] text-[#3E358C] border-[#B8B2F3]" },
  light: { icon: "🪶", className: "bg-[#F5F6F8] text-[#505A68] border-[#D5DBE3]" },
  vegan: { icon: "🌱", className: "bg-[#E0F7E9] text-[#1F6A3D] border-[#A7E2BE]" },
  "low carb": { icon: "🚫🌾", className: "bg-[#FFE3E0] text-[#8A1F2D] border-[#F3A0A9]" },
  spicy: { icon: "🌶️", className: "bg-[#FFD7D2] text-[#922B21] border-[#F28A7B]" },
  gourmet: { icon: "👨‍🍳", className: "bg-[#F4ECE3] text-[#6D4C2F] border-[#D6C0A8]" },
  summer: { icon: "☀️", className: "bg-[#FFF0BF] text-[#8A5A00] border-[#F0CB68]" },
};

function TopActionButton({ href, icon: Icon, label, highlighted = false }) {
  return (
    <Link
      href={href}
      className="top-action-btn relative"
      aria-label={label}
    >
      <Icon size={18} className="text-black" />
      {highlighted ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
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
        src={getDishImageUrl(dish, "thumb")}
        alt={dish.name}
        loading="lazy"
        decoding="async"
        className="w-full h-28 object-cover"
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

function CategoryTitle({ row }) {
  if (row.key === "most-saved") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[1.18rem] font-semibold tracking-tight text-black/88">{row.title}</span>
        <Trophy size={19} className="text-[#D7B443]" />
      </div>
    );
  }

  if (row.key === "trending") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[1.18rem] font-semibold tracking-tight text-black/88">{row.title}</span>
        <Flame size={19} className="text-[#F26A21]" />
      </div>
    );
  }

  const decor = TAG_DECOR[String(row.rawTag || "").toLowerCase()] || {
    icon: "•",
    className: getTagChipClass(row.rawTag || row.title, true),
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[1.05rem] font-semibold ${decor.className}`}>
      <span className="text-[1.15rem] leading-none" aria-hidden="true">{decor.icon}</span>
      <span>{row.title}</span>
    </span>
  );
}

function ExploreRow({ row, onExpand }) {
  const { title, dishes } = row;
  const visible = dishes.slice(0, ROW_PREVIEW_LIMIT);
  if (!visible.length) return null;

  return (
    <section className="mb-6" style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}>
      <div className="mb-2.5 flex items-center justify-between">
        <CategoryTitle row={row} />
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
      <div className="min-h-screen px-5 pt-1 pb-24 text-black">
        <div className="app-top-nav -mx-5 mb-6 px-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{row.title}</h1>
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
                src={getDishImageUrl(dish, "thumb")}
                alt={dish.name}
                loading="lazy"
                decoding="async"
                className="w-full h-28 object-cover"
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
  const router = useRouter();
  const { user } = useAuth();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [allDishes, setAllDishes] = useState([]);
  const [trendingDishes, setTrendingDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [selectedTagsDraft, setSelectedTagsDraft] = useState([]);
  const [selectedTagsApplied, setSelectedTagsApplied] = useState([]);
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

  const toggleTagFilter = (tag) => {
    setSelectedTagsDraft((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
  };

  const removeAppliedTag = (tag) => {
    const next = selectedTagsApplied.filter((t) => t !== tag);
    setSelectedTagsApplied(next);
    setSelectedTagsDraft(next);
  };

  const applyTagFilters = () => {
    setSelectedTagsApplied(selectedTagsDraft);
    setShowTagsPicker(false);
  };

  const categoryRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const normalizedSelectedTags = selectedTagsApplied.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean);
    const textFiltered = term
      ? allDishes.filter((dish) => {
          const name = String(dish.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || tags.some((tag) => tag.includes(term));
        })
      : allDishes;
    const basePool =
      normalizedSelectedTags.length === 0
        ? textFiltered
        : textFiltered.filter((dish) => {
            if (!Array.isArray(dish.tags)) return false;
            const dishTags = dish.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean);
            return normalizedSelectedTags.every((tag) => dishTags.includes(tag));
          });

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

    const tagRows = TAG_OPTIONS.map((tag) => {
      const tagged = basePool.filter(
        (dish) =>
          Array.isArray(dish.tags) &&
          dish.tags.some((dishTag) => String(dishTag).toLowerCase() === String(tag).toLowerCase())
      );
      return {
        key: `tag-${tag}`,
        rawTag: tag,
        title: String(tag).replace(/\b\w/g, (char) => char.toUpperCase()),
        dishes: tagged.slice(0, BASE_LIMIT),
        totalCount: tagged.length,
      };
    })
      .filter((row) => row.totalCount > 0)
      .sort((a, b) => b.totalCount - a.totalCount || a.title.localeCompare(b.title));

    rows.push(...tagRows);

    return rows.filter((row) => row.dishes.length > 0);
  }, [allDishes, search, selectedTagsApplied, trendingDishes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const selectedCategory = (new URLSearchParams(window.location.search).get("category") || "").toLowerCase();
    if (!selectedCategory) {
      setExpandedRow(null);
      return;
    }
    const matched = categoryRows.find((row) => row.key.toLowerCase() === selectedCategory);
    if (matched) setExpandedRow(matched);
  }, [categoryRows]);

  const openExpandedRow = (row) => {
    setExpandedRow(row);
    router.replace(`/explore?category=${encodeURIComponent(row.key)}`, { scroll: false });
  };

  const closeExpandedRow = () => {
    setExpandedRow(null);
    router.replace("/explore", { scroll: false });
  };

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Explore</h1>
        <div className="flex items-center gap-2">
          <TopActionButton href={user ? "/directs" : "/?auth=1"} icon={Send} label="Open directs" highlighted={hasUnreadDirects} />
          <TopActionButton href={user ? "/profile" : "/?auth=1"} icon={CircleUserRound} label="Open profile" />
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search dishes or tags..."
      />
      <div className="relative mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          {selectedTagsApplied.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border ${getTagChipClass(tag, true)}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeAppliedTag(tag)}
                className="text-black/70 hover:text-black leading-none"
                aria-label={`Remove ${tag} filter`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedTagsApplied.length === 0 && (
            <span className="text-xs text-black/50">No tag filters selected</span>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedTagsDraft(selectedTagsApplied);
              setShowTagsPicker(true);
            }}
            className="px-3 py-1 rounded-full border border-black bg-black text-white text-xs font-medium"
          >
            Add filters
          </button>
        </div>
        {showTagsPicker && (
          <div className="absolute z-40 mt-2 w-full bg-white border border-black/10 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-black">Select tags</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedTagsDraft(selectedTagsApplied);
                  setShowTagsPicker(false);
                }}
                className="px-3 py-1 rounded-full border border-black/20 text-xs font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const active = selectedTagsDraft.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTagFilter(tag)}
                    className={`px-3 py-1 rounded-full text-xs border ${getTagChipClass(tag, active)}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTagsDraft([])}
                className="px-3 py-2 rounded-full border border-black/20 text-xs font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyTagFilters}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <CategoryRowsLoading />
      ) : (
        <div>
          {categoryRows.map((row) => (
            <ExploreRow key={row.key} row={row} onExpand={() => openExpandedRow(row)} />
          ))}
        </div>
      )}

      <ExpandedCategoryModal row={expandedRow} onClose={closeExpandedRow} />
      <BottomNav />
    </div>
  );
}
