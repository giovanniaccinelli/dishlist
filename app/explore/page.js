"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Coins,
  Dumbbell,
  Flame,
  Leaf,
  MoonStar,
  Snowflake,
  Sun,
  Search as SearchIcon,
  Send,
  Sprout,
  Timer,
  Trophy,
  Wheat,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import BottomNav from "../../components/BottomNav";
import { CategoryRowsLoading } from "../../components/AppLoadingState";
import { getAllDishesFromFirestore, getTrendingStoryDishes } from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";

const BASE_LIMIT = 20;
const ROW_PREVIEW_LIMIT = 10;
function PlateIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="7.2" />
      <path d="M3.5 4.5v4.2" />
      <path d="M2.2 4.5v2.3" />
      <path d="M4.8 4.5v2.3" />
      <path d="M3.5 8.7v10.8" />
      <path d="M20.3 4.5c-2.4 1.1-3.6 3-3.6 5.5v1.6" />
      <path d="M20.3 4.5v15" />
    </svg>
  );
}

function BurgerIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5.2 11.2c.8-3 3.7-5 6.8-5s6 2 6.8 5" />
      <path d="M6 12.8h12" />
      <path d="M4.9 15.5h14.2c-.2 2-1.9 3.2-4 3.2H8.9c-2.1 0-3.8-1.2-4-3.2Z" />
      <path d="M7.1 12.8v1.5" />
      <path d="M10.2 12.8v1.5" />
      <path d="M13.8 12.8v1.5" />
      <path d="M16.9 12.8v1.5" />
    </svg>
  );
}

function WalletIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 7.5h12.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M15.5 11.2h4v3.6h-4a1.8 1.8 0 1 1 0-3.6Z" />
      <path d="M6.5 7.5V6.7c0-1 0-1.7.4-2.2.5-.6 1.2-.7 2.4-.7h4.3" />
    </svg>
  );
}

function SteakIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.6 8.7c2.1-3 6.6-4.2 10-2.6 3.9 1.9 5.2 6.7 2.8 10.3-2.2 3.2-6.6 4.4-10.2 2.8a5.8 5.8 0 0 1-2.3-1.8c-2.2-2.6-2.4-6.2-.3-8.7Z" />
      <path d="M15.7 6.5c.8-.9 1.5-1.8 2.6-2.9l1.5 1.5c-1 1.2-1.9 2.1-2.8 2.8" />
      <path d="M16.1 5.9c1 .3 1.9.9 2.5 1.8" />
      <path d="M10.4 10.4c1.2-.7 2.8-.7 3.9 0 1.4.9 1.9 2.9 1 4.4-1 1.5-2.9 2-4.5 1.1-1.5-.9-2-2.8-1.1-4.3.2-.5.4-.9.7-1.2Z" />
      <path d="M17.4 6.5 14.8 9" />
    </svg>
  );
}

function HeartIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 19.4 5.8 13.2a4.3 4.3 0 0 1 0-6.1 4.2 4.2 0 0 1 6 0l.2.2.2-.2a4.2 4.2 0 0 1 6 0 4.3 4.3 0 0 1 0 6.1L12 19.4Z" />
    </svg>
  );
}

function FeatherIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19.9 4.1c-6.7 1.1-11.9 6.3-13 13" />
      <path d="M6.9 17.1c4.2-.9 7.3-4 8.7-8.5" />
      <path d="M4.7 19.3 14.9 9.1" />
      <path d="M9.5 14.5 7.4 12.4" />
      <path d="M11.8 12.2 9.6 10" />
      <path d="M14 10 11.9 7.9" />
    </svg>
  );
}

function NoWheatIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4.5v14.5" />
      <path d="M12 7c-1.3 0-2.5-.8-3.1-2" />
      <path d="M12 9.5c-1.5 0-2.8-.9-3.6-2.2" />
      <path d="M12 12c-1.4 0-2.6-.8-3.3-2" />
      <path d="M12 7c1.3 0 2.5-.8 3.1-2" />
      <path d="M12 9.5c1.5 0 2.8-.9 3.6-2.2" />
      <path d="M12 12c1.4 0 2.6-.8 3.3-2" />
      <path d="M5 19 19 5" stroke="#D72D2D" strokeWidth="2.3" />
    </svg>
  );
}

function CoinStackIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <ellipse cx="7.2" cy="16.8" rx="3" ry="1.5" />
      <path d="M4.2 16.8v1.8c0 .8 1.4 1.5 3 1.5s3-.7 3-1.5v-1.8" />
      <ellipse cx="12.1" cy="12.3" rx="3.2" ry="1.6" />
      <path d="M8.9 12.3v1.9c0 .9 1.4 1.6 3.2 1.6s3.2-.7 3.2-1.6v-1.9" />
      <ellipse cx="17" cy="7.9" rx="3.3" ry="1.7" />
      <path d="M13.7 7.9v2c0 .9 1.5 1.7 3.3 1.7s3.3-.8 3.3-1.7v-2" />
    </svg>
  );
}

function ChiliIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5.4 15.9c0-4 3-7.1 7.1-7.1 2 0 4 .8 5.3 2.2" />
      <path d="M5.4 15.9c0 2.3 1.7 4 4 4 4.7 0 8.3-3 8.3-7.3 0-.9-.2-1.8-.6-2.6" />
      <path d="M13.7 8.6c-.2-1.6.2-3 1.3-4.5" />
      <path d="M15.5 3.9c1 .2 1.8.8 2.3 1.6" />
      <path d="M7.8 19.1c2.5-.4 4.4-1.8 5.9-4.1" />
    </svg>
  );
}

const TAG_DECOR = {
  "high protein": { icon: SteakIcon, iconClass: "text-[#A34723]", pillClass: "bg-[#FDE6D8] text-[#7C2D12] border-[#F2B38D]" },
  comfort: { icon: HeartIcon, iconClass: "text-[#C96A1B]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFE7C7] text-[#8A4B14] border-[#F5C37A]" },
  "carb heavy": { icon: Wheat, iconClass: "text-[#B38717]", pillClass: "bg-[#F8E6B8] text-[#7A5A10] border-[#E5C86D]" },
  quick: { icon: Timer, iconClass: "text-[#1D7FA6]", pillClass: "bg-[#DDF5FF] text-[#124E68] border-[#96D7F2]" },
  cheat: { icon: BurgerIcon, iconClass: "text-[#C6582C]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFD8CC] text-[#8A2F16] border-[#F39B7A]" },
  easy: { icon: Clock3, iconClass: "text-[#6366F1]", pillClass: "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]" },
  fit: { icon: Dumbbell, iconClass: "text-[#1F8A4D]", pillClass: "bg-[#DDF7E7] text-[#17603A] border-[#9FDEB8]" },
  premium: { icon: CoinStackIcon, iconClass: "text-[#C69A00]", pillClass: "bg-[#FFF1B8] text-[#8A6700] border-[#E8C95B]" },
  veg: { icon: Leaf, iconClass: "text-[#33A047]", pillClass: "bg-[#E4F8D9] text-[#236A1C] border-[#A9E08D]" },
  fancy: { icon: PlateIcon, iconClass: "text-[#7C4CC2]", pillClass: "bg-[#F1E8FF] text-[#5C2D91] border-[#CEB5F6]" },
  budget: { icon: WalletIcon, iconClass: "text-[#9B6A4A]", pillClass: "bg-[#F3E8E2] text-[#7A4B35] border-[#D6B6A6]" },
  winter: { icon: Snowflake, iconClass: "text-[#3C89C9]", pillClass: "bg-[#E3F2FF] text-[#1E4F7A] border-[#A9D2F5]" },
  "late night": { icon: MoonStar, iconClass: "text-[#5E54C7]", pillClass: "bg-[#E8E6FF] text-[#3E358C] border-[#B8B2F3]" },
  light: { icon: FeatherIcon, iconClass: "text-[#7C8796]", pillClass: "bg-[#F5F6F8] text-[#505A68] border-[#D5DBE3]" },
  vegan: { icon: Sprout, iconClass: "text-[#2E9E57]", pillClass: "bg-[#E0F7E9] text-[#1F6A3D] border-[#A7E2BE]" },
  "low carb": { icon: NoWheatIcon, iconClass: "text-[#C53A4A]", pillClass: "bg-[#FFE3E0] text-[#8A1F2D] border-[#F3A0A9]" },
  spicy: { icon: ChiliIcon, iconClass: "text-[#D94A2E]", pillClass: "bg-[#FFD7D2] text-[#922B21] border-[#F28A7B]" },
  gourmet: { icon: ChefHat, iconClass: "text-[#8A6A46]", pillClass: "bg-[#F4ECE3] text-[#6D4C2F] border-[#D6C0A8]" },
  summer: { icon: Sun, iconClass: "text-[#D9A400]", pillClass: "bg-[#FFF0BF] text-[#8A5A00] border-[#F0CB68]" },
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
        <span className="text-[1.28rem] font-bold tracking-tight text-black">{row.title}</span>
        <Trophy size={22} strokeWidth={2.2} className="text-[#D7B443]" />
      </div>
    );
  }

  if (row.key === "trending") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[1.28rem] font-bold tracking-tight text-black">{row.title}</span>
        <Flame size={22} strokeWidth={2.2} className="text-[#F26A21]" />
      </div>
    );
  }

  const decor = TAG_DECOR[String(row.rawTag || "").toLowerCase()] || {
    icon: CircleUserRound,
    iconClass: "text-black/55",
    iconSize: "h-[1.3rem] w-[1.3rem]",
    pillClass: getTagChipClass(row.rawTag || row.title, true),
  };
  const Icon = decor.icon;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[1.05rem] font-semibold ${decor.pillClass}`}>
        {row.title}
      </span>
      <Icon className={`${decor.iconSize || "h-[1.3rem] w-[1.3rem]"} shrink-0 ${decor.iconClass}`} />
    </div>
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
