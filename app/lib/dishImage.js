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

export function getDishImageUrl(dish, variant = "card") {
  const imageSrc =
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
