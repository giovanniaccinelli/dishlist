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
];

const TAG_COLOR_STYLES = [
  "bg-[#DFF3FF] text-[#123B52]",
  "bg-[#E9FBD8] text-[#1D4F1A]",
  "bg-[#FFF2D9] text-[#6A3E00]",
  "bg-[#FFE3EC] text-[#6A1A36]",
  "bg-[#EDE8FF] text-[#33205D]",
  "bg-[#E5F7F4] text-[#0F4D45]",
];

const TAG_COLOR_MAP = TAG_OPTIONS.reduce((acc, tag, idx) => {
  acc[tag] = TAG_COLOR_STYLES[idx % TAG_COLOR_STYLES.length];
  return acc;
}, {});

export function getTagChipClass(tag, active) {
  if (!active) {
    return "bg-white text-black border-black/20";
  }
  return `${TAG_COLOR_MAP[tag] || TAG_COLOR_STYLES[0]} border-transparent`;
}
