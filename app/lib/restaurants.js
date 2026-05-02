export function normalizeRestaurant(restaurant) {
  if (!restaurant || typeof restaurant !== "object") return null;

  const placeId = String(restaurant.placeId || restaurant.place_id || "").trim();
  const name = String(restaurant.name || "").trim();
  const address = String(
    restaurant.address || restaurant.formatted_address || ""
  ).trim();
  const lat = Number(restaurant.lat);
  const lng = Number(restaurant.lng);

  if (!placeId || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const googleMapsUrl = String(
    restaurant.googleMapsUrl ||
      restaurant.url ||
      `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`
  ).trim();

  return {
    placeId,
    name,
    address,
    lat,
    lng,
    googleMapsUrl,
  };
}

export function getRestaurantDishGroups(dishes = []) {
  const groups = new Map();

  (dishes || []).forEach((dish) => {
    const restaurant = normalizeRestaurant(dish?.restaurant);
    if (!restaurant) return;

    const existing =
      groups.get(restaurant.placeId) ||
      {
        ...restaurant,
        dishes: [],
        users: [],
      };

    if (dish?.id && !existing.dishes.some((item) => item.id === dish.id)) {
      existing.dishes.push(dish);
    }

    const userId = String(dish?.owner || "").trim();
    if (userId) {
      let userEntry = existing.users.find((item) => item.id === userId);
      if (!userEntry) {
        userEntry = {
          id: userId,
          name: dish?.ownerName || "User",
          photoURL: dish?.ownerPhotoURL || "",
          dishes: [],
        };
        existing.users.push(userEntry);
      }
      if (dish?.id && !userEntry.dishes.some((item) => item.id === dish.id)) {
        userEntry.dishes.push(dish);
      }
    }

    groups.set(restaurant.placeId, existing);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      users: (group.users || []).sort(
        (a, b) => (b.dishes?.length || 0) - (a.dishes?.length || 0) || (a.name || "").localeCompare(b.name || "")
      ),
    }))
    .sort((a, b) => {
    if ((b.dishes?.length || 0) !== (a.dishes?.length || 0)) {
      return (b.dishes?.length || 0) - (a.dishes?.length || 0);
    }
    return a.name.localeCompare(b.name);
    });
}

export function hasRestaurantLocation(dish) {
  return Boolean(normalizeRestaurant(dish?.restaurant));
}
