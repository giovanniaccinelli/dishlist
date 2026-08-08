"use client";

function BaseSvg({ className = "", children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function PizzaIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M12 20.2 4.7 6.1c4.7-1.9 9.9-1.9 14.6 0L12 20.2Z" fill="currentColor" fillOpacity="0.13" /><path d="M6.4 8c3.6-1.2 7.6-1.2 11.2 0" /><circle cx="11.8" cy="11.3" r="1" fill="currentColor" /><circle cx="9.3" cy="14" r="1" fill="currentColor" /><circle cx="14.5" cy="14.3" r="1" fill="currentColor" /></BaseSvg>;
}

function PastaIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M8.5 8.9c-.7-.9-.4-1.7.2-2.4.7-.8.8-1.4.1-2.2" /><path d="M12 8.7c-.8-.9-.4-1.8.2-2.5.7-.8.8-1.5.1-2.3" /><path d="M15.4 8.9c-.7-.8-.4-1.6.2-2.3.6-.7.7-1.3.1-2" /><ellipse cx="12" cy="16.2" rx="7.5" ry="4.2" fill="currentColor" fillOpacity="0.1" /><path d="M7.4 15.1c1.1-1.7 2.8-2.5 5.1-2.3 2.1.2 3.6 1.1 4.3 2.4" /><path d="M7.8 16c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0" /></BaseSvg>;
}

function MeatIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M10 6.7c2.4-1.5 5.8-1.1 7.8 1 2.2 2.3 2.1 5.9-.2 8.1-2.1 2-5.3 2.4-7.7.9l-2.1-1.3c-.9-.6-1-1.8-.2-2.5l2.3-2Z" fill="currentColor" fillOpacity="0.13" /><path d="m7.7 15.4-2 2" /><circle cx="4.9" cy="18.3" r="1.1" /><circle cx="6.8" cy="20" r="1.1" /><path d="M14.7 8.6c1.7 1.4 2.1 3.8.8 5.6" /></BaseSvg>;
}

function FishIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.5 12s3.2-5.2 8.2-5.2S20 12 20 12s-2.3 5.2-7.3 5.2S4.5 12 4.5 12Z" fill="currentColor" fillOpacity="0.12" /><path d="m20 12 2-2.5v5L20 12Z" /><circle cx="10.2" cy="11.4" r=".65" fill="currentColor" /><path d="M14.2 7.4c.8 1.2 1.2 2.7 1.2 4.6s-.4 3.4-1.2 4.6" /></BaseSvg>;
}

function SushiIcon({ className = "" }) {
  return <BaseSvg className={className}><rect x="4.5" y="7" width="15" height="10.5" rx="4.2" fill="currentColor" fillOpacity="0.1" /><ellipse cx="12" cy="12.25" rx="4.1" ry="2.65" /><circle cx="12" cy="12.25" r="1.35" fill="currentColor" fillOpacity="0.18" /></BaseSvg>;
}

function NoodlesIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.4 11.8h13.2l-1.4 4.4a4.1 4.1 0 0 1-3.9 2.8h-2.6a4.1 4.1 0 0 1-3.9-2.8l-1.4-4.4Z" fill="currentColor" fillOpacity="0.11" /><path d="M6.4 11.8c1.2 1.3 3.1 2 5.6 2s4.4-.7 5.6-2" /><path d="M16.5 4.4 10.2 12" /><path d="M13 4 7.5 11.6" /></BaseSvg>;
}

function BurgerIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.5 11.2c.4-2.8 2.5-4.5 6.5-4.5s6.1 1.7 6.5 4.5H5.5Z" fill="currentColor" fillOpacity="0.12" /><path d="M5.2 14h13.6" /><path d="M6.4 16.8h11.2" /><path d="M8.2 9.1h.01M11.6 8.5h.01M15 9.2h.01" /></BaseSvg>;
}

function TacoIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.8 16.6c.3-5.1 3.2-8.9 7.2-8.9s6.9 3.8 7.2 8.9H4.8Z" fill="currentColor" fillOpacity="0.12" /><path d="M7.4 14.1c1.1-.6 2.1-.6 3.1 0s2 .6 3 0 2.1-.6 3.1 0" /><path d="M8.7 11.4h.01M12 10.3h.01M15.2 11.5h.01" /></BaseSvg>;
}

function KebabIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M12 4.1v15.8" /><path d="M8.4 7.1c1.5-1.2 5.7-1.2 7.2 0-.7 1.9-6.5 1.9-7.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M7.9 11.3c1.7-1.4 6.5-1.4 8.2 0-.8 2.1-7.4 2.1-8.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M8.6 15.8c1.4-1.1 5.4-1.1 6.8 0-.7 1.8-6.1 1.8-6.8 0Z" fill="currentColor" fillOpacity="0.12" /></BaseSvg>;
}

function SandwichIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.2 10.5 19.8 6v12L4.2 13.5v-3Z" fill="currentColor" fillOpacity="0.1" /><path d="M6.5 11.1h9.2" /><path d="M6.5 13h8.1" /><path d="m19.8 6-3.1 6 3.1 6" /></BaseSvg>;
}

function PlateIcon({ className = "" }) {
  return <BaseSvg className={className}><ellipse cx="12" cy="12" rx="8.2" ry="6.3" fill="currentColor" fillOpacity="0.09" /><ellipse cx="12" cy="12" rx="4.9" ry="3.45" /><path d="M6.9 18.6h10.2" /></BaseSvg>;
}

function DrinkIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M7 4.8h10l-1.1 7.6a3.9 3.9 0 0 1-7.8 0L7 4.8Z" fill="currentColor" fillOpacity="0.1" /><path d="M8.1 8.8h7.8" /><path d="M12 16.3v3.8" /><path d="M8.8 20.1h6.4" /></BaseSvg>;
}

function CoffeeIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.3 8.2h10.8v5.1a4.2 4.2 0 0 1-4.2 4.2H9.5a4.2 4.2 0 0 1-4.2-4.2V8.2Z" fill="currentColor" fillOpacity="0.11" /><path d="M16.1 9.4h1.2a2.3 2.3 0 1 1 0 4.6h-1.2" /><path d="M8.5 4.1c-.7.8-.7 1.6 0 2.4M12 4.1c-.7.8-.7 1.6 0 2.4" /><path d="M6.9 20h10" /></BaseSvg>;
}

function PastryIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.2 13.6c.7-3.4 3.3-5.4 6.8-5.4s6.1 2 6.8 5.4v3.7H5.2v-3.7Z" fill="currentColor" fillOpacity="0.12" /><path d="M5.2 13.6h13.6" /><path d="M8 10.5c1 .7 1.9.7 2.9 0s1.9-.7 2.9 0 1.9.7 2.9 0" /><path d="M7.2 17.3h9.6" /></BaseSvg>;
}

function GelatoIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M8.2 10.3a3.2 3.2 0 0 1 6.2-1.2 2.8 2.8 0 0 1 2.8 2.8c0 1.5-1.2 2.8-2.8 2.8H9.4a2.8 2.8 0 0 1-1.2-5.3Z" fill="currentColor" fillOpacity="0.12" /><path d="m8.4 14.8 3.6 6.1 3.6-6.1" /><path d="M10.1 17.7h3.8" /></BaseSvg>;
}

function StarIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="m12 4.2 2.1 4.5 4.8.6-3.55 3.25.94 4.75L12 14.85 7.71 17.3l.94-4.75L5.1 9.3l4.8-.6L12 4.2Z" fill="currentColor" fillOpacity="0.16" /></BaseSvg>;
}

function BeerIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M6.2 8.3h9.1v10a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2v-10Z" fill="currentColor" fillOpacity="0.11" /><path d="M15.3 10.2h1.4a2.4 2.4 0 0 1 0 4.8h-1.4" /><path d="M8.7 8.3V5.2M12.8 8.3V5.2" /><path d="M8.7 12v4.9M12.8 12v4.9" /></BaseSvg>;
}

export const RESTAURANT_CATEGORY_OPTIONS = [
  { id: "pizza", label: "Pizza", icon: PizzaIcon, fill: "#FF6B4A", stroke: "#C2410C", chip: "bg-[#FFE1D6] text-[#8A2F16] border-[#FF9D7E]" },
  { id: "pasta", label: "Pasta", icon: PastaIcon, fill: "#FBBF24", stroke: "#B45309", chip: "bg-[#FDE68A] text-[#78350F] border-[#F59E0B]" },
  { id: "carne", label: "Carne", icon: MeatIcon, fill: "#EF4444", stroke: "#991B1B", chip: "bg-[#FEE2E2] text-[#7F1D1D] border-[#F87171]" },
  { id: "pesce", label: "Pesce", icon: FishIcon, fill: "#22D3EE", stroke: "#0891B2", chip: "bg-[#CFFAFE] text-[#155E75] border-[#22D3EE]" },
  { id: "sushi", label: "Sushi", icon: SushiIcon, fill: "#34D399", stroke: "#047857", chip: "bg-[#D1FAE5] text-[#065F46] border-[#34D399]" },
  { id: "noodles", label: "Noodles", icon: NoodlesIcon, fill: "#F87171", stroke: "#DC2626", chip: "bg-[#FEE2E2] text-[#7F1D1D] border-[#F87171]" },
  { id: "fast_food", label: "Fast food", icon: BurgerIcon, fill: "#FB7185", stroke: "#BE123C", chip: "bg-[#FFE4E6] text-[#9F1239] border-[#FB7185]" },
  { id: "tacos", label: "Tacos", icon: TacoIcon, fill: "#F97316", stroke: "#C2410C", chip: "bg-[#FFEDD5] text-[#7C2D12] border-[#FB923C]" },
  { id: "kebab", label: "Kebab", icon: KebabIcon, fill: "#A16207", stroke: "#713F12", chip: "bg-[#FEF3C7] text-[#713F12] border-[#D97706]" },
  { id: "street_food", label: "Street food", icon: SandwichIcon, fill: "#F59E0B", stroke: "#B45309", chip: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" },
  { id: "ristorante", label: "Ristorante", icon: PlateIcon, fill: "#A78BFA", stroke: "#6D28D9", chip: "bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]" },
  { id: "bar", label: "Bar", icon: DrinkIcon, fill: "#38BDF8", stroke: "#0284C7", chip: "bg-[#E0F2FE] text-[#075985] border-[#38BDF8]" },
  { id: "caffetteria", label: "Caffetteria", icon: CoffeeIcon, fill: "#A47551", stroke: "#6B3F25", chip: "bg-[#F3E8E2] text-[#6B3F25] border-[#C9A58B]" },
  { id: "pasticceria", label: "Pasticceria", icon: PastryIcon, fill: "#F472B6", stroke: "#BE185D", chip: "bg-[#FCE7F3] text-[#9D174D] border-[#F9A8D4]" },
  { id: "gelateria", label: "Gelateria", icon: GelatoIcon, fill: "#67E8F9", stroke: "#0891B2", chip: "bg-[#ECFEFF] text-[#155E75] border-[#67E8F9]" },
  { id: "gourmet", label: "Gourmet", icon: StarIcon, fill: "#FDE047", stroke: "#A16207", chip: "bg-[#FEF9C3] text-[#854D0E] border-[#FACC15]" },
  { id: "pub", label: "Pub", icon: BeerIcon, fill: "#F59E0B", stroke: "#92400E", chip: "bg-[#FEF3C7] text-[#92400E] border-[#FBBF24]" },
];

const CATEGORY_BY_ID = new Map(RESTAURANT_CATEGORY_OPTIONS.map((category) => [category.id, category]));

export function normalizeRestaurantCategoryId(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_BY_ID.has(normalized) ? normalized : "";
}

export function getRestaurantCategory(value = "") {
  return CATEGORY_BY_ID.get(normalizeRestaurantCategoryId(value)) || null;
}

