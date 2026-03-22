export const DEFAULT_DISH_IMAGE = "/Default.png";

export function getDishImageUrl(dish) {
  const imageSrc =
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
