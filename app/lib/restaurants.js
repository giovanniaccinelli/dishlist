export function normalizeRestaurant(restaurant) {
  if (!restaurant || typeof restaurant !== "object") return null;

  const addressComponents = Array.isArray(restaurant.addressComponents || restaurant.address_components)
    ? restaurant.addressComponents || restaurant.address_components
    : [];
  const findComponent = (types = []) => {
    const component = addressComponents.find((item) => {
      const itemTypes = Array.isArray(item?.types) ? item.types : [];
      return types.some((type) => itemTypes.includes(type));
    });
    return String(component?.long_name || component?.short_name || "").trim();
  };

  const placeId = String(restaurant.placeId || restaurant.place_id || "").trim();
  const name = String(restaurant.name || "").trim();
  const address = String(
    restaurant.address || restaurant.formatted_address || ""
  ).trim();
  const city = String(
    restaurant.city ||
      restaurant.locality ||
      findComponent(["locality", "postal_town", "administrative_area_level_3", "sublocality", "sublocality_level_1"])
  ).trim();
  const country = String(
    restaurant.country ||
      restaurant.countryName ||
      findComponent(["country"])
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
    city,
    country,
    lat,
    lng,
    googleMapsUrl,
  };
}

export function getRestaurantDistanceMeters(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lng) || !Number.isFinite(b?.lat) || !Number.isFinite(b?.lng)) {
    return Number.POSITIVE_INFINITY;
  }
  const earthRadius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getDishRestaurantLocation(dish) {
  const normalized = normalizeRestaurant(dish?.restaurant);
  if (normalized) {
    return { lat: normalized.lat, lng: normalized.lng };
  }
  const lat = Number(dish?.restaurantLat || dish?.lat);
  const lng = Number(dish?.restaurantLng || dish?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getDishOwnerId(dish) {
  return String(dish?.owner || dish?.ownerId || dish?.userId || dish?.uploadedBy || dish?.createdBy || "").trim();
}

function getDishOwnerAliases(dish) {
  return Array.from(
    new Set(
      [dish?.owner, dish?.ownerId, dish?.userId, dish?.uploadedBy, dish?.createdBy]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getDishOwnerName(dish) {
  return String(dish?.ownerName || dish?.userName || dish?.uploadedByName || dish?.createdByName || "User").trim();
}

function getDishOwnerPhotoURL(dish) {
  return String(dish?.ownerPhotoURL || dish?.userPhotoURL || dish?.uploadedByPhotoURL || dish?.createdByPhotoURL || "").trim();
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

    const userId = getDishOwnerId(dish);
    if (userId) {
      const aliases = getDishOwnerAliases(dish);
      let userEntry = existing.users.find((item) => item.id === userId);
      if (!userEntry && aliases.length) {
        userEntry = existing.users.find((item) => (item.aliases || []).some((alias) => aliases.includes(alias)));
      }
      if (!userEntry) {
        userEntry = {
          id: userId,
          name: getDishOwnerName(dish),
          photoURL: getDishOwnerPhotoURL(dish),
          aliases,
          dishes: [],
        };
        existing.users.push(userEntry);
      } else {
        userEntry.name = userEntry.name || getDishOwnerName(dish);
        userEntry.photoURL = userEntry.photoURL || getDishOwnerPhotoURL(dish);
        userEntry.aliases = Array.from(new Set([...(userEntry.aliases || []), ...aliases, userEntry.id].filter(Boolean)));
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
          aliases: [userId],
          dishes: [],
          leaderboardAnswers: [],
        };
        existing.users.push(userEntry);
      } else {
        userEntry.aliases = Array.from(new Set([...(userEntry.aliases || []), userId].filter(Boolean)));
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
