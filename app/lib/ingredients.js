export const INGREDIENT_COLORS = [
  { id: "green", bg: "#DCFCE7", text: "#14532D", border: "#86EFAC", darkBg: "#14351F", darkText: "#B8F7CA", darkBorder: "#2BD36B" },
  { id: "mint", bg: "#CCFBF1", text: "#115E59", border: "#5EEAD4", darkBg: "#103934", darkText: "#B7F5EA", darkBorder: "#2DD4BF" },
  { id: "blue", bg: "#E0F2FE", text: "#075985", border: "#7DD3FC", darkBg: "#102F45", darkText: "#B9E6FF", darkBorder: "#38BDF8" },
  { id: "yellow", bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", darkBg: "#3B2D0D", darkText: "#FFE69A", darkBorder: "#E4B43F" },
  { id: "orange", bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74", darkBg: "#3F2412", darkText: "#FFD0A6", darkBorder: "#F59E0B" },
  { id: "red", bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", darkBg: "#3D1717", darkText: "#FFC1BD", darkBorder: "#E64646" },
  { id: "pink", bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4", darkBg: "#3A1630", darkText: "#FFC0E2", darkBorder: "#EC6CAF" },
  { id: "purple", bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD", darkBg: "#241A43", darkText: "#D7CAFF", darkBorder: "#9B87F5" },
  { id: "slate", bg: "#F1F5F9", text: "#334155", border: "#CBD5E1", darkBg: "#22252A", darkText: "#E4E8EE", darkBorder: "#687383" },
];

const COLOR_BY_ID = new Map(INGREDIENT_COLORS.map((color) => [color.id, color]));

export function normalizeIngredientName(value = "") {
  return String(value || "")
    .replace(/^[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIngredientKey(value = "") {
  return normalizeIngredientName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function getIngredientColor(colorId = "") {
  return COLOR_BY_ID.get(String(colorId || "")) || INGREDIENT_COLORS[0];
}

export function getIngredientPillStyle(colorId = "", darkMode = false) {
  const color = getIngredientColor(colorId);
  if (!darkMode) {
    return {
      backgroundColor: color.bg,
      borderColor: color.border,
      color: color.text,
      WebkitTextFillColor: color.text,
    };
  }
  return {
    backgroundColor: color.darkBg || color.bg,
    borderColor: color.darkBorder || color.border,
    color: color.darkText || color.text,
    WebkitTextFillColor: color.darkText || color.text,
    boxShadow: `inset 0 0 0 1px ${color.darkBorder || color.border}33`,
  };
}

export function inferIngredientColorId(name = "") {
  const key = normalizeIngredientName(name).toLowerCase();
  if (/\b(basil|spinach|lettuce|rucola|arugula|prezzemolo|parsley|cilantro|zucchin|broccoli|peas|avocado|lime|mint|cucumber|asparagus|erb|salad|pesto)\b/.test(key)) return "green";
  if (/\b(fish|salmon|tuna|shrimp|prawn|clam|mussel|seafood|water|milk|yogurt|cream)\b/.test(key)) return "blue";
  if (/\b(lemon|corn|egg|cheese|butter|oil|honey|mustard|saffron|banana)\b/.test(key)) return "yellow";
  if (/\b(carrot|orange|pumpkin|sweet potato|paprika|turmeric|ginger|peach)\b/.test(key)) return "orange";
  if (/\b(tomato|chili|pepperoni|beef|pork|bacon|chorizo|strawberr|raspberr|red wine)\b/.test(key)) return "red";
  if (/\b(onion|garlic|rice|flour|pasta|bread|potato|salt|sugar|mozzarella|ricotta)\b/.test(key)) return "slate";
  if (/\b(eggplant|aubergine|grape|beet|cabbage|radicchio)\b/.test(key)) return "purple";
  if (/\b(chocolate|cocoa|vanilla|cream|berry|dessert)\b/.test(key)) return "pink";
  return INGREDIENT_COLORS[Math.abs(hashString(key)) % INGREDIENT_COLORS.length].id;
}

function hashString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function normalizeIngredientItems(value = []) {
  const input = Array.isArray(value) ? value : parseIngredientText(value);
  const byKey = new Map();
  input.forEach((item) => {
    const rawName = typeof item === "string" ? item : item?.name;
    const name = normalizeIngredientName(rawName);
    const key = normalizeIngredientKey(name);
    if (!name || !key || byKey.has(key)) return;
    const colorId = typeof item === "object" && item?.color ? item.color : inferIngredientColorId(name);
    byKey.set(key, { key, name, color: getIngredientColor(colorId).id });
  });
  return Array.from(byKey.values()).slice(0, 40);
}

export function parseIngredientText(text = "") {
  return String(text || "")
    .split(/\n|,/)
    .map((line) => normalizeIngredientName(line))
    .filter(Boolean)
    .map((name) => ({ name, color: inferIngredientColorId(name) }));
}

export function ingredientItemsToText(items = []) {
  return normalizeIngredientItems(items)
    .map((item) => `• ${item.name}`)
    .join("\n");
}

export function getDishIngredientItems(dish = {}) {
  if (Array.isArray(dish?.recipeIngredientItems) && dish.recipeIngredientItems.length) {
    return normalizeIngredientItems(dish.recipeIngredientItems);
  }
  return normalizeIngredientItems(dish?.recipeIngredients || "");
}
