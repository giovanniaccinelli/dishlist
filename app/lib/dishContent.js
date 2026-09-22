export function hasDishMedia(dish) {
  const mediaItems = Array.isArray(dish?.mediaItems) ? dish.mediaItems : [];
  if (mediaItems.some((item) => {
    const itemValue = item?.cardURL || item?.imageURL || item?.url || item?.thumbURL || item?.thumbnailURL || "";
    const normalizedItem = String(itemValue || "").trim();
    return Boolean(normalizedItem && normalizedItem !== "undefined" && normalizedItem !== "null");
  })) {
    return true;
  }
  const value =
    dish?.cardURL ||
    dish?.imageURL ||
    dish?.imageUrl ||
    dish?.image_url ||
    dish?.image ||
    dish?.thumbURL ||
    dish?.thumbnailURL ||
    "";
  const normalized = String(value || "").trim();
  return Boolean(normalized && normalized !== "undefined" && normalized !== "null");
}

export function hasDishRecipe(dish) {
  return Boolean(
    String(dish?.recipeIngredients || "").trim() ||
      String(dish?.recipeMethod || "").trim()
  );
}

export function isRecipeOnlyDish(dish) {
  return !hasDishMedia(dish) && hasDishRecipe(dish);
}

export function isTextOnlyDish(dish) {
  return !hasDishMedia(dish) && !hasDishRecipe(dish);
}

export function orderDishesForProfileList(dishes = []) {
  return [...dishes].sort((a, b) => {
    const aTextOnly = isTextOnlyDish(a) ? 1 : 0;
    const bTextOnly = isTextOnlyDish(b) ? 1 : 0;
    return aTextOnly - bTextOnly;
  });
}
