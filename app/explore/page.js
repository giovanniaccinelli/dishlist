"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Camera,
  Fish,
  Globe2,
  Leaf,
  MoonStar,
  Snowflake,
  Sun,
  Search as SearchIcon,
  Send,
  Sprout,
  Timer,
  Trophy,
  Users,
  Wheat,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import BottomNav from "../../components/BottomNav";
import { CategoryRowsLoading } from "../../components/AppLoadingState";
import { getAllDishesFromFirestore, getTrendingStoryDishes } from "../lib/firebaseHelpers";
import { TAG_OPTIONS, getDarkTagChipClass, getTagChipClass } from "../lib/tags";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import { getRestaurantDishGroups } from "../lib/restaurants";
import MapPreview from "../../components/MapPreview";
import DishRatingBadge from "../../components/DishRatingBadge";
import {
  dishModeMatches,
  DISH_MODE_ALL,
  DISH_MODE_COOKING,
  DISH_MODE_RESTAURANT,
  DishModeFilterButton,
  DishModeFilterModal,
  RestaurantMapIcon,
  usePersistentDishMode,
} from "../../components/DishModeControls";
import { useLanguage } from "../../components/LanguageProvider";

const BASE_LIMIT = 20;
const ROW_PREVIEW_LIMIT = 10;
const TAP_MOVE_THRESHOLD = 10;

function toTitleCase(value = "") {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SafeDishOpenButton({ href, label }) {
  const router = useRouter();
  const pointerStartRef = useRef(null);
  const movedRef = useRef(false);

  const resetPointer = () => {
    pointerStartRef.current = null;
    movedRef.current = false;
  };

  const handlePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current || movedRef.current) return;
    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) {
      movedRef.current = true;
    }
  };

  const handlePointerUp = () => {
    if (!movedRef.current) {
      router.push(href);
    }
    resetPointer();
  };

  return (
    <button
      type="button"
      className="absolute inset-0 z-10 cursor-pointer bg-transparent"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetPointer}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
    />
  );
}

function PlateIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <ellipse cx="12" cy="12" rx="8.4" ry="6.5" />
      <ellipse cx="12" cy="12" rx="5.3" ry="3.9" />
      <path d="M6.8 18.9h10.4" />
    </svg>
  );
}

function PastaPlateIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="17.1" rx="8" ry="3.3" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.9 16.2c.9-2.2 2.7-3.5 5.1-3.5s4.2 1.2 5.1 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.3 15.7c.9.8 1.8.8 2.7 0 .8-.8 1.8-.8 2.7 0 .8.8 1.7.8 2.6 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M8.1 13.9c1.2-1 2.5-1.2 3.8-.4 1.4.8 2.7.7 4-.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M8.8 11.6c2.2-1.3 4.3-1.4 6.4-.1" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M9.8 10.2 9.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 9.8 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.2 10.2 14.8 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ItalianFlagIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="5.2" width="17" height="13.6" rx="2.4" fill="#fff" />
      <path d="M5.9 5.2h4.25v13.6H5.9a2.4 2.4 0 0 1-2.4-2.4V7.6a2.4 2.4 0 0 1 2.4-2.4Z" fill="#229246" />
      <path d="M13.85 5.2h4.25a2.4 2.4 0 0 1 2.4 2.4v8.8a2.4 2.4 0 0 1-2.4 2.4h-4.25V5.2Z" fill="#CE2B37" />
      <rect x="3.5" y="5.2" width="17" height="13.6" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.28" />
    </svg>
  );
}

function FriedIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7.1 8.2h9.8l-1.1 10.2a2 2 0 0 1-2 1.8H10.2a2 2 0 0 1-2-1.8L7.1 8.2Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.2 8.2 7.4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.1 8.2 10.8 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 8.2 14.4 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.7 8.2 17.5 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.2 12.2h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function DeliveryScooterIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.2 13.7h8.7l2.1-4h2.2c1.6 0 2.9 1.3 2.9 2.9v1.1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 8.2h6.9v5.5H4.8l1.4-5.5Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="M15.3 9.7V7h3.1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.1 6.1h6.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <circle cx="7.1" cy="17" r="2.15" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="17" r="2.15" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9.3 17h6.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M6.3 17h1.6M17.2 17h1.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function DessertIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 11.2h12l-1.1 6.3a2.4 2.4 0 0 1-2.4 2H9.5a2.4 2.4 0 0 1-2.4-2L6 11.2Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7.5 11.2c.8-2.5 2.3-3.8 4.5-3.8s3.7 1.3 4.5 3.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="6.2" r="1.3" fill="currentColor" />
      <path d="M8.8 14.3h6.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function AmericanFlagIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="5.2" width="17" height="13.6" rx="2.4" fill="#fff" />
      <path d="M3.5 7.4h17M3.5 10h17M3.5 12.6h17M3.5 15.2h17M3.5 17.8h17" stroke="#B22234" strokeWidth="1.2" />
      <path d="M5.9 5.2h6.1v6.7H3.5V7.6a2.4 2.4 0 0 1 2.4-2.4Z" fill="#3C3B6E" />
      <path d="M5.2 7.1h.01M7.1 7.1h.01M9 7.1h.01M10.9 7.1h.01M6.1 9h.01M8 9h.01M9.9 9h.01" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="3.5" y="5.2" width="17" height="13.6" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.28" />
    </svg>
  );
}

function RiceIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="12" rx="3.4" ry="8.2" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.25" transform="rotate(38 12 12)" />
      <ellipse cx="9.2" cy="14.1" rx="2.1" ry="5.1" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.05" transform="rotate(58 9.2 14.1)" opacity="0.95" />
      <ellipse cx="14.9" cy="9.7" rx="1.75" ry="4.6" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.05" transform="rotate(39 14.9 9.7)" opacity="0.9" />
    </svg>
  );
}

function FastFoodIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.7 11.5h9.9c-.4-2.8-2.2-4.5-5-4.5s-4.5 1.7-4.9 4.5Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.65" />
      <path d="M5.4 14.2h10.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M6.4 16.8h8.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M18.2 7.2h2.2l-1 12.1h-3l-1-12.1h2.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 4.4h3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FancyPlateIcon({ className = "" }) {
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

function PizzaSliceIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M11.9 20.1 4.4 6.2c4.8-2 10.2-2 15 0l-7.5 13.9Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M6.3 8c3.7-1.3 7.7-1.3 11.4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="11.9" cy="11.3" r="1.15" fill="currentColor" />
      <circle cx="9.2" cy="14.1" r="1.15" fill="currentColor" />
      <circle cx="14.5" cy="14.4" r="1.15" fill="currentColor" />
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

function DrumstickIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M10.2 6.8c2.4-1.5 5.7-1.2 7.8.8 2.2 2.2 2.3 5.7.2 8-2 2.2-5.3 2.7-7.9 1.2l-2.4-1.5c-.9-.5-1-1.8-.2-2.5l2.5-2.1Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.95"
        strokeLinejoin="round"
      />
      <path d="M7.8 15.4 5.9 17.3" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" />
      <circle cx="5" cy="18.2" r="1.15" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="6.9" cy="20" r="1.15" stroke="currentColor" strokeWidth="1.85" />
      <path d="M15 8.6c1.9 1.5 2.5 4.2 1.1 6.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" opacity="0.9" />
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

function ClinkingGlassesIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7.1 4.8h4.4L10.8 9a3 3 0 0 1-3 .1L7.1 4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 4.8h4.4l-.7 4.3a3 3 0 0 1-3-.1l-.7-4.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.4 9.1v7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.6 9.1v7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.8 18.2h3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 18.2h3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.4 7.1 13.6 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.4 4.8 13.6 7.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <ellipse cx="7.2" cy="15.1" rx="4.1" ry="1.8" />
      <path d="M3.1 15.1v2.8c0 1 1.8 1.8 4.1 1.8s4.1-.8 4.1-1.8v-2.8" />
      <ellipse cx="12.6" cy="10.2" rx="4.2" ry="1.9" />
      <path d="M8.4 10.2V13c0 1 1.9 1.9 4.2 1.9s4.2-.9 4.2-1.9v-2.8" />
      <ellipse cx="17.7" cy="5.7" rx="4.2" ry="1.9" />
      <path d="M13.5 5.7v2.8c0 1 1.9 1.9 4.2 1.9s4.2-.9 4.2-1.9V5.7" />
    </svg>
  );
}

function ChiliIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.2 15.9c0-4.5 3.1-7.4 7.5-7.4 1.3 0 2.5.3 3.6.9-.2 5.4-3.8 9.3-8.8 9.3-1.5 0-2.3-1.1-2.3-2.8Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.95"
        strokeLinejoin="round"
      />
      <path d="M15.5 8.5c-.2-1.6.3-2.9 1.4-4.1" stroke="#2E9E57" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.8 8.5c1-.3 1.9-.2 2.8.3" stroke="#2E9E57" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const TAG_DECOR = {
  "high protein": { icon: DrumstickIcon, iconClass: "text-[#A34723]", pillClass: "bg-[#FDE6D8] text-[#7C2D12] border-[#F2B38D]" },
  comfort: { icon: HeartIcon, iconClass: "text-[#C96A1B]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFE7C7] text-[#8A4B14] border-[#F5C37A]" },
  "carb heavy": { icon: Wheat, iconClass: "text-[#B38717]", pillClass: "bg-[#F8E6B8] text-[#7A5A10] border-[#E5C86D]" },
  quick: { icon: Timer, iconClass: "text-[#1D7FA6]", pillClass: "bg-[#DDF5FF] text-[#124E68] border-[#96D7F2]" },
  cheat: { icon: PizzaSliceIcon, iconClass: "text-[#C6582C]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFD8CC] text-[#8A2F16] border-[#F39B7A]" },
  easy: { icon: Check, iconClass: "text-[#6366F1]", pillClass: "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]" },
  fit: { icon: Dumbbell, iconClass: "text-[#1F8A4D]", pillClass: "bg-[#DDF7E7] text-[#17603A] border-[#9FDEB8]" },
  premium: { icon: CoinStackIcon, iconClass: "text-[#C69A00]", pillClass: "bg-[#FFF1B8] text-[#8A6700] border-[#E8C95B]" },
  veg: { icon: Leaf, iconClass: "text-[#33A047]", pillClass: "bg-[#E4F8D9] text-[#236A1C] border-[#A9E08D]" },
  fancy: { icon: FancyPlateIcon, iconClass: "text-[#7C4CC2]", pillClass: "bg-[#F1E8FF] text-[#5C2D91] border-[#CEB5F6]" },
  budget: { icon: WalletIcon, iconClass: "text-[#9B6A4A]", pillClass: "bg-[#F3E8E2] text-[#7A4B35] border-[#D6B6A6]" },
  winter: { icon: Snowflake, iconClass: "text-[#3C89C9]", pillClass: "bg-[#E3F2FF] text-[#1E4F7A] border-[#A9D2F5]" },
  "late night": { icon: MoonStar, iconClass: "text-[#5E54C7]", pillClass: "bg-[#E8E6FF] text-[#3E358C] border-[#B8B2F3]" },
  light: { icon: PlateIcon, iconClass: "text-[#7C8796]", pillClass: "bg-[#F5F6F8] text-[#505A68] border-[#D5DBE3]" },
  vegan: { icon: Sprout, iconClass: "text-[#2E9E57]", pillClass: "bg-[#E0F7E9] text-[#1F6A3D] border-[#A7E2BE]" },
  "low carb": { icon: NoWheatIcon, iconClass: "text-[#C53A4A]", pillClass: "bg-[#FFE3E0] text-[#8A1F2D] border-[#F3A0A9]" },
  spicy: { icon: ChiliIcon, iconClass: "text-[#D94A2E]", pillClass: "bg-[#FFD7D2] text-[#922B21] border-[#F28A7B]" },
  gourmet: { icon: ChefHat, iconClass: "text-[#8A6A46]", pillClass: "bg-[#F4ECE3] text-[#6D4C2F] border-[#D6C0A8]" },
  summer: { icon: Sun, iconClass: "text-[#D9A400]", pillClass: "bg-[#FFF0BF] text-[#8A5A00] border-[#F0CB68]" },
  "date night": { icon: ClinkingGlassesIcon, iconClass: "text-[#B13D56]", pillClass: "bg-[#FFE3EA] text-[#8E2338] border-[#F2A7B8]" },
  pasta: { icon: PastaPlateIcon, iconClass: "text-[#D99116]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FDE68A] text-[#78350F] border-[#F59E0B]" },
  italian: { icon: ItalianFlagIcon, iconClass: "text-black/50", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#DCFCE7] text-[#14532D] border-[#EF4444]" },
  ethnic: { icon: Globe2, iconClass: "text-[#3B82F6]", pillClass: "bg-[#DBEAFE] text-[#1E3A8A] border-[#60A5FA]" },
  seafood: { icon: Fish, iconClass: "text-[#0891B2]", pillClass: "bg-[#CFFAFE] text-[#155E75] border-[#22D3EE]" },
  aesthetic: { icon: Camera, iconClass: "text-[#DB2777]", pillClass: "bg-[#FCE7F3] text-[#831843] border-[#F472B6]" },
  fresh: { icon: null, pillClass: "bg-[#D1FAE5] text-[#065F46] border-[#34D399]" },
  asian: { icon: null, pillClass: "bg-[#FEE2E2] text-[#7F1D1D] border-[#F87171]" },
  fried: { icon: FriedIcon, iconClass: "text-[#C46A1A]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFEDD5] text-[#7C2D12] border-[#FB923C]" },
  delivery: { icon: DeliveryScooterIcon, iconClass: "text-[#0EA5E9]", iconSize: "h-[1.55rem] w-[1.55rem]", pillClass: "bg-[#E0F2FE] text-[#075985] border-[#38BDF8]" },
  dessert: { icon: DessertIcon, iconClass: "text-[#DB2777]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FCE7F3] text-[#9D174D] border-[#F9A8D4]" },
  american: { icon: AmericanFlagIcon, iconClass: "text-black/50", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#DBEAFE] text-[#1E3A8A] border-[#EF4444]" },
  rice: { icon: RiceIcon, iconClass: "text-[#C8A31B]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FEFCE8] text-[#713F12] border-[#FDE047]" },
  "fast food": { icon: FastFoodIcon, iconClass: "text-[#E11D48]", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#FFE4E6] text-[#9F1239] border-[#FB7185]" },
};

function TopActionButton({ href, icon: Icon, label, highlighted = false }) {
  return (
    <Link
      href={href}
      className="top-action-btn relative"
      aria-label={label}
    >
      <Icon size={18} className="text-black" />
      {highlighted ? <span className="no-accent-border absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
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

function DishPreview({ dish, title, t }) {
  return (
    <div className={`explore-dish-preview pressable-card relative w-full bg-white rounded-2xl overflow-hidden cursor-pointer border-2 shadow-none ${String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"}`}>
      <SafeDishOpenButton href={`/dish/${dish.id}?source=public&mode=single`} label="Open dish card" />
      <DishRatingBadge dish={dish} />
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
                  {dish.name || t("Untitled dish")}
                </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-white/80">
          <Users size={10} strokeWidth={2.2} />
          <span>{Math.max(0, Number(dish.saves || 0))}</span>
        </div>
      </div>
    </div>
  );
}

function CategoryTitle({ row, t, darkMode = false }) {
  if (row.key.startsWith("restaurant-")) {
    return (
      <span className={`text-[1.28rem] font-bold tracking-tight ${darkMode ? "text-white" : "text-black"}`}>{row.title}</span>
    );
  }

  if (row.key === "most-saved") {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[1.28rem] font-bold tracking-tight ${darkMode ? "text-white" : "text-black"}`}>{toTitleCase(t(row.title))}</span>
        <Trophy size={22} strokeWidth={2.2} className="text-[#D7B443]" />
      </div>
    );
  }

  if (row.key === "trending") {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[1.28rem] font-bold tracking-tight ${darkMode ? "text-white" : "text-black"}`}>{toTitleCase(t(row.title))}</span>
        <Flame size={22} strokeWidth={2.2} className="text-[#F26A21]" />
      </div>
    );
  }

  const decor = TAG_DECOR[String(row.rawTag || "").toLowerCase()] || {
    icon: Users,
    iconClass: "text-black/55",
    iconSize: "h-[1.3rem] w-[1.3rem]",
    pillClass: getTagChipClass(row.rawTag || row.title, true),
  };
  const Icon = decor.icon;
  const darkPillClass = getDarkTagChipClass(row.rawTag || row.title, true);

  const displayTitle = toTitleCase(t(String(row.rawTag || row.title || "")));
  return (
    <div className="flex items-center gap-2">
      <span className={`explore-category-pill no-accent-border inline-flex items-center rounded-full border px-4 py-1.5 text-[1.05rem] font-semibold ${
        darkMode ? darkPillClass : decor.pillClass
      }`}>
        {displayTitle}
      </span>
      {Icon ? <Icon className={`${decor.iconSize || "h-[1.3rem] w-[1.3rem]"} shrink-0 ${decor.iconClass || ""}`} /> : null}
    </div>
  );
}

function ExploreRow({ row, onExpand, t, darkMode = false }) {
  const { title, dishes } = row;
  if (row.type === "map") {
    return (
      <section className="explore-row no-accent-border mb-6 shadow-none">
        <div className="no-accent-border mb-2.5 flex items-center justify-between shadow-none">
          <button type="button" onClick={onExpand} className="no-accent-border min-w-0 bg-transparent text-left" aria-label="Open map">
            <div className="flex items-center gap-2 leading-none">
              <span className="explore-category-pill no-accent-border inline-flex items-center rounded-full border border-transparent bg-transparent px-0 py-1.5 text-[1.35rem] font-bold leading-none text-white">
                {t(title)}
              </span>
              <RestaurantMapIcon className="h-[1.3rem] w-[1.3rem] shrink-0 self-center text-[#E64646]" strokeWidth={2.05} />
            </div>
          </button>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className={`no-accent-border relative block h-[7.25rem] w-full overflow-hidden rounded-[1.35rem] border text-left shadow-[0_12px_28px_rgba(0,0,0,0.12)] ${
            darkMode ? "border-white/10 bg-[#121212]" : "border-black/10 bg-[#F2EFE8]"
          }`}
          aria-label="Open map"
        >
          <MapPreview />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </button>
      </section>
    );
  }
  const visible = dishes.slice(0, ROW_PREVIEW_LIMIT);
  if (!visible.length) return null;
  const isRestaurantRow = row.key.startsWith("restaurant-");

  return (
    <section className="explore-row no-accent-border mb-6 shadow-none" style={{ contentVisibility: "auto", containIntrinsicSize: "180px", boxShadow: "none" }}>
      <div className="no-accent-border mb-2.5 flex items-center justify-between shadow-none">
        {isRestaurantRow ? (
          <button
            type="button"
            onClick={() => {
              if (!row.placeId) return;
              window.location.href = `/map?placeId=${encodeURIComponent(row.placeId)}`;
            }}
            className="no-accent-border min-w-0 bg-transparent text-left"
            aria-label={`Open ${title} on map`}
          >
            <CategoryTitle row={row} t={t} darkMode={darkMode} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onExpand}
            className="no-accent-border min-w-0 bg-transparent text-left"
            aria-label={`Open ${title}`}
          >
            <CategoryTitle row={row} t={t} darkMode={darkMode} />
          </button>
        )}
        {dishes.length > 3 ? (
          <button
            type="button"
            onClick={onExpand}
            className="explore-expand-btn no-accent-border w-10 h-10 rounded-[1rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,241,232,0.96)_100%)] flex items-center justify-center"
            aria-label={`Open ${title}`}
          >
            <ChevronRight size={18} className="rotate-90" />
          </button>
        ) : null}
      </div>
      <div className="no-accent-border flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory shadow-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((dish) => (
          <div key={`${title}-${dish.id}`} className="snap-start basis-[31.5%] min-w-[31.5%] shrink-0">
            <DishPreview dish={dish} title={title} t={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpandedCategoryModal({ row, onClose, t, darkMode = false }) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-[#F7F2E8]/95 backdrop-blur-md overflow-y-auto">
      <div className="min-h-screen px-5 pt-1 pb-24 text-black">
        <div className="app-top-nav -mx-5 mb-6 px-5 flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <CategoryTitle row={row} t={t} darkMode={darkMode} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {row.dishes.map((dish) => (
            <div key={`${row.key}-${dish.id}`} className={`relative bg-white rounded-2xl overflow-hidden shadow-md border-2 ${String(dish?.dishMode || "").toLowerCase() === "restaurant" ? "restaurant-accent-border" : "default-accent-border"}`}>
              <SafeDishOpenButton href={`/dish/${dish.id}?source=public&mode=single`} label="Open dish card" />
              <DishRatingBadge dish={dish} />
              <img
                src={getDishImageUrl(dish, "thumb")}
                alt={dish.name}
                loading="lazy"
                decoding="async"
                className="w-full h-40 object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_DISH_IMAGE;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 via-55% to-transparent px-2 py-2.5 text-white pointer-events-none flex min-h-[58%] flex-col justify-end">
                <div className="text-[11px] font-semibold leading-tight truncate">
                  {dish.name || t("Untitled dish")}
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] text-white/80">
                  <Users size={10} strokeWidth={2.2} />
                  <span>{Math.max(0, Number(dish.saves || 0))}</span>
                </div>
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
  const { t, darkMode } = useLanguage();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [allDishes, setAllDishes] = useState([]);
  const [trendingDishes, setTrendingDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [selectedTagsDraft, setSelectedTagsDraft] = useState([]);
  const [selectedTagsApplied, setSelectedTagsApplied] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [dishModeFilterOpen, setDishModeFilterOpen] = useState(false);
  const [selectedDishMode, setSelectedDishMode] = usePersistentDishMode("dish-mode:explore", DISH_MODE_ALL);

  const buildExploreUrl = (overrides = {}) => {
    const params = new URLSearchParams();
    const nextSearch = typeof overrides.search === "string" ? overrides.search : search;
    const nextCategory = Object.prototype.hasOwnProperty.call(overrides, "category")
      ? overrides.category
      : expandedRow?.key || "";
    if (String(nextSearch || "").trim()) {
      params.set("q", String(nextSearch).trim());
    }
    if (String(nextCategory || "").trim()) {
      params.set("category", String(nextCategory).trim());
    }
    const query = params.toString();
    return query ? `/explore?${query}` : "/explore";
  };

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
          const restaurantName = String(dish?.restaurant?.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || restaurantName.includes(term) || tags.some((tag) => tag.includes(term));
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
    const modePool = basePool.filter((dish) => dishModeMatches(dish, selectedDishMode));

    if (selectedDishMode === DISH_MODE_RESTAURANT) {
      const restaurantRows = getRestaurantDishGroups(modePool)
        .map((group) => ({
          key: `restaurant-${group.placeId}`,
          title: group.name,
          rawTag: group.name,
          placeId: group.placeId,
          dishes: [...(group.dishes || [])].sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0)),
          totalCount: group.dishes?.length || 0,
          totalSaves: (group.dishes || []).reduce((sum, dish) => sum + Math.max(0, Number(dish?.saves || 0)), 0),
        }))
        .sort((a, b) => b.totalCount - a.totalCount || b.totalSaves - a.totalSaves || a.title.localeCompare(b.title));
      return [
        {
          key: "map",
          type: "map",
          title: "Mappa",
          dishes: [{}],
        },
        ...restaurantRows,
      ];
    }

    const rows = [];
    if (selectedDishMode !== DISH_MODE_COOKING) {
      rows.push({
        key: "map",
        type: "map",
        title: "Mappa",
        dishes: [{}],
      });
    }
    rows.push({
      key: "most-saved",
      title: "Most Saved",
      dishes: [...modePool].sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0)).slice(0, BASE_LIMIT),
    });

    const trendingPool = term
      ? trendingDishes.filter((dish) => {
          const name = String(dish.name || "").toLowerCase();
          const tags = Array.isArray(dish.tags) ? dish.tags.map((tag) => String(tag).toLowerCase()) : [];
          return name.includes(term) || tags.some((tag) => tag.includes(term));
        })
      : trendingDishes;
    const filteredTrendingPool = trendingPool.filter((dish) => dishModeMatches(dish, selectedDishMode));
    rows.push({
      key: "trending",
      title: "Trending Now",
      dishes: filteredTrendingPool.slice(0, BASE_LIMIT),
    });

    const tagRows = TAG_OPTIONS.map((tag) => {
      const tagged = modePool.filter(
        (dish) =>
          Array.isArray(dish.tags) &&
          dish.tags.some((dishTag) => String(dishTag).toLowerCase() === String(tag).toLowerCase())
      );
      return {
        key: `tag-${tag}`,
        rawTag: tag,
        title: String(tag),
        dishes: [...tagged].sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0)).slice(0, BASE_LIMIT),
        totalCount: tagged.length,
      };
    })
      .filter((row) => row.totalCount > 0)
        .sort((a, b) => b.totalCount - a.totalCount || t(a.title).localeCompare(t(b.title)));

    rows.push(...tagRows);

    return rows.filter((row) => row.dishes.length > 0);
  }, [allDishes, search, selectedDishMode, selectedTagsApplied, t, trendingDishes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("q") || "";
    setSearch(initialSearch);
  }, []);

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
    if (row?.type === "map") {
      router.push("/map");
      return;
    }
    setExpandedRow(row);
    router.replace(buildExploreUrl({ category: row.key }), { scroll: false });
  };

  const closeExpandedRow = () => {
    setExpandedRow(null);
    router.replace(buildExploreUrl({ category: "" }), { scroll: false });
  };

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 grid grid-cols-[1fr_auto_1fr] items-center relative">
        <h1 className="justify-self-start text-2xl font-bold">{t("Explore")}</h1>
        <div className="justify-self-center">
          <DishModeFilterButton value={selectedDishMode} onSelect={setSelectedDishMode} />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <TopActionButton href={user ? "/directs" : "/?auth=1"} icon={Send} label="Open directs" highlighted={hasUnreadDirects} />
        </div>
      </div>
      <SearchBar
        value={search}
        onChange={(e) => {
          const nextValue = e.target.value;
          setSearch(nextValue);
          router.replace(buildExploreUrl({ search: nextValue }), { scroll: false });
        }}
        placeholder={t("Search dishes or tags")}
      />
      <div className="relative mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          {selectedTagsApplied.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border ${darkMode ? getDarkTagChipClass(tag, true) : getTagChipClass(tag, true)}`}
            >
              {t(tag)}
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
            <span className="text-xs text-black/50">{t("No tag filters selected")}</span>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedTagsDraft(selectedTagsApplied);
              setShowTagsPicker(true);
            }}
            className="px-3 py-1 rounded-full border border-black bg-black text-white text-xs font-medium"
          >
            {t("Add filters")}
          </button>
        </div>
        {showTagsPicker && (
          <div className="absolute z-40 mt-2 w-full bg-white border border-black/10 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-black">{t("Select tags")}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedTagsDraft(selectedTagsApplied);
                  setShowTagsPicker(false);
                }}
                className="px-3 py-1 rounded-full border border-black/20 text-xs font-medium"
              >
                {t("Close")}
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
                    className={`px-3 py-1 rounded-full text-xs border ${darkMode ? getDarkTagChipClass(tag, active) : getTagChipClass(tag, active)}`}
                  >
                    {t(tag)}
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
                {t("Clear")}
              </button>
              <button
                type="button"
                onClick={applyTagFilters}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-semibold"
              >
                {t("Done")}
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
            <ExploreRow key={row.key} row={row} onExpand={() => openExpandedRow(row)} t={t} darkMode={darkMode} />
          ))}
        </div>
      )}

      <ExpandedCategoryModal row={expandedRow} onClose={closeExpandedRow} t={t} darkMode={darkMode} />
      <DishModeFilterModal
        open={dishModeFilterOpen}
        value={selectedDishMode}
        onClose={() => setDishModeFilterOpen(false)}
        onSelect={(mode) => {
          setSelectedDishMode(mode);
          setDishModeFilterOpen(false);
        }}
      />
      <BottomNav />
    </div>
  );
}
