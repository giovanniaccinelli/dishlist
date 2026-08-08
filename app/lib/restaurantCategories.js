"use client";

function BaseSvg({ className = "", children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function PizzaIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M12 20.1 5.2 6.8c4.4-1.7 9.2-1.7 13.6 0L12 20.1Z" fill="currentColor" fillOpacity="0.13" /><path d="M6.9 8.6c3.3-1 6.9-1 10.2 0" /><circle cx="11.8" cy="11.4" r=".78" fill="currentColor" /><circle cx="9.9" cy="14.3" r=".72" fill="currentColor" /><circle cx="13.9" cy="14.1" r=".72" fill="currentColor" /><path d="M11.9 16.3h.01" /></BaseSvg>;
}

function PastaIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M8.5 8.9c-.7-.9-.4-1.7.2-2.4.7-.8.8-1.4.1-2.2" /><path d="M12 8.7c-.8-.9-.4-1.8.2-2.5.7-.8.8-1.5.1-2.3" /><path d="M15.4 8.9c-.7-.8-.4-1.6.2-2.3.6-.7.7-1.3.1-2" /><ellipse cx="12" cy="16.2" rx="7.5" ry="4.2" fill="currentColor" fillOpacity="0.1" /><path d="M7.4 15.1c1.1-1.7 2.8-2.5 5.1-2.3 2.1.2 3.6 1.1 4.3 2.4" /><path d="M7.8 16c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0" /></BaseSvg>;
}

function MeatIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M10.2 6.8c2.4-1.5 5.7-1.2 7.8.8 2.2 2.2 2.3 5.7.2 8-2 2.2-5.3 2.7-7.9 1.2l-2.4-1.5c-.9-.5-1-1.8-.2-2.5l2.5-2.1Z" fill="currentColor" fillOpacity="0.14" /><path d="M7.8 15.4 5.9 17.3" /><circle cx="5" cy="18.2" r="1.15" /><circle cx="6.9" cy="20" r="1.15" /><path d="M15 8.6c1.9 1.5 2.5 4.2 1.1 6.2" /></BaseSvg>;
}

function FishIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.5 12s3.2-5.2 8.2-5.2S20 12 20 12s-2.3 5.2-7.3 5.2S4.5 12 4.5 12Z" fill="currentColor" fillOpacity="0.12" /><path d="m20 12 2-2.5v5L20 12Z" /><circle cx="10.2" cy="11.4" r=".65" fill="currentColor" /><path d="M14.2 7.4c.8 1.2 1.2 2.7 1.2 4.6s-.4 3.4-1.2 4.6" /></BaseSvg>;
}

function SushiIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M6.1 13.3c0-2.5 2.6-4.4 5.9-4.4s5.9 1.9 5.9 4.4-2.6 4.4-5.9 4.4-5.9-1.9-5.9-4.4Z" fill="currentColor" fillOpacity="0.08" /><path d="M5.8 10.8c1.4-2 3.5-3 6.2-3s4.8 1 6.2 3l-.9 2.6H6.7l-.9-2.6Z" fill="currentColor" fillOpacity="0.2" /><path d="M6.7 13.4c1.3 1.2 3.1 1.8 5.3 1.8s4-.6 5.3-1.8" /><path d="M8.7 16.2h6.6" /></BaseSvg>;
}

function NoodlesIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.4 11.8h13.2l-1.4 4.4a4.1 4.1 0 0 1-3.9 2.8h-2.6a4.1 4.1 0 0 1-3.9-2.8l-1.4-4.4Z" fill="currentColor" fillOpacity="0.11" /><path d="M6.4 11.8c1.2 1.3 3.1 2 5.6 2s4.4-.7 5.6-2" /><path d="M16.5 4.4 10.2 12" /><path d="M13 4 7.5 11.6" /></BaseSvg>;
}

function BurgerIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.4 10.8c.45-2.7 2.8-4.4 6.6-4.4s6.15 1.7 6.6 4.4H5.4Z" fill="currentColor" fillOpacity="0.12" /><path d="M5.1 13h13.8" /><path d="M6 15.1c1.6.8 2.9.8 4.4 0s2.7-.8 4.2 0 2.6.8 3.4 0" /><path d="M6.3 17.5h11.4c-.4 1.2-1.5 1.9-3.1 1.9H9.4c-1.6 0-2.7-.7-3.1-1.9Z" fill="currentColor" fillOpacity="0.12" /><path d="M8.2 8.8h.01M11.8 8.2h.01M15.4 8.9h.01" /></BaseSvg>;
}

function TacoIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M4.7 16.7c.25-5.2 3.25-9 7.3-9s7.05 3.8 7.3 9H4.7Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.2 16.7c.6-3.6 2.8-6.1 5.8-6.1s5.2 2.5 5.8 6.1" /><path d="M8 14.2c1-.6 1.9-.6 2.9 0s2 .6 3 0 1.9-.6 2.9 0" /><path d="M8.6 11.7h.01M12 10.8h.01M15.4 11.8h.01" /></BaseSvg>;
}

function KebabIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M12 4.1v15.8" /><path d="M8.4 7.1c1.5-1.2 5.7-1.2 7.2 0-.7 1.9-6.5 1.9-7.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M7.9 11.3c1.7-1.4 6.5-1.4 8.2 0-.8 2.1-7.4 2.1-8.2 0Z" fill="currentColor" fillOpacity="0.12" /><path d="M8.6 15.8c1.4-1.1 5.4-1.1 6.8 0-.7 1.8-6.1 1.8-6.8 0Z" fill="currentColor" fillOpacity="0.12" /></BaseSvg>;
}

function FoodTruckIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M3.8 8.1h10.8v7.7H3.8V8.1Z" fill="currentColor" fillOpacity="0.12" /><path d="M14.6 10.5h3.2l2.4 2.5v2.8h-5.6v-5.3Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.1 10.4h5.4" /><path d="M4.8 12.6h7.7" /><path d="M14.6 13h5.3" /><circle cx="7.1" cy="17.1" r="1.35" /><circle cx="17.2" cy="17.1" r="1.35" /><path d="M8.45 17.1h7.4" /></BaseSvg>;
}

function PlateIcon({ className = "" }) {
  return <BaseSvg className={className}><ellipse cx="11.4" cy="12.2" rx="5.4" ry="4.3" fill="currentColor" fillOpacity="0.09" /><ellipse cx="11.4" cy="12.2" rx="3.1" ry="2.35" /><path d="M3.8 5.1v6.2M5.6 5.1v6.2M4.7 11.3v7.5" /><path d="M19.2 5.2c-1.5 1.2-2.2 3-2.2 5.3v2.1h2.2" /><path d="M19.2 5.2v13.6" /></BaseSvg>;
}

function DrinkIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M6.8 4.8h10.4L12 12.8 6.8 4.8Z" fill="currentColor" fillOpacity="0.11" /><path d="M8.8 7.8h6.4" /><path d="M12 12.8v6.8" /><path d="M8.8 19.6h6.4" /><path d="M15.1 5.1 18 3.1" /></BaseSvg>;
}

function CoffeeIcon({ className = "" }) {
  return <BaseSvg className={className}><path d="M5.4 8.2h10.4v5a4 4 0 0 1-4 4H9.4a4 4 0 0 1-4-4v-5Z" fill="currentColor" fillOpacity="0.11" /><path d="M15.8 9.5h1.25a2.25 2.25 0 1 1 0 4.5H15.8" /><path d="M8.5 4.1c-.7.8-.7 1.6 0 2.4M12 4.1c-.7.8-.7 1.6 0 2.4" /><path d="M6.7 19.8h9.8" /></BaseSvg>;
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
  { id: "pizza", label: "Pizza", icon: PizzaIcon, fill: "#E85D3F", stroke: "#9F321D", chip: "border-[#B94B35] bg-[#25100C] text-[#F4B09F]" },
  { id: "pasta", label: "Pasta", icon: PastaIcon, fill: "#D9A441", stroke: "#8A5F15", chip: "border-[#A97825] bg-[#251B09] text-[#E8C982]" },
  { id: "carne", label: "Carne", icon: MeatIcon, fill: "#B9433D", stroke: "#7A201D", chip: "border-[#9D3732] bg-[#241010] text-[#E2A09C]" },
  { id: "pesce", label: "Pesce", icon: FishIcon, fill: "#3A9CB8", stroke: "#22677A", chip: "border-[#2E8198] bg-[#0A2027] text-[#A9D8E4]" },
  { id: "sushi", label: "Sushi", icon: SushiIcon, fill: "#4C9A68", stroke: "#2E6844", chip: "border-[#3E8058] bg-[#0D2117] text-[#B5D9C2]" },
  { id: "noodles", label: "Noodles", icon: NoodlesIcon, fill: "#C85B5B", stroke: "#893333", chip: "border-[#A94747] bg-[#251111] text-[#E2A9A9]" },
  { id: "fast_food", label: "Fast food", icon: BurgerIcon, fill: "#C64A67", stroke: "#8C2740", chip: "border-[#A43B54] bg-[#271018] text-[#E3A6B6]" },
  { id: "tacos", label: "Tacos", icon: TacoIcon, fill: "#C7772E", stroke: "#874B16", chip: "border-[#A86425] bg-[#26180B] text-[#E5BB8B]" },
  { id: "kebab", label: "Kebab", icon: KebabIcon, fill: "#8A6540", stroke: "#5D3F25", chip: "border-[#775334] bg-[#21170F] text-[#D0B190]" },
  { id: "street_food", label: "Street food", icon: FoodTruckIcon, fill: "#B68B34", stroke: "#7A5C1B", chip: "border-[#917025] bg-[#231B0D] text-[#DDC48A]" },
  { id: "ristorante", label: "Ristorante", icon: PlateIcon, fill: "#816EB7", stroke: "#50427E", chip: "border-[#6C5A9A] bg-[#171326] text-[#C4BAE3]" },
  { id: "bar", label: "Bar", icon: DrinkIcon, fill: "#477FAE", stroke: "#2B5273", chip: "border-[#386B93] bg-[#0B1B28] text-[#B2D0E7]" },
  { id: "caffetteria", label: "Caffetteria", icon: CoffeeIcon, fill: "#9A7258", stroke: "#624535", chip: "border-[#7D5A45] bg-[#1F1510] text-[#D5B7A4]" },
  { id: "pasticceria", label: "Pasticceria", icon: PastryIcon, fill: "#B95B8E", stroke: "#823B62", chip: "border-[#984A73] bg-[#24121D] text-[#E1ACC9]" },
  { id: "gelateria", label: "Gelateria", icon: GelatoIcon, fill: "#58A9B5", stroke: "#34727B", chip: "border-[#468C96] bg-[#0D2124] text-[#B7DDE2]" },
  { id: "gourmet", label: "Gourmet", icon: StarIcon, fill: "#BCA246", stroke: "#7C6720", chip: "border-[#968037] bg-[#211C0D] text-[#E1D08C]" },
  { id: "pub", label: "Pub", icon: BeerIcon, fill: "#B8792E", stroke: "#7B4D1C", chip: "border-[#966225] bg-[#23180C] text-[#DFBA85]" },
];

const CATEGORY_BY_ID = new Map(RESTAURANT_CATEGORY_OPTIONS.map((category) => [category.id, category]));

export function normalizeRestaurantCategoryId(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_BY_ID.has(normalized) ? normalized : "";
}

export function getRestaurantCategory(value = "") {
  return CATEGORY_BY_ID.get(normalizeRestaurantCategoryId(value)) || null;
}
