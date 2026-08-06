export const DEFAULT_DISH_IMAGE = "/Default.png";

export function getDishMediaType(dish) {
  if (dish?.mediaType) return dish.mediaType;
  if (dish?.mediaMimeType?.startsWith("video/")) return "video";
  const src =
    dish?.cardURL ||
    dish?.imageURL ||
    dish?.imageUrl ||
    dish?.image_url ||
    dish?.image ||
    "";
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(src)) return "video";
  return "image";
}

export function isDishVideo(dish) {
  return getDishMediaType(dish) === "video";
}

export function getDishMediaItems(dish) {
  const rawItems = Array.isArray(dish?.mediaItems) ? dish.mediaItems : [];
  const items = rawItems
    .map((item) => {
      const cardURL = item?.cardURL || item?.imageURL || item?.url || "";
      const thumbURL = item?.thumbURL || item?.thumbnailURL || cardURL;
      if (!cardURL || cardURL === "undefined" || cardURL === "null") return null;
      return {
        imageURL: item?.imageURL || cardURL,
        cardURL,
        thumbURL,
        mediaType: item?.mediaType || (item?.mediaMimeType?.startsWith("video/") ? "video" : "image"),
        mediaMimeType: item?.mediaMimeType || "",
      };
    })
    .filter(Boolean);

  if (items.length) return items.slice(0, 5);

  const fallback = getDishImageUrl(dish);
  if (!fallback || fallback === DEFAULT_DISH_IMAGE) return [];
  return [
    {
      imageURL: fallback,
      cardURL: fallback,
      thumbURL: dish?.thumbURL || fallback,
      mediaType: getDishMediaType(dish),
      mediaMimeType: dish?.mediaMimeType || "",
    },
  ];
}

export function getDishImageUrl(dish, variant = "card") {
  const mediaItems = Array.isArray(dish?.mediaItems) ? dish.mediaItems : [];
  const firstMedia = mediaItems[0] || null;
  const imageSrc =
    (variant === "thumb" ? firstMedia?.thumbURL || firstMedia?.thumbnailURL : "") ||
    firstMedia?.cardURL ||
    firstMedia?.imageURL ||
    firstMedia?.url ||
    (variant === "thumb" ? dish?.thumbURL || dish?.thumbnailURL : "") ||
    dish?.cardURL ||
    dish?.imageURL ||
    dish?.imageUrl ||
    dish?.image_url ||
    dish?.image ||
    "";

  if (!imageSrc || imageSrc === "undefined" || imageSrc === "null") {
    return DEFAULT_DISH_IMAGE;
  }

  return imageSrc;
}
