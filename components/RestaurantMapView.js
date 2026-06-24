"use client";

import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";
import { getRestaurantDistanceMeters } from "../app/lib/restaurants";
import { useAuth } from "../app/lib/auth";
import DishRatingBadge from "./DishRatingBadge";
import { useLanguage } from "./LanguageProvider";
import { RatingStars } from "./RatingStars";
import { TAG_OPTIONS } from "../app/lib/tags";
import { TAG_DECOR } from "../app/lib/tagDecor";

const clampSiny = (value) => Math.min(Math.max(value, -0.9999), 0.9999);

function projectLatLng({ lat, lng }, zoom) {
  const worldSize = 256 * Math.pow(2, zoom);
  const siny = clampSiny(Math.sin((lat * Math.PI) / 180));
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * worldSize,
  };
}

function unprojectLatLng({ x, y }, zoom) {
  const worldSize = 256 * Math.pow(2, zoom);
  const lng = (x / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function getOffsetCenter(group, zoom, verticalOffsetPx = 0) {
  if (!Number.isFinite(group?.lat) || !Number.isFinite(group?.lng)) return null;
  if (!verticalOffsetPx) return { lat: group.lat, lng: group.lng };
  const point = projectLatLng({ lat: group.lat, lng: group.lng }, zoom);
  return unprojectLatLng({ x: point.x, y: point.y + verticalOffsetPx }, zoom);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getMapCenterLiteral(map) {
  const center = map?.getCenter?.();
  if (!center) return null;
  return { lat: center.lat(), lng: center.lng() };
}

function formatRestaurantPlaceLine(group = {}) {
  const explicitCity = String(group.city || group.locality || group.town || "").trim();
  const explicitCountry = String(group.country || group.countryName || "").trim();
  if (explicitCity && explicitCountry) return `${explicitCity}, ${explicitCountry}`;
  if (explicitCity) return explicitCity;

  const parts = String(group.address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "Pinned restaurant";

  const country = explicitCountry || parts[parts.length - 1] || "";
  const cleanedParts = parts
    .slice(0, -1)
    .map((part) =>
      part
        .replace(/\b\d{3,}(?:[-\s]\d+)?\b/g, "")
        .replace(/\b[A-Z]{1,3}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "")
        .replace(/\b[A-Z]{2,3}\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
  let city = cleanedParts[cleanedParts.length - 1] || "";
  if (city && /\d/.test(city)) city = "";
  if (!city && parts.length >= 3) {
    city = parts[parts.length - 3]
      .replace(/\b\d{3,}(?:[-\s]\d+)?\b/g, "")
      .replace(/\b[A-Z]{2,3}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (/\b(st|street|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|via|viale|piazza|p\.za|corso|rue|calle|av\.?)\b/i.test(city)) {
    city = "";
  }
  if (!city) return country || "Pinned restaurant";
  return country && country !== city ? `${city}, ${country}` : city;
}

function getRestaurantGoogleMapsUrl(group = {}) {
  const explicitUrl = String(group.googleMapsUrl || group.googleMapsURL || "").trim();
  if (explicitUrl) return explicitUrl;
  const placeId = String(group.placeId || "").trim();
  const name = String(group.name || "").trim();
  const address = String(group.address || "").trim();
  const lat = Number(group.lat);
  const lng = Number(group.lng);
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || address || "Restaurant")}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (name || address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`;
  }
  return "";
}

const TAG_ORDER_INDEX = new Map(TAG_OPTIONS.map((tag, index) => [tag, index]));

function extractDecorColor(className = "") {
  const hexMatch = String(className).match(/text-\[(#[0-9A-Fa-f]{3,8})\]/);
  if (hexMatch?.[1]) return hexMatch[1];
  if (String(className).includes("text-black")) return "#111111";
  if (String(className).includes("text-white")) return "#FFFFFF";
  return "#111111";
}

const TAG_PIN_THEMES = {
  "high protein": { fill: "#A34723" },
  comfort: { fill: "#C96A1B" },
  "carb heavy": { fill: "#B38717" },
  quick: { fill: "#1D7FA6" },
  cheat: { fill: "#F39B7A" },
  easy: { fill: "#C7D2FE" },
  fit: { fill: "#9FDEB8" },
  premium: { fill: "#E8C95B" },
  veg: { fill: "#A9E08D" },
  fancy: { fill: "#CEB5F6" },
  budget: { fill: "#D6B6A6" },
  winter: { fill: "#A9D2F5" },
  "late night": { fill: "#B8B2F3" },
  light: { fill: "#D5DBE3" },
  vegan: { fill: "#A7E2BE" },
  "low carb": { fill: "#F3A0A9" },
  spicy: { fill: "#F28A7B" },
  gourmet: { fill: "#D6C0A8" },
  summer: { fill: "#F0CB68" },
  "date night": { fill: "#F2A7B8" },
  pasta: { fill: "#F59E0B" },
  italian: { fill: "#EF4444" },
  ethnic: { fill: "#60A5FA" },
  seafood: { fill: "#22D3EE" },
  aesthetic: { fill: "#F472B6" },
  fresh: { fill: "#34D399" },
  asian: { fill: "#F87171" },
  fried: { fill: "#FB923C" },
  delivery: { fill: "#38BDF8" },
  dessert: { fill: "#F9A8D4" },
  american: { fill: "#EF4444" },
  rice: { fill: "#FDE047" },
  "fast food": { fill: "#FB7185" },
};

function getTagPinTheme(tag = "") {
  const normalizedTag = String(tag || "").trim().toLowerCase();
  const preset = TAG_PIN_THEMES[normalizedTag];
  const decor = TAG_DECOR[normalizedTag];
  const iconColor = extractDecorColor(decor?.iconClass);
  if (preset) return preset;
  return {
    fill: iconColor || "#E64646",
  };
}

function getDominantRestaurantTag(group = {}) {
  const counts = new Map();
  for (const dish of Array.isArray(group?.dishes) ? group.dishes : []) {
    const tags = Array.isArray(dish?.tags) ? dish.tags : [];
    for (const rawTag of tags) {
      const tag = String(rawTag || "").trim().toLowerCase();
      if (!TAG_ORDER_INDEX.has(tag)) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  let winner = "";
  let winnerCount = -1;
  let winnerOrder = Number.POSITIVE_INFINITY;
  for (const [tag, count] of counts.entries()) {
    const order = TAG_ORDER_INDEX.get(tag) ?? Number.POSITIVE_INFINITY;
    if (count > winnerCount || (count === winnerCount && order < winnerOrder)) {
      winner = tag;
      winnerCount = count;
      winnerOrder = order;
    }
  }
  return winner || "";
}

function getRestaurantTagIconSvg(tag = "") {
  const normalizedTag = String(tag || "").trim().toLowerCase();
  const decor = TAG_DECOR[normalizedTag];
  const Icon = decor?.icon;
  if (!Icon) return null;
  const iconMarkup = renderToStaticMarkup(
    createElement(Icon, {
      className: "",
      strokeWidth: 1.95,
    })
  ).replace("<svg ", `<svg width="23" height="23" `);
  const iconColor = extractDecorColor(decor?.iconClass);
  return `<g transform="translate(11.5,9.25)" style="color:${iconColor};filter:drop-shadow(0 1px 1px rgba(0,0,0,0.28))">${iconMarkup}</g>`;
}

const getRestaurantPinSvg = (
  strokeColor = "white",
  fillColor = "#E64646",
  symbolMarkup = "",
  showInnerBadge = true
) => encodeURIComponent(`
<svg width="46" height="54" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="pinShadow" x="0" y="0" width="46" height="54" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="2.2" stdDeviation="2.2" flood-color="#000000" flood-opacity="0.26"/>
    </filter>
  </defs>
  <g filter="url(#pinShadow)">
    <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" fill="${fillColor}"/>
    <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" stroke="${strokeColor}" stroke-width="2.35"/>
  </g>
  ${showInnerBadge ? '<circle cx="23" cy="20.5" r="12.4" fill="#111111"/>' : ""}
  ${symbolMarkup || `<g transform="translate(15.35 12.9) scale(0.66)" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v6"/>
    <path d="M5 2v6"/>
    <path d="M7 2v6"/>
    <path d="M3 8c0 1.1.9 2 2 2s2-.9 2-2"/>
    <path d="M5 10v12"/>
    <path d="M19 2c-2.8 1.6-4 4.1-4 7.5V13h4"/>
    <path d="M19 2v20"/>
  </g>`}
</svg>`);

function getRestaurantMarkerIcon(markerTone = "default", dominantTag = "") {
  if (typeof window === "undefined" || !window.google?.maps) return undefined;
  const selected = markerTone === "selected";
  const strokeColor = selected ? "#D9A500" : markerTone === "own" ? "#2BD36B" : markerTone === "followed" ? "#F2C94C" : "white";
  const normalizedTag = String(dominantTag || "").trim().toLowerCase();
  const tagTheme = normalizedTag ? getTagPinTheme(normalizedTag) : null;
  const fillColor = selected ? "#F2C94C" : tagTheme?.fill || "#E64646";
  const tagSymbolMarkup = normalizedTag ? getRestaurantTagIconSvg(normalizedTag) : null;
  const hasTagSymbol =
    typeof tagSymbolMarkup === "string" &&
    tagSymbolMarkup.length > 0 &&
    !tagSymbolMarkup.includes("undefined") &&
    !tagSymbolMarkup.includes("NaN");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${getRestaurantPinSvg(
      strokeColor,
      fillColor,
      hasTagSymbol ? tagSymbolMarkup : "",
      !hasTagSymbol
    )}`,
    scaledSize: new window.google.maps.Size(selected ? 40 : 36, selected ? 47 : 42),
    anchor: new window.google.maps.Point(selected ? 20 : 18, selected ? 47 : 42),
  };
}

function normalizeUserIds(values = []) {
  return new Set(
    (Array.isArray(values) ? values : [values])
      .flatMap((value) => {
        if (!value || typeof value !== "object") return [value];
        return [value.id, value.uid, value.userId, value.owner, value.ownerId, value.profileId];
      })
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
}

function getMapUserIds(mapUser) {
  return [mapUser?.id, ...(Array.isArray(mapUser?.aliases) ? mapUser.aliases : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function mapUserMatchesIdSet(mapUser, idSet) {
  return getMapUserIds(mapUser).some((id) => idSet.has(id));
}

function createFollowedAvatarOverlay({ map, position, users, onClick }) {
  if (typeof window === "undefined" || !window.google?.maps || !users?.length) return null;
  const overlay = new window.google.maps.OverlayView();
  let node = null;

  overlay.onAdd = function onAdd() {
    node = document.createElement("button");
    node.type = "button";
    node.setAttribute("aria-label", "Open restaurant");
    node.style.position = "absolute";
    node.style.display = "flex";
    node.style.alignItems = "center";
    node.style.justifyContent = "center";
    node.style.gap = "0";
    node.style.padding = "0";
    node.style.border = "0";
    node.style.background = "transparent";
    node.style.cursor = "pointer";
    node.style.transform = "translate(-50%, -100%) translateY(-44px)";
    node.style.zIndex = "4";
    node.addEventListener("click", onClick);

    users.slice(0, 3).forEach((user, index) => {
      const avatar = document.createElement(user.photoURL ? "img" : "span");
      avatar.style.width = "23px";
      avatar.style.height = "23px";
      avatar.style.borderRadius = "999px";
      avatar.style.border = "0";
      avatar.style.background = "#111111";
      avatar.style.color = "white";
      avatar.style.boxShadow = "0 5px 12px rgba(0,0,0,0.24)";
      avatar.style.objectFit = "cover";
      avatar.style.display = "flex";
      avatar.style.alignItems = "center";
      avatar.style.justifyContent = "center";
      avatar.style.fontSize = "10px";
      avatar.style.fontWeight = "800";
      if (index > 0) avatar.style.marginLeft = "-7px";
      if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.alt = user.name || "User";
      } else {
        avatar.textContent = (user.name || "U").slice(0, 1).toUpperCase();
      }
      node.appendChild(avatar);
    });

    this.getPanes()?.overlayMouseTarget.appendChild(node);
  };

  overlay.draw = function draw() {
    if (!node) return;
    const projection = this.getProjection();
    if (!projection) return;
    const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(position.lat, position.lng));
    if (!point) return;
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
  };

  overlay.onRemove = function onRemove() {
    if (node) {
      node.removeEventListener("click", onClick);
      node.remove();
      node = null;
    }
  };

  overlay.setMap(map);
  return overlay;
}

function Avatar({ user }) {
  if (!user) return null;
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.name || "User"}
        className="h-8 w-8 rounded-full object-cover border border-black/10"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-[#F6F1E8] text-xs font-semibold text-black/65">
      {(user.name || "U").slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function RestaurantMapView({
  groups = [],
  emptyTitle = "No restaurant dishes yet",
  emptyText = "Nothing pinned here yet.",
  dishHrefBuilder,
  onDishSelect,
  initialSelectedPlaceId = "",
  className = "",
  showSearch = true,
  embedded = false,
  onMapClick = null,
  currentLocation = null,
  enableFollowingFilter = false,
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const carouselTrackRef = useRef(null);
  const markersRef = useRef([]);
  const mapGestureUntilRef = useRef(0);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const requestRef = useRef(0);
  const [mapState, setMapState] = useState("loading");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [sheetDirection, setSheetDirection] = useState(0);
  const [followingIds, setFollowingIds] = useState([]);
  const [restaurantCardHeight, setRestaurantCardHeight] = useState(0);
  const [carouselStepPx, setCarouselStepPx] = useState(0);
  const [carouselAnchorPlaceId, setCarouselAnchorPlaceId] = useState("");
  const [carouselDragX, setCarouselDragX] = useState(0);
  const [carouselDragging, setCarouselDragging] = useState(false);
  const [restaurantFilter, setRestaurantFilter] = useState("all");
  const swipeStartRef = useRef(null);
  const carouselTapRef = useRef(null);
  const carouselDragRef = useRef(null);
  const carouselPendingGroupRef = useRef(null);
  const carouselSilentResetRef = useRef(false);
  const cardSwipeHandledUntilRef = useRef(0);
  const cameraAnimationRef = useRef(0);
  const useRestaurantCarousel = !embedded;
  const followingIdSet = useMemo(() => normalizeUserIds(followingIds), [followingIds]);
  const ownIdSet = useMemo(() => normalizeUserIds([user?.uid, user?.id, user?.userId]), [user?.id, user?.uid, user?.userId]);
  const displayedGroups = useMemo(() => {
    if (!enableFollowingFilter || restaurantFilter !== "following") return groups;
    return groups.filter((group) =>
      (group.users || []).some((groupUser) => mapUserMatchesIdSet(groupUser, followingIdSet))
    );
  }, [enableFollowingFilter, followingIdSet, groups, restaurantFilter]);

  const animateMapCamera = (center, zoom, { duration = 520 } = {}) => {
    const map = mapRef.current;
    if (!map || !center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng) || !Number.isFinite(zoom)) return;
    const startCenter = getMapCenterLiteral(map) || center;
    const startZoom = Number(map.getZoom?.() || zoom);
    const animationId = cameraAnimationRef.current + 1;
    cameraAnimationRef.current = animationId;
    const startedAt = performance.now();

    const step = (now) => {
      if (cameraAnimationRef.current !== animationId) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutCubic(progress);
      const nextCenter = {
        lat: startCenter.lat + (center.lat - startCenter.lat) * eased,
        lng: startCenter.lng + (center.lng - startCenter.lng) * eased,
      };
      const nextZoom = startZoom + (zoom - startZoom) * eased;
      if (typeof map.moveCamera === "function") {
        map.moveCamera({ center: nextCenter, zoom: nextZoom });
      } else {
        map.setCenter(nextCenter);
        map.setZoom(nextZoom);
      }
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        map.setCenter(center);
        map.setZoom(zoom);
      }
    };

    window.requestAnimationFrame(step);
  };

  const focusMapOnGroup = (group, { keepAboveSheet = false } = {}) => {
    if (!mapRef.current || !group || !Number.isFinite(group.lat) || !Number.isFinite(group.lng)) return;
    const currentZoom = mapRef.current.getZoom?.() || 0;
    const nextZoom = currentZoom < 14 ? 14 : currentZoom;
    if (!keepAboveSheet) {
      animateMapCamera({ lat: group.lat, lng: group.lng }, nextZoom);
      return;
    }
    const adjust = () => {
      const mapRect = mapNodeRef.current?.getBoundingClientRect?.();
      const sheetRect = sheetRef.current?.getBoundingClientRect?.();
      if (!mapRect?.height || !sheetRect?.height) {
        mapRef.current?.setCenter({ lat: group.lat, lng: group.lng });
        return;
      }
      const sheetTop = Math.max(0, sheetRect.top - mapRect.top);
      const desiredPinY = Math.max(embedded ? 34 : 56, sheetTop - (embedded ? 96 : 28));
      const verticalOffsetPx = Math.max(0, mapRect.height / 2 - desiredPinY);
      const center = getOffsetCenter(group, nextZoom, verticalOffsetPx) || { lat: group.lat, lng: group.lng };
      animateMapCamera(center, nextZoom);
    };
    window.requestAnimationFrame(adjust);
    window.setTimeout(adjust, 260);
  };

  const selectedGroup = useMemo(() => {
    if (selectedPlaceId === "__none__") return null;
    if (!selectedPlaceId) return null;
    return displayedGroups.find((group) => group.placeId === selectedPlaceId) || displayedGroups[0] || null;
  }, [displayedGroups, selectedPlaceId]);
  const carouselGroups = useMemo(() => {
    if (!useRestaurantCarousel || !displayedGroups.length) return displayedGroups;
    const anchor = displayedGroups.find((group) => group.placeId === carouselAnchorPlaceId) || selectedGroup || displayedGroups[0];
    return [...displayedGroups].sort((a, b) => {
      if (a.placeId === anchor.placeId) return -1;
      if (b.placeId === anchor.placeId) return 1;
      const distanceDiff = getRestaurantDistanceMeters(anchor, a) - getRestaurantDistanceMeters(anchor, b);
      if (distanceDiff !== 0) return distanceDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [carouselAnchorPlaceId, displayedGroups, selectedGroup, useRestaurantCarousel]);
  const selectedGroupUsers = useMemo(() => {
    const users = Array.isArray(selectedGroup?.users) ? [...selectedGroup.users] : [];
    return users.sort((a, b) => {
      const aFollowed = mapUserMatchesIdSet(a, followingIdSet) ? 1 : 0;
      const bFollowed = mapUserMatchesIdSet(b, followingIdSet) ? 1 : 0;
      if (aFollowed !== bFollowed) return bFollowed - aFollowed;
      const aOwn = mapUserMatchesIdSet(a, ownIdSet) ? 1 : 0;
      const bOwn = mapUserMatchesIdSet(b, ownIdSet) ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [followingIdSet, ownIdSet, selectedGroup?.users]);
  const selectedGroupDishes = useMemo(() => {
    if (!selectedGroupUsers.length) return [];
    return selectedGroupUsers
      .flatMap((groupUser) =>
        (groupUser.dishes || []).map((dish) => ({
          dish,
          user: groupUser,
        }))
      )
      .filter((item) => item.dish?.id);
  }, [selectedGroupUsers]);
  const selectedDishUsers = useMemo(
    () => selectedGroupUsers.filter((groupUser) => (groupUser.dishes || []).some((dish) => dish?.id)),
    [selectedGroupUsers]
  );
  const selectedGroupRating = useMemo(() => {
    const ratings = selectedGroupDishes
      .map((item) => Math.max(0, Math.min(5, Number(item.dish?.rating) || 0)))
      .filter((rating) => rating > 0);
    return ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 2) / 2 : 0;
  }, [selectedGroupDishes]);

  useEffect(() => {
    if (!initialSelectedPlaceId) return;
    setSelectedPlaceId(initialSelectedPlaceId);
    if (useRestaurantCarousel) setCarouselAnchorPlaceId(initialSelectedPlaceId);
  }, [initialSelectedPlaceId, useRestaurantCarousel]);

  useEffect(() => {
    if (!user?.uid) {
      setFollowingIds([]);
      return undefined;
    }
    let cancelled = false;
    getFollowingForUser(user.uid, { force: true })
      .then((ids) => {
        if (!cancelled) setFollowingIds(Array.isArray(ids) ? ids : []);
      })
      .catch((error) => {
        console.error("Failed to load following for restaurant map:", error);
        if (!cancelled) setFollowingIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    focusMapOnGroup(selectedGroup, { keepAboveSheet: true });
  }, [selectedDishUsers.length, selectedGroup?.placeId]);

  useEffect(() => {
    if (!useRestaurantCarousel || !sheetRef.current) return undefined;
    const updateHeight = () => {
      const activeCard = sheetRef.current?.querySelector?.("[data-restaurant-active-card='true']");
      const nextHeight = Math.round(activeCard?.getBoundingClientRect?.().height || 0);
      if (nextHeight > 0) setRestaurantCardHeight(nextHeight);
    };
    updateHeight();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    const activeCard = sheetRef.current.querySelector?.("[data-restaurant-active-card='true']");
    if (resizeObserver && activeCard) resizeObserver.observe(activeCard);
    const timeout = window.setTimeout(updateHeight, 120);
    return () => {
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
    };
  }, [selectedDishUsers.length, selectedGroup?.placeId, useRestaurantCarousel]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted) return;
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        placesServiceRef.current = new google.maps.places.PlacesService(document.createElement("div"));
        setMapState("ready");
      })
      .catch((error) => {
        console.warn("Map unavailable:", error);
        if (!mounted) return;
        setMapState("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (mapState !== "ready") return;
    if (!searchFocused) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setPredictions([]);
      setLoadingPredictions(false);
      return;
    }

    const localMatches = displayedGroups
      .filter((group) => group.name?.toLowerCase().includes(trimmed.toLowerCase()))
      .slice(0, 4)
      .map((group) => ({
        place_id: group.placeId,
        description: group.address || group.name,
        structured_formatting: {
          main_text: group.name,
          secondary_text: group.address || "Pinned restaurant",
        },
      }));

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoadingPredictions(true);

    const timeoutId = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        { input: trimmed },
        (results, status) => {
          if (requestRef.current !== requestId) return;
          const googleResults =
            status === window.google?.maps?.places?.PlacesServiceStatus?.OK && Array.isArray(results)
              ? results
              : [];
          const seen = new Set();
          const merged = [
            ...localMatches.map((item) => ({
              ...item,
              _pinnedGroup: displayedGroups.find((group) => group.placeId === item.place_id) || null,
            })),
            ...googleResults,
          ].filter((item) => {
            const key = item.place_id || item.description;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setPredictions(merged.slice(0, 6));
          setLoadingPredictions(false);
        }
      );
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [displayedGroups, mapState, query, searchFocused]);

  useEffect(() => {
    if (mapState !== "ready") return;
    if (!mapNodeRef.current) return;
    if (mapRef.current) return;

    mapRef.current = new window.google.maps.Map(mapNodeRef.current, {
      center:
        Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng)
          ? { lat: currentLocation.lat, lng: currentLocation.lng }
          : { lat: 45.4642, lng: 9.19 },
      zoom:
        Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng)
          ? 12
          : 5,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      styles: [
        {
          featureType: "poi.business",
          stylers: [{ visibility: "off" }],
        },
      ],
    });
    mapRef.current.addListener("dragstart", () => {
      mapGestureUntilRef.current = Date.now() + 450;
    });
    mapRef.current.addListener("zoom_changed", () => {
      mapGestureUntilRef.current = Date.now() + 650;
    });
    if (typeof onMapClick === "function") {
      mapRef.current.addListener("click", () => {
        if (Date.now() < mapGestureUntilRef.current) return;
        onMapClick();
      });
    }
  }, [currentLocation?.lat, currentLocation?.lng, mapState, onMapClick]);

  useEffect(() => {
    if (!mapRef.current || mapState !== "ready") return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!displayedGroups.length) {
      setSelectedPlaceId("__none__");
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    displayedGroups.forEach((group) => {
      const position = { lat: group.lat, lng: group.lng };
      const followedUsers = (group.users || []).filter((groupUser) => mapUserMatchesIdSet(groupUser, followingIdSet));
      const ownUsers = (group.users || []).filter((groupUser) => mapUserMatchesIdSet(groupUser, ownIdSet));
      const hasFollowedUser = followedUsers.length > 0;
      const hasOwnUser = ownUsers.length > 0;
      const markerUsers = [...ownUsers, ...followedUsers.filter((groupUser) => !mapUserMatchesIdSet(groupUser, ownIdSet))];
      const selected = selectedPlaceId === group.placeId;
      const dominantTag = getDominantRestaurantTag(group);
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: group.name,
        icon: getRestaurantMarkerIcon(selected ? "selected" : hasOwnUser ? "own" : hasFollowedUser ? "followed" : "default", dominantTag),
        zIndex: selected ? 20 : undefined,
      });
      marker.addListener("click", () => {
        if (Date.now() < mapGestureUntilRef.current) return;
        mapGestureUntilRef.current = Date.now() + 120;
        if (useRestaurantCarousel) setCarouselAnchorPlaceId(group.placeId);
        setSelectedPlaceId(group.placeId);
      });
      markersRef.current.push(marker);
      if (markerUsers.length) {
        const overlay = createFollowedAvatarOverlay({
          map: mapRef.current,
          position,
          users: markerUsers,
          onClick: () => {
            if (Date.now() < mapGestureUntilRef.current) return;
            mapGestureUntilRef.current = Date.now() + 120;
            if (useRestaurantCarousel) setCarouselAnchorPlaceId(group.placeId);
            setSelectedPlaceId(group.placeId);
          },
        });
        if (overlay) markersRef.current.push(overlay);
      }
      bounds.extend(position);
    });

    setSelectedPlaceId((current) => {
      if (current === "__none__") return current;
      return current && displayedGroups.some((group) => group.placeId === current) ? current : "__none__";
    });

    const highlightedGroup =
      (initialSelectedPlaceId && displayedGroups.find((group) => group.placeId === initialSelectedPlaceId)) ||
      (selectedPlaceId && selectedPlaceId !== "__none__" && displayedGroups.find((group) => group.placeId === selectedPlaceId));

    if (highlightedGroup) {
      focusMapOnGroup(highlightedGroup, { keepAboveSheet: Boolean(selectedPlaceId && selectedPlaceId !== "__none__") });
      return;
    }

    if (selectedPlaceId === "__none__") return;

    if (displayedGroups.length === 1) {
      focusMapOnGroup(displayedGroups[0], { keepAboveSheet: Boolean(selectedPlaceId && selectedPlaceId !== "__none__") });
      return;
    }

    if (Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng)) {
      mapRef.current.setCenter({ lat: currentLocation.lat, lng: currentLocation.lng });
      mapRef.current.setZoom(12);
      return;
    }

    mapRef.current.setCenter({ lat: 45.4642, lng: 9.19 });
    mapRef.current.setZoom(5);
  }, [currentLocation?.lat, currentLocation?.lng, displayedGroups, followingIdSet, initialSelectedPlaceId, mapState, ownIdSet, selectedPlaceId, useRestaurantCarousel]);

  const openDish = (dish) => {
    if (!dish?.id) return;
    if (onDishSelect) {
      onDishSelect(dish);
      return;
    }
    const href = dishHrefBuilder ? dishHrefBuilder(dish) : `/dish/${dish.id}?source=public&mode=single`;
    router.push(href);
  };

  const selectedIndex = useMemo(
    () => Math.max(0, carouselGroups.findIndex((group) => group.placeId === selectedGroup?.placeId)),
    [carouselGroups, selectedGroup?.placeId]
  );
  const carouselWindowItems = useMemo(() => {
    if (!useRestaurantCarousel || !carouselGroups.length || !selectedGroup) return [];
    const count = carouselGroups.length;
    const offsets = count > 2 ? [-2, -1, 0, 1, 2] : count === 2 ? [-1, 0, 1] : [0];
    return offsets.map((offset, slotIndex) => {
      const index = (selectedIndex + offset + count) % count;
      const group = carouselGroups[index];
      return {
        group,
        offset,
        slotIndex,
        key: `${group.placeId}-${offset}-${slotIndex}`,
      };
    });
  }, [carouselGroups, selectedGroup, selectedIndex, useRestaurantCarousel]);
  const carouselCenterSlot = useMemo(
    () => Math.max(0, carouselWindowItems.findIndex((item) => item.offset === 0)),
    [carouselWindowItems]
  );

  const cycleRestaurant = (direction) => {
    if (!carouselGroups.length) return;
    const nextIndex = (selectedIndex + direction + carouselGroups.length) % carouselGroups.length;
    focusGroup(carouselGroups[nextIndex], direction, { preserveAnchor: true });
  };

  const settleCarouselToDirection = (direction) => {
    if (!carouselGroups.length) return;
    const nextIndex = (selectedIndex + direction + carouselGroups.length) % carouselGroups.length;
    const targetGroup = carouselGroups[nextIndex];
    if (!targetGroup) return;
    const step = carouselStepPx || carouselTrackRef.current?.firstElementChild?.getBoundingClientRect?.().width || 0;
    if (!step) {
      focusGroup(targetGroup, direction, { preserveAnchor: true });
      return;
    }
    carouselPendingGroupRef.current = { group: targetGroup, direction };
    setCarouselDragging(false);
    setCarouselDragX(direction > 0 ? -step : step);
  };

  const finishCarouselSettle = () => {
    const pending = carouselPendingGroupRef.current;
    if (!pending?.group) return;
    carouselPendingGroupRef.current = null;
    carouselSilentResetRef.current = true;
    setCarouselDragging(true);
    focusGroup(pending.group, pending.direction, { preserveAnchor: true });
    setCarouselDragX(0);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        carouselSilentResetRef.current = false;
        setCarouselDragging(false);
      });
    });
  };

  const focusGroup = (group, direction = 0, { preserveAnchor = false } = {}) => {
    if (!group) return;
    setSheetDirection(direction);
    if (useRestaurantCarousel && !preserveAnchor) setCarouselAnchorPlaceId(group.placeId || "");
    setSelectedPlaceId(group.placeId || "");
    focusMapOnGroup(group, { keepAboveSheet: true });
    setQuery(group.name || "");
    setPredictions([]);
    setSearchFocused(false);
  };

  const handlePredictionSelect = (prediction) => {
    const matchingGroup = displayedGroups.find((group) => group.placeId === prediction?.place_id);
    if (matchingGroup) {
      focusGroup(matchingGroup);
      return;
    }
    if (!prediction?.place_id || !placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["place_id", "name", "geometry"],
      },
      (place, status) => {
        if (
          status !== window.google?.maps?.places?.PlacesServiceStatus?.OK ||
          !place?.geometry?.location ||
          !mapRef.current
        ) {
          return;
        }
        setSelectedPlaceId("__none__");
        setQuery(place.name || query);
        setPredictions([]);
        setSearchFocused(false);
        animateMapCamera({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }, 14);
      }
    );
  };

  const showPredictions = searchFocused && query.trim().length > 0 && predictions.length > 0;

  const getGroupDishUsers = (group) =>
    (Array.isArray(group?.users) ? group.users : []).filter((groupUser) => (groupUser.dishes || []).some((dish) => dish?.id));

  const getSortedGroupUsers = (group) => {
    const users = Array.isArray(group?.users) ? [...group.users] : [];
    return users.sort((a, b) => {
      const aFollowed = mapUserMatchesIdSet(a, followingIdSet) ? 1 : 0;
      const bFollowed = mapUserMatchesIdSet(b, followingIdSet) ? 1 : 0;
      if (aFollowed !== bFollowed) return bFollowed - aFollowed;
      const aOwn = mapUserMatchesIdSet(a, ownIdSet) ? 1 : 0;
      const bOwn = mapUserMatchesIdSet(b, ownIdSet) ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  };

  const getGroupDishes = (groupUsers) =>
    groupUsers
      .flatMap((groupUser) =>
        (groupUser.dishes || []).map((dish) => ({
          dish,
          user: groupUser,
        }))
      )
      .filter((item) => item.dish?.id);

  const getGroupRating = (group) => {
    const ratings = (Array.isArray(group?.users) ? group.users : [])
      .flatMap((groupUser) => groupUser.dishes || [])
      .map((dish) => Math.max(0, Math.min(5, Number(dish?.rating) || 0)))
      .filter((rating) => rating > 0);
    return ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 2) / 2 : 0;
  };

  const carouselGapRem = 1;
  const getCarouselTrackX = (index) => `calc(-50% - ${index * 100}% - ${index * carouselGapRem}rem)`;
  const getCarouselTrackTransform = () => {
    if (carouselStepPx > 0) {
      return `translateX(calc(-50% - ${carouselCenterSlot * carouselStepPx}px + ${carouselDragX}px))`;
    }
    return `translateX(calc(${getCarouselTrackX(carouselCenterSlot)} + ${carouselDragX}px))`;
  };

  useLayoutEffect(() => {
    if (!useRestaurantCarousel || !carouselTrackRef.current) return undefined;
    const measureStep = () => {
      const track = carouselTrackRef.current;
      const firstCard = track?.firstElementChild;
      if (!track || !firstCard) return;
      const styles = window.getComputedStyle(track);
      const columnGap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const nextStep = Math.round(firstCard.getBoundingClientRect().width + columnGap);
      if (nextStep > 0) setCarouselStepPx(nextStep);
    };
    measureStep();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureStep) : null;
    if (resizeObserver) resizeObserver.observe(carouselTrackRef.current);
    window.addEventListener("resize", measureStep);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureStep);
    };
  }, [carouselWindowItems.length, useRestaurantCarousel]);

  useEffect(() => {
    if (carouselSilentResetRef.current) return;
    setCarouselDragX(0);
    setCarouselDragging(false);
    carouselDragRef.current = null;
    carouselPendingGroupRef.current = null;
  }, [selectedGroup?.placeId]);

  const renderRestaurantPreviewCard = (group, direction, keyValue = group?.placeId) => {
    if (!group) return null;
    const dishUsers = getGroupDishUsers(group);
    return (
      <button
        key={keyValue}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          swipeStartRef.current = null;
          cardSwipeHandledUntilRef.current = Date.now() + 160;
          settleCarouselToDirection(direction);
        }}
        className="map-restaurant-card-solid flex w-full shrink-0 flex-col overflow-hidden rounded-[1.7rem] border-2 border-[#E64646]/65 px-4 py-4 text-left shadow-[0_12px_24px_rgba(0,0,0,0.11)] transition active:scale-[0.99]"
        style={{
          height: restaurantCardHeight ? `${restaurantCardHeight}px` : undefined,
          opacity: 1,
          backgroundColor: "#ffffff",
        }}
        aria-label={direction < 0 ? "Previous restaurant" : "Next restaurant"}
      >
        <div className="min-w-0">
          <div className="truncate text-[1rem] font-semibold leading-tight text-black/64">{group.name}</div>
          <div className="mt-1 flex items-center gap-1">
            <RatingStars value={getGroupRating(group)} size="text-[0.95rem]" readOnly />
          </div>
          <div className="mt-1 truncate text-[11px] font-bold text-black/38">
            {dishUsers.length} {t(dishUsers.length === 1 ? "person count" : "people count")}
          </div>
        </div>
        <div className="mt-auto flex -space-x-2 pt-2">
          {dishUsers.slice(0, 3).map((dishUser) => (
            dishUser.photoURL ? (
              <img
                key={`${group.placeId}-${dishUser.id}-ghost`}
                src={dishUser.photoURL}
                alt=""
                className="h-8 w-8 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span
                key={`${group.placeId}-${dishUser.id}-ghost`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[10px] font-black text-white shadow-sm"
              >
                {(dishUser.name || "U").slice(0, 1).toUpperCase()}
              </span>
            )
          ))}
        </div>
      </button>
    );
  };

  const renderActiveRestaurantCard = (group = selectedGroup, keyValue = group?.placeId) => {
    if (!group) return null;
    const cardUsers = group.placeId === selectedGroup?.placeId ? selectedGroupUsers : getSortedGroupUsers(group);
    const cardDishUsers = cardUsers.filter((groupUser) => (groupUser.dishes || []).some((dish) => dish?.id));
    const cardGroupDishes = group.placeId === selectedGroup?.placeId ? selectedGroupDishes : getGroupDishes(cardUsers);
    const cardRating = group.placeId === selectedGroup?.placeId
      ? selectedGroupRating
      : (() => {
          const ratings = cardGroupDishes
            .map((item) => Math.max(0, Math.min(5, Number(item.dish?.rating) || 0)))
            .filter((rating) => rating > 0);
          return ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 2) / 2 : 0;
        })();
    const googleMapsUrl = getRestaurantGoogleMapsUrl(group);

    return (
    <motion.div
      key={keyValue}
      data-restaurant-active-card="true"
      custom={sheetDirection}
      initial={{
        x: useRestaurantCarousel ? 0 : sheetDirection > 0 ? 86 : sheetDirection < 0 ? -86 : 0,
        opacity: useRestaurantCarousel ? 1 : 0,
        scale: 1,
      }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{
        x: sheetDirection > 0 ? -86 : sheetDirection < 0 ? 86 : 0,
        opacity: useRestaurantCarousel ? 1 : 0,
        scale: 1,
      }}
      transition={useRestaurantCarousel ? { duration: 0.34, ease: [0.2, 0.76, 0.26, 1] } : { duration: 0.22, ease: "easeOut" }}
      drag={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.22}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const offsetX = info.offset.x;
        const offsetY = info.offset.y;
        if (Math.abs(offsetX) > 24 && Math.abs(offsetX) > Math.abs(offsetY) * 0.5) {
          cardSwipeHandledUntilRef.current = Date.now() + 160;
          cycleRestaurant(offsetX < 0 ? 1 : -1);
        }
      }}
      className={`map-restaurant-card-solid restaurant-accent-border ${
        useRestaurantCarousel ? "relative w-full shrink-0" : "relative w-full"
      } z-10 mx-auto flex min-h-0 flex-col overflow-hidden border-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)] ${
        embedded
          ? "bottom-0 h-[min(17rem,calc(100%-6.2rem))] rounded-[1.35rem] p-3"
          : "bottom-0 max-h-[min(28rem,calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-1.5rem))] rounded-[1.7rem] p-4"
      }`}
      style={{ opacity: 1, touchAction: "pan-y" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="shrink-0 text-[#E64646]" />
            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-[1rem] font-semibold text-black underline decoration-black/30 underline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                {group.name}
              </a>
            ) : (
              <div className="truncate text-[1rem] font-semibold text-black">{group.name}</div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <RatingStars value={cardRating} size="text-[0.95rem]" readOnly />
            <span className="text-[11px] font-bold text-black/45">
              {cardDishUsers.length} {t(cardDishUsers.length === 1 ? "person count" : "people count")}
            </span>
          </div>
          <div className="mt-1 text-[0.82rem] font-semibold leading-5 text-black/66">{formatRestaurantPlaceLine(group)}</div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedPlaceId("__none__")}
          className="restaurant-accent-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-black/5 text-black/55"
          aria-label="Close restaurant details"
        >
          <X size={15} />
        </button>
      </div>

      {cardDishUsers.length ? (
        <div
          data-restaurant-card-scroll="true"
          className="mt-3 flex min-h-0 flex-1 touch-pan-y flex-col gap-4 overflow-y-auto overscroll-y-contain pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {cardDishUsers.map((dishUser) => {
            const userDishes = (dishUser.dishes || []).filter((dish) => dish?.id);
            if (!userDishes.length) return null;
            return (
              <div key={`${group.placeId}-${dishUser.id}`} className="min-w-0">
                <button
                  type="button"
                  onClick={() => dishUser.id && router.push(`/profile/${encodeURIComponent(dishUser.id)}`)}
                  className="mb-2 flex min-w-0 items-center gap-2 text-left"
                >
                  <Avatar user={dishUser} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-black leading-none text-black">
                    {dishUser.name || "User"}
                  </span>
                </button>
                <div
                  className="flex max-w-full touch-pan-x snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ WebkitOverflowScrolling: "touch", touchAction: "auto" }}
                  onPointerDown={(event) => {
                    carouselTapRef.current = { x: event.clientX, y: event.clientY, moved: false };
                  }}
                  onPointerMove={(event) => {
                    const start = carouselTapRef.current;
                    if (!start || start.moved) return;
                    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) {
                      start.moved = true;
                    }
                  }}
                  onClickCapture={(event) => {
                    if (!carouselTapRef.current?.moved) return;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerUp={(event) => {
                    if (carouselTapRef.current?.moved) event.stopPropagation();
                    window.setTimeout(() => {
                      carouselTapRef.current = null;
                    }, 0);
                  }}
                  data-restaurant-card-scroll="true"
                >
                  {userDishes.map((dish) => (
                    <button
                      key={`${group.placeId}-${dishUser.id}-${dish.id}`}
                      type="button"
                      onClick={() => openDish(dish)}
                  className={`restaurant-accent-border flex shrink-0 snap-start overflow-hidden border-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.08)] ${
                    embedded ? "h-32 w-32 rounded-[1rem]" : "h-40 w-40 rounded-[1.25rem]"
                  }`}
                    >
                      <div className="relative h-full w-full overflow-hidden">
                        <DishRatingBadge dish={dish} className="text-[10px]" />
                        <img
                          src={getDishImageUrl(dish, "thumb")}
                          alt={dish.name || "Dish"}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_DISH_IMAGE;
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 z-20 flex min-h-[58%] flex-col justify-end bg-gradient-to-t from-black via-black/86 via-58% to-transparent px-2.5 pb-2.5 pt-14 text-white pointer-events-none">
                          <div className="truncate text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                            {dish.name || "Untitled dish"}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {cardUsers.some((mapUser) => mapUser.leaderboardAnswers?.[0]) ? (
        <div className="mt-3 flex max-w-full touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {cardUsers.filter((mapUser) => mapUser.leaderboardAnswers?.[0]).map((mapUser) => (
            <div key={`${group.placeId}-${mapUser.id}-leaderboard`} className="w-40 shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => router.push(`/leaderboard/${mapUser.leaderboardAnswers[0].questionId}`)}
                  className="restaurant-accent-border min-h-[4.2rem] w-full rounded-[1.25rem] border-2 bg-[linear-gradient(145deg,#261010_0%,#3A1515_52%,#120909_100%)] px-3 py-3 text-left shadow-[0_12px_26px_rgba(0,0,0,0.22)] transition active:scale-[0.98]"
                >
                  <div className="line-clamp-2 text-[12px] font-bold leading-tight text-white/86">
                    {mapUser.leaderboardAnswers[0].questionTitle || "Leaderboard"}
                  </div>
                  <div className="mt-2 truncate text-[13px] font-bold text-[#FFB4B4]">
                    {mapUser.leaderboardAnswers[0].text || group.name}
                  </div>
                  <div className="mt-2 inline-flex items-center rounded-full border border-[#E64646]/35 bg-[#E64646]/18 px-2 py-1 text-[10px] font-black text-[#FFD7D7]">
                    {Math.max(0, Number(mapUser.leaderboardAnswers[0].voteCount || 0))} voti
                  </div>
                </button>
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
    );
  };

  return (
    <div className={embedded ? `h-full w-full overflow-hidden ${className}` : `restaurant-accent-border min-h-[22rem] overflow-hidden rounded-[2rem] border-2 bg-[#F4EFE6] shadow-[0_24px_50px_rgba(0,0,0,0.10)] ${className}`}>
      <div className="relative h-full min-h-0 overflow-hidden rounded-[inherit]">
        {showSearch ? (
        <div className="absolute inset-x-3 top-3 z-10">
          <div className="restaurant-accent-border overflow-hidden rounded-[0.95rem] border bg-white/95 shadow-[0_10px_22px_rgba(0,0,0,0.10)] backdrop-blur-md">
            <div className="flex min-h-[2.65rem] items-center gap-2 px-3 py-1.5">
              <Search size={15} className="shrink-0 text-black/35" />
              <input
                type="text"
                value={query}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search restaurant"
                className="w-full bg-transparent text-[16px] text-black placeholder:text-black/35 focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    setPredictions([]);
                  }}
                  className="restaurant-accent-border flex h-6 w-6 items-center justify-center rounded-full border bg-black/5 text-black/55"
                  aria-label="Clear restaurant search"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            {loadingPredictions ? (
              <div className="border-t border-black/6 px-3 py-2 text-xs text-black/45">Searching...</div>
            ) : null}
            {showPredictions ? (
              <div className="max-h-52 overflow-y-auto border-t border-black/6 bg-[#FFFCF7]">
                {predictions.map((prediction) => {
                  const pinnedUsers = prediction._pinnedGroup?.users?.slice(0, 3) || [];
                  return (
                    <button
                      key={prediction.place_id || prediction.description}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handlePredictionSelect(prediction)}
                      className="flex w-full items-start gap-2 border-b border-black/6 px-3 py-2.5 text-left last:border-b-0 hover:bg-black/[0.03]"
                    >
                      <MapPin size={14} className="mt-0.5 shrink-0 text-[#E64646]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-black">
                          {prediction.structured_formatting?.main_text || prediction.description}
                        </div>
                        <div className="truncate text-xs text-black/45">
                          {prediction.structured_formatting?.secondary_text || prediction.description}
                        </div>
                      </div>
                      {pinnedUsers.length ? (
                        <div className="ml-auto flex shrink-0 items-center pt-0.5">
                          {pinnedUsers.map((mapUser, index) => (
                            mapUser.photoURL ? (
                              <img
                                key={`${prediction.place_id}-${mapUser.id}`}
                                src={mapUser.photoURL}
                                alt={mapUser.name || "User"}
                                className={`h-6 w-6 rounded-full object-cover shadow-sm ${index > 0 ? "-ml-2" : ""}`}
                              />
                            ) : (
                              <span
                                key={`${prediction.place_id}-${mapUser.id}`}
                                className={`flex h-6 w-6 items-center justify-center rounded-full bg-black text-[9px] font-black text-white shadow-sm ${index > 0 ? "-ml-2" : ""}`}
                              >
                                {(mapUser.name || "U").slice(0, 1).toUpperCase()}
                              </span>
                            )
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        ) : null}
        {enableFollowingFilter ? (
          <div className="absolute right-3 top-[4.2rem] z-[11]">
            <div className="no-accent-border inline-flex h-8 items-center gap-0.5 rounded-full bg-black/84 p-0.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setRestaurantFilter("all")}
                className={`no-accent-border inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold leading-none ${restaurantFilter === "all" ? "" : "text-white/82"}`}
                style={restaurantFilter === "all" ? { backgroundColor: "#F2C94C", color: "#050505", WebkitTextFillColor: "#050505" } : undefined}
              >
                {language === "it" ? "Tutti" : "All"}
              </button>
              <button
                type="button"
                onClick={() => setRestaurantFilter("following")}
                className={`no-accent-border inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold leading-none ${restaurantFilter === "following" ? "" : "text-white/82"}`}
                style={restaurantFilter === "following" ? { backgroundColor: "#F2C94C", color: "#050505", WebkitTextFillColor: "#050505" } : undefined}
              >
                {language === "it" ? "Seguiti" : "Following"}
              </button>
            </div>
          </div>
        ) : null}

        {mapState === "ready" && displayedGroups.length > 0 ? (
          <div ref={mapNodeRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="text-lg font-semibold text-black">
                {mapState === "error" ? "Map unavailable" : emptyTitle}
              </div>
              <div className="mt-2 text-sm leading-6 text-black/55">
                {mapState === "error" ? "Google Maps could not be loaded right now." : emptyText}
              </div>
            </div>
          </div>
        )}

        {selectedGroup && mapState === "ready" ? (
          <div
            ref={sheetRef}
            data-card-toggle-surface={embedded ? "true" : undefined}
            className={`absolute inset-x-3 z-10 overflow-visible ${embedded ? "bottom-[5.6rem]" : "bottom-3"}`}
            onClick={(event) => {
              if (!embedded || typeof onMapClick !== "function") return;
              if (event.target?.closest?.("button, a, input, textarea, select, [role='button']")) return;
              onMapClick();
            }}
          >
            <div
              className={`relative mx-auto w-full overflow-visible ${
                embedded
                  ? ""
                  : "h-[min(28rem,calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-1.5rem))]"
              }`}
            >
              {useRestaurantCarousel ? (
                <div
                  ref={carouselTrackRef}
                  className="absolute bottom-0 left-1/2 flex w-[86%] max-w-[27rem] items-end gap-4"
                  onPointerDown={(event) => {
                    if (event.target?.closest?.("button, a, input, textarea, select, [role='button']")) return;
                    carouselDragRef.current = { x: event.clientX, y: event.clientY, active: false };
                    setCarouselDragging(true);
                    setCarouselDragX(0);
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = carouselDragRef.current;
                    if (!start) return;
                    const dx = event.clientX - start.x;
                    const dy = event.clientY - start.y;
                    if (!start.active && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
                    if (!start.active && Math.abs(dy) > Math.abs(dx) * 1.3) {
                      carouselDragRef.current = null;
                      setCarouselDragging(false);
                      setCarouselDragX(0);
                      return;
                    }
                    start.active = true;
                    event.preventDefault();
                    setCarouselDragX(Math.max(-220, Math.min(220, dx)));
                  }}
                  onPointerUp={(event) => {
                    const start = carouselDragRef.current;
                    carouselDragRef.current = null;
                    setCarouselDragging(false);
                    if (start?.active) {
                      const dx = event.clientX - start.x;
                      const dy = event.clientY - start.y;
                      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 0.55) {
                        const direction = dx < 0 ? 1 : -1;
                        cardSwipeHandledUntilRef.current = Date.now() + 160;
                        settleCarouselToDirection(direction);
                        return;
                      }
                    }
                    setCarouselDragX(0);
                  }}
                  onPointerCancel={() => {
                    carouselDragRef.current = null;
                    setCarouselDragging(false);
                    setCarouselDragX(0);
                  }}
                  style={{
                    transform: getCarouselTrackTransform(),
                    transition: carouselDragging ? "none" : "transform 380ms cubic-bezier(0.18, 0.82, 0.24, 1)",
                    touchAction: "pan-y",
                  }}
                  onTransitionEnd={(event) => {
                    if (event.propertyName !== "transform") return;
                    finishCarouselSettle();
                  }}
                >
                  {carouselWindowItems.map(({ group, offset, key }) => (
                    renderActiveRestaurantCard(group, key)
                  ))}
                </div>
              ) : (
                <AnimatePresence initial={false} mode="wait" custom={sheetDirection}>
                  {renderActiveRestaurantCard()}
                </AnimatePresence>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
