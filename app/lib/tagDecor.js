import {
  Camera,
  ChefHat,
  Check,
  Dumbbell,
  Fish,
  Globe2,
  Leaf,
  MoonStar,
  Snowflake,
  Sprout,
  Sun,
  Timer,
  Utensils,
  Wheat,
} from "lucide-react";

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
      <ellipse cx="12" cy="16.4" rx="8.2" ry="4.4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.65" />
      <ellipse cx="12" cy="16" rx="5.7" ry="2.45" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.7" />
      <path d="M7.2 14.9c1.4-2 3.7-3.1 6.5-2.6 2 .4 3.2 1.5 3.8 2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.4 15.7c1.1.9 2.2.9 3.3 0s2.2-.9 3.3 0 2.2.9 3.3 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M8.2 13.8c1-.8 2.1-.9 3.2-.2 1.2.8 2.5.7 3.8-.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M9.1 12.2c1.9-1.1 3.8-1.2 5.8-.1" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="12.2" cy="12.8" r="1.35" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ItalianFlagIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="5.2" width="17" height="13.6" rx="2.4" fill="#fff" />
      <path d="M5.9 5.2h3.27v13.6H5.9a2.4 2.4 0 0 1-2.4-2.4V7.6a2.4 2.4 0 0 1 2.4-2.4Z" fill="#229246" />
      <path d="M14.83 5.2h3.27a2.4 2.4 0 0 1 2.4 2.4v8.8a2.4 2.4 0 0 1-2.4 2.4h-3.27V5.2Z" fill="#CE2B37" />
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

function DeliveryBagIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6.4 8.6h11.2l-1 10.1a2.2 2.2 0 0 1-2.2 2H9.6a2.2 2.2 0 0 1-2.2-2L6.4 8.6Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9.1 8.6V7.4a2.9 2.9 0 0 1 5.8 0v1.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9.4 12.8h5.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M10.7 15.8h2.6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M4.1 11.2h2.1" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.75" />
      <path d="M3.5 14.2h2.6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.75" />
      <path d="M4.4 17.2h2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.75" />
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

function PizzaSliceIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11.9 20.1 4.4 6.2c4.8-2 10.2-2 15 0l-7.5 13.9Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
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
      <path d="M10.2 6.8c2.4-1.5 5.7-1.2 7.8.8 2.2 2.2 2.3 5.7.2 8-2 2.2-5.3 2.7-7.9 1.2l-2.4-1.5c-.9-.5-1-1.8-.2-2.5l2.5-2.1Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.95" strokeLinejoin="round" />
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
      <path d="M6.6 4.4h5.1l-.5 4.1a3 3 0 0 1-3.1 2.4L6.6 4.4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" transform="rotate(-14 9.15 7.65)" />
      <path d="M12.3 4.4h5.1l-1.5 6.5a3 3 0 0 1-3.1-2.4l-.5-4.1Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" transform="rotate(14 14.85 7.65)" />
      <path d="M9.6 10.7v5.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14.4 10.7v5.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.6 18.2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12.4 18.2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M10.9 8.4 13.1 7" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
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
      <path d="M17.6 6.1c-.7 4.9-2.6 8.7-5.8 11.2-2.1 1.7-4.7 2.1-6 .8-1-1.1-.2-2.9 1.8-3.5 2.4-.8 4.6-2.2 6.4-4.3 1.1-1.2 2-2.7 2.7-4.4l.9.2Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.85" strokeLinejoin="round" />
      <path d="M7.1 17.2c3.5-.9 6.9-4.1 8.6-8.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.78" />
      <path d="M17.2 6.4c-.2-1.6.4-2.8 1.7-3.6" stroke="#2E9E57" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17.2 6.4c1-.4 1.9-.2 2.8.4" stroke="#2E9E57" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export const TAG_DECOR = {
  "high protein": { icon: DrumstickIcon, iconClass: "text-[#A34723]", pillClass: "bg-[#FDE6D8] text-[#7C2D12] border-[#F2B38D]" },
  comfort: { icon: HeartIcon, iconClass: "text-[#C96A1B]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFE7C7] text-[#8A4B14] border-[#F5C37A]" },
  "carb heavy": { icon: Wheat, iconClass: "text-[#B38717]", pillClass: "bg-[#F8E6B8] text-[#7A5A10] border-[#E5C86D]" },
  quick: { icon: Timer, iconClass: "text-[#1D7FA6]", pillClass: "bg-[#DDF5FF] text-[#124E68] border-[#96D7F2]" },
  cheat: { icon: PizzaSliceIcon, iconClass: "text-[#C6582C]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FFD8CC] text-[#8A2F16] border-[#F39B7A]" },
  easy: { icon: Check, iconClass: "text-[#6366F1]", pillClass: "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]" },
  fit: { icon: Dumbbell, iconClass: "text-[#1F8A4D]", pillClass: "bg-[#DDF7E7] text-[#17603A] border-[#9FDEB8]" },
  premium: { icon: CoinStackIcon, iconClass: "text-[#C69A00]", pillClass: "bg-[#FFF1B8] text-[#8A6700] border-[#E8C95B]" },
  veg: { icon: Leaf, iconClass: "text-[#33A047]", pillClass: "bg-[#E4F8D9] text-[#236A1C] border-[#A9E08D]" },
  fancy: { icon: Utensils, iconClass: "text-[#7C4CC2]", pillClass: "bg-[#F1E8FF] text-[#5C2D91] border-[#CEB5F6]" },
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
  delivery: { icon: DeliveryBagIcon, iconClass: "text-[#0EA5E9]", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#E0F2FE] text-[#075985] border-[#38BDF8]" },
  dessert: { icon: DessertIcon, iconClass: "text-[#DB2777]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FCE7F3] text-[#9D174D] border-[#F9A8D4]" },
  american: { icon: AmericanFlagIcon, iconClass: "text-black/50", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#DBEAFE] text-[#1E3A8A] border-[#EF4444]" },
  rice: { icon: RiceIcon, iconClass: "text-[#C8A31B]", iconSize: "h-[1.42rem] w-[1.42rem]", pillClass: "bg-[#FEFCE8] text-[#713F12] border-[#FDE047]" },
  "fast food": { icon: FastFoodIcon, iconClass: "text-[#E11D48]", iconSize: "h-[1.45rem] w-[1.45rem]", pillClass: "bg-[#FFE4E6] text-[#9F1239] border-[#FB7185]" },
};
