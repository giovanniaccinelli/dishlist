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

export function getRestaurantDishGroups(dishes = [], leaderboardAnswers = []) {
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

  (leaderboardAnswers || []).forEach((answer) => {
    const restaurant = normalizeRestaurant(answer?.restaurant);
    if (!restaurant) return;
    const existing =
      groups.get(restaurant.placeId) ||
      {
        ...restaurant,
        dishes: [],
        users: [],
        leaderboardAnswers: [],
      };
    existing.leaderboardAnswers = existing.leaderboardAnswers || [];
    if (answer?.id && !existing.leaderboardAnswers.some((item) => item.id === answer.id && item.questionId === answer.questionId)) {
      existing.leaderboardAnswers.push(answer);
    }

    const userId = String(answer?.userId || "").trim();
    if (userId) {
      let userEntry = existing.users.find((item) => item.id === userId);
      if (!userEntry) {
        userEntry = {
          id: userId,
          name: answer?.anonymous ? "Anonimo" : answer?.userName || "User",
          photoURL: answer?.anonymous ? "" : answer?.userPhotoURL || "",
          dishes: [],
          leaderboardAnswers: [],
        };
        existing.users.push(userEntry);
      }
      userEntry.leaderboardAnswers = userEntry.leaderboardAnswers || [];
      if (answer?.id && !userEntry.leaderboardAnswers.some((item) => item.id === answer.id && item.questionId === answer.questionId)) {
        userEntry.leaderboardAnswers.push(answer);
      }
    }

    groups.set(restaurant.placeId, existing);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      users: (group.users || []).sort(
        (a, b) =>
          ((b.dishes?.length || 0) + (b.leaderboardAnswers?.length || 0)) -
            ((a.dishes?.length || 0) + (a.leaderboardAnswers?.length || 0)) ||
          (a.name || "").localeCompare(b.name || "")
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
