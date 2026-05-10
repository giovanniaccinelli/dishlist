import { TAG_OPTIONS } from "./tags";

export const PROFILE_REPRESENTATIVE_TAG_LIMIT = 3;

export function normalizeRepresentativeTags(tags = [], limit = PROFILE_REPRESENTATIVE_TAG_LIMIT) {
  if (!Array.isArray(tags)) return [];
  const allowed = new Set(TAG_OPTIONS);
  return Array.from(
    new Set(
      tags
        .map((tag) => String(tag || "").trim())
        .filter((tag) => tag && allowed.has(tag))
    )
  ).slice(0, limit);
}

export function getTopRepresentativeTags(dishes = [], limit = PROFILE_REPRESENTATIVE_TAG_LIMIT) {
  const counts = new Map();
  dishes.forEach((dish) => {
    const tags = Array.isArray(dish?.tags) ? dish.tags : [];
    tags.forEach((rawTag) => {
      const tag = String(rawTag || "").trim();
      if (!TAG_OPTIONS.includes(tag)) return;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return TAG_OPTIONS.indexOf(a[0]) - TAG_OPTIONS.indexOf(b[0]);
    })
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function resolveRepresentativeTags(explicitTags = [], dishes = [], limit = PROFILE_REPRESENTATIVE_TAG_LIMIT) {
  const normalizedExplicit = normalizeRepresentativeTags(explicitTags, limit);
  if (normalizedExplicit.length) return normalizedExplicit;
  return getTopRepresentativeTags(dishes, limit);
}
