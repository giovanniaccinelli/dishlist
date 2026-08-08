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
  return <BaseSvg className={className}><path d="M5.3 12.2c.4-4.1 3.4-6.9 7.1-6.9 3.5 0 6.3 2.3 6.3 5.6 0 4.2-3.5 7.8-8.2 7.8-3.2 0-5.5-2.5-5.2-6.5Z" fill="currentColor" fillOpacity="0.13" /><path d="M9.2 11.4c.7-1.5 1.9-2.3 3.5-2.3 1.5 0 2.7.9 2.7 2.2 0 1.8-1.7 3.4-3.8 3.4-1.7 0-2.9-1.3-2.4-3.3Z" /><path d="M6.9 15.9c3.5 1.4 7.3.3 10.3-3" /></BaseSvg>;
}

function FishIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.5 12s3.2-5.2 8.2-5.2S20 12 20 12s-2.3 5.2-7.3 5.2S4.5 12 4.5 12Z" fill="currentColor" fillOpacity="0.12" /><path d="m20 12 2-2.5v5L20 12Z" /><circle cx="10.2" cy="11.4" r=".65" fill="currentColor" /><path d="M14.2 7.4c.8 1.2 1.2 2.7 1.2 4.6s-.4 3.4-1.2 4.6" /></BaseSvg>;
}

function SushiIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.2 13.5c0-2.9 3.1-5.2 6.8-5.2s6.8 2.3 6.8 5.2-3.1 5.2-6.8 5.2-6.8-2.3-6.8-5.2Z" fill="currentColor" fillOpacity="0.1" /><path d="M6.2 11.8c1.4-2.3 3.4-3.6 5.8-3.6s4.4 1.3 5.8 3.6" /><path d="M8.2 11.6h7.6c.9 0 1.6.7 1.6 1.6v.2c0 .9-.7 1.6-1.6 1.6H8.2c-.9 0-1.6-.7-1.6-1.6v-.2c0-.9.7-1.6 1.6-1.6Z" fill="currentColor" fillOpacity="0.14" /><path d="M9.7 15.4c1.5.6 3.1.6 4.6 0" /></BaseSvg>;
}

function NoodlesIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.4 11.8h13.2l-1.4 4.4a4.1 4.1 0 0 1-3.9 2.8h-2.6a4.1 4.1 0 0 1-3.9-2.8l-1.4-4.4Z" fill="currentColor" fillOpacity="0.11" /><path d="M6.4 11.8c1.2 1.3 3.1 2 5.6 2s4.4-.7 5.6-2" /><path d="M16.5 4.4 10.2 12" /><path d="M13 4 7.5 11.6" /></BaseSvg>;
}

function BurgerIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.5 11.2c.4-2.8 2.5-4.5 6.5-4.5s6.1 1.7 6.5 4.5H5.5Z" fill="currentColor" fillOpacity="0.12" /><path d="M5.2 14h13.6" /><path d="M6.4 16.8h11.2" /><path d="M8.2 9.1h.01M11.6 8.5h.01M15 9.2h.01" /></BaseSvg>;
}

function TacoIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.7 16.7c.25-5.2 3.25-9 7.3-9s7.05 3.8 7.3 9H4.7Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.2 16.7c.6-3.6 2.8-6.1 5.8-6.1s5.2 2.5 5.8 6.1" /><path d="M8 14.2c1-.6 1.9-.6 2.9 0s2 .6 3 0 1.9-.6 2.9 0" /><path d="M8.6 11.7h.01M12 10.8h.01M15.4 11.8h.01" /></BaseSvg>;
}

function KebabIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M12 4.1v15.8" /><path d="M8.4 7.1c1.5-1.2 5.7-1.2 7.2 0-.7 1.9-6.5 1.9-7.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M7.9 11.3c1.7-1.4 6.5-1.4 8.2 0-.8 2.1-7.4 2.1-8.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M8.6 15.8c1.4-1.1 5.4-1.1 6.8 0-.7 1.8-6.1 1.8-6.8 0Z" fill="currentColor" fillOpacity="0.12" /></BaseSvg>;
}

function PaninoIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.1 12c.5-3.5 3.2-5.6 6.9-5.6s6.4 2.1 6.9 5.6H5.1Z" fill="currentColor" fillOpacity="0.12" /><path d="M5.3 12.2c1.5.8 3 .8 4.5 0s3-.8 4.5 0 3 .8 4.5 0" /><path d="M6.4 14.6h11.2" /><path d="M7.6 17.2h8.8" /><path d="M8.3 9.7h.01M11.8 9.1h.01M15.3 9.8h.01" /></BaseSvg>;
}

function PlateIcon({ className = "" }) {
  return <BaseSvg className={className}><ellipse cx="11.4" cy="12.2" rx="5.4" ry="4.3" fill="currentColor" fillOpacity="0.09" /><ellipse cx="11.4" cy="12.2" rx="3.1" ry="2.35" /><path d="M3.8 5.1v6.2M5.6 5.1v6.2M4.7 11.3v7.5" /><path d="M19.2 5.2c-1.5 1.2-2.2 3-2.2 5.3v2.1h2.2" /><path d="M19.2 5.2v13.6" /></BaseSvg>;
}

function DrinkIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M8.2 4.6h7.6l-.8 7.2a3 3 0 0 1-6 0l-.8-7.2Z" fill="currentColor" fillOpacity="0.1" /><path d="M9 8.1h6" /><path d="M12 14.9v5" /><path d="M8.8 19.9h6.4" /><path d="M15.1 5.1 18 3.2" /></BaseSvg>;
}

function CoffeeIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.3 8.2h10.8v5.1a4.2 4.2 0 0 1-4.2 4.2H9.5a4.2 4.2 0 0 1-4.2-4.2V8.2Z" fill="currentColor" fillOpacity="0.11" /><path d="M16.1 9.4h1.2a2.3 2.3 0 1 1 0 4.6h-1.2" /><path d="M8.5 4.1c-.7.8-.7 1.6 0 2.4M12 4.1c-.7.8-.7 1.6 0 2.4" /><path d="M6.9 20h10" /></BaseSvg>;
}

function PastryIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M7 11.8c.3-2.9 2.4-4.7 5-4.7s4.7 1.8 5 4.7H7Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.2 11.8h11.6l-1.1 6.2a2.3 2.3 0 0 1-2.3 1.9H9.6A2.3 2.3 0 0 1 7.3 18l-1.1-6.2Z" /><path d="M8.5 14.3h7" /><path d="M9.4 16.7h5.2" /><circle cx="12" cy="5.5" r="1.15" fill="currentColor" /></BaseSvg>;
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
  { id: "street_food", label: "Street food", icon: PaninoIcon, fill: "#F59E0B", stroke: "#B45309", chip: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" },
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
