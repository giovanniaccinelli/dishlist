import { TAG_OPTIONS } from "./tags";

export function getTagDishlistId(tag) {
  return `tag:${String(tag || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function isTagDishlistId(id) {
  return String(id || "").startsWith("tag:");
}

export function getTagForDishlistId(id) {
  const value = String(id || "");
  return TAG_OPTIONS.find((tag) => getTagDishlistId(tag) === value) || "";
}

function formatTagDishlistName(tag) {
  const value = String(tag || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export function buildDefaultTagDishlists(existingLists = []) {
  const byId = new Map((existingLists || []).filter((list) => list?.id).map((list) => [list.id, list]));
  return TAG_OPTIONS.map((tag, index) => {
    const id = getTagDishlistId(tag);
    const existing = byId.get(id) || {};
    const dishes = Array.isArray(existing.dishes) ? existing.dishes : [];
    return {
      ...existing,
      id,
      name: formatTagDishlistName(tag),
      type: "tag_system",
      tag,
      tagRank: index,
      dishes,
      dishIds: Array.isArray(existing.dishIds) ? existing.dishIds : dishes.map((dish) => dish?.id).filter(Boolean),
      count: dishes.length,
    };
  }).sort((a, b) => (b.count - a.count) || (a.tagRank - b.tagRank));
}
