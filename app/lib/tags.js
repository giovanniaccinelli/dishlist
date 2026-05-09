export const TAG_OPTIONS = [
  "fit",
  "high protein",
  "veg",
  "vegan",
  "light",
  "easy",
  "quick",
  "fancy",
  "comfort",
  "carb heavy",
  "low carb",
  "spicy",
  "late night",
  "cheat",
  "budget",
  "premium",
  "summer",
  "winter",
  "gourmet",
  "date night",
];

const TAG_COLOR_STYLES = [
  "bg-[#DFF3FF] text-[#123B52]",
  "bg-[#E9FBD8] text-[#1D4F1A]",
  "bg-[#FFF2D9] text-[#6A3E00]",
  "bg-[#FFE3EC] text-[#6A1A36]",
  "bg-[#EDE8FF] text-[#33205D]",
  "bg-[#E5F7F4] text-[#0F4D45]",
];

const TAG_DARK_COLOR_STYLES = [
  "border-[#5FA8F2]/70 bg-[#0C2236] text-[#B9DFFF]",
  "border-[#2BD36B]/70 bg-[#0D2818] text-[#C8FFD8]",
  "border-[#F0A623]/75 bg-[#2E2108] text-[#FFE0A3]",
  "border-[#E64646]/70 bg-[#2A1111] text-[#FFC0C0]",
  "border-[#B58CFF]/70 bg-[#201338] text-[#DDC9FF]",
  "border-[#55D6C2]/70 bg-[#0B2925] text-[#C0FFF5]",
  "border-[#FF7AB6]/70 bg-[#321322] text-[#FFC6DF]",
  "border-[#D8D85A]/70 bg-[#29290E] text-[#FFFFA8]",
  "border-[#8FD7AE]/70 bg-[#0E2A1D] text-[#D7FFE5]",
  "border-[#FF8A5A]/70 bg-[#31180D] text-[#FFD2BD]",
];

const TAG_COLOR_MAP = TAG_OPTIONS.reduce((acc, tag, idx) => {
  acc[tag] = TAG_COLOR_STYLES[idx % TAG_COLOR_STYLES.length];
  return acc;
}, {});

const TAG_DARK_COLOR_MAP = TAG_OPTIONS.reduce((acc, tag, idx) => {
  acc[tag] = TAG_DARK_COLOR_STYLES[idx % TAG_DARK_COLOR_STYLES.length];
  return acc;
}, {});

export function getTagChipClass(tag, active) {
  if (!active) {
    return "bg-white text-black border-black/20";
  }
  return `${TAG_COLOR_MAP[tag] || TAG_COLOR_STYLES[0]} border-transparent`;
}

export function getDarkTagChipClass(tag, active) {
  if (!active) {
    return "border-white/14 bg-[#171717] text-white/62";
  }
  return TAG_DARK_COLOR_MAP[tag] || TAG_DARK_COLOR_STYLES[0];
}
