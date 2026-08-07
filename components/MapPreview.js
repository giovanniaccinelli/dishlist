"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";
import { useAuth } from "../app/lib/auth";
import { RestaurantMapIcon } from "./DishModeControls";
import { TAG_OPTIONS } from "../app/lib/tags";
import { TAG_DECOR } from "../app/lib/tagDecor";

const MILAN_PREVIEW_CENTER = { lat: 45.4642, lng: 9.19 };
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
  if (!Number.isFinite(group?.lat) || !Number.isFinite(group?.lng)) return MILAN_PREVIEW_CENTER;
  if (!verticalOffsetPx) return { lat: group.lat, lng: group.lng };
  const point = projectLatLng({ lat: group.lat, lng: group.lng }, zoom);
  return unprojectLatLng({ x: point.x, y: point.y + verticalOffsetPx }, zoom);
}

const TAG_ORDER_INDEX = new Map(TAG_OPTIONS.map((tag, index) => [tag, index]));
const RESTAURANT_TAG_PIN_THEME = {
  fit: { fill: "#34D399", stroke: "#047857" },
  "high protein": { fill: "#FB923C", stroke: "#C2410C" },
  veg: { fill: "#38BDF8", stroke: "#0369A1" },
  vegan: { fill: "#22C55E", stroke: "#15803D" },
  light: { fill: "#5EEAD4", stroke: "#0F766E" },
  easy: { fill: "#A78BFA", stroke: "#6D28D9" },
  quick: { fill: "#2DD4BF", stroke: "#0F766E" },
  fancy: { fill: "#F472B6", stroke: "#BE185D" },
  comfort: { fill: "#FACC15", stroke: "#B45309" },
  "carb heavy": { fill: "#FDBA74", stroke: "#EA580C" },
  "low carb": { fill: "#0EA5E9", stroke: "#0369A1" },
  spicy: { fill: "#F87171", stroke: "#B91C1C" },
  "late night": { fill: "#818CF8", stroke: "#4338CA" },
  cheat: { fill: "#FB7185", stroke: "#BE123C" },
  budget: { fill: "#A3E635", stroke: "#4D7C0F" },
  premium: { fill: "#FDE047", stroke: "#A16207" },
  summer: { fill: "#F97316", stroke: "#C2410C" },
  winter: { fill: "#60A5FA", stroke: "#1D4ED8" },
  gourmet: { fill: "#C084FC", stroke: "#7E22CE" },
  "date night": { fill: "#E879F9", stroke: "#A21CAF" },
  pasta: { fill: "#FBBF24", stroke: "#B45309" },
  italian: { fill: "#4ADE80", stroke: "#DC2626" },
  ethnic: { fill: "#60A5FA", stroke: "#2563EB" },
  seafood: { fill: "#22D3EE", stroke: "#0891B2" },
  aesthetic: { fill: "#F9A8D4", stroke: "#DB2777" },
  fresh: { fill: "#34D399", stroke: "#059669" },
  asian: { fill: "#F87171", stroke: "#DC2626" },
  fried: { fill: "#FB923C", stroke: "#C2410C" },
  delivery: { fill: "#38BDF8", stroke: "#0284C7" },
  dessert: { fill: "#F472B6", stroke: "#BE185D" },
  american: { fill: "#60A5FA", stroke: "#DC2626" },
  rice: { fill: "#FDE047", stroke: "#CA8A04" },
  "fast food": { fill: "#FB7185", stroke: "#BE123C" },
};

function getRestaurantTagPinTheme(tag = "") {
  return RESTAURANT_TAG_PIN_THEME[String(tag || "").trim().toLowerCase()] || null;
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

function getRestaurantTagIconMarkup(tag = "") {
  const normalizedTag = String(tag || "").trim().toLowerCase();
  const decor = TAG_DECOR[normalizedTag];
  const Icon = decor?.icon;
  if (!Icon) return null;
  const iconMarkup = renderToStaticMarkup(
    createElement(Icon, {
      className: "",
      strokeWidth: 1.95,
    })
  ).replace("<svg ", '<svg width="23" height="23" style="display:block;color:#111111" ');
  if (!iconMarkup || iconMarkup.includes("undefined") || iconMarkup.includes("NaN")) return null;
  return iconMarkup;
}

const getRestaurantPinSvgMarkup = (
  strokeColor = "white",
  fillColor = "#FFFFFF",
  showDefaultSymbol = true
) => `
<svg width="46" height="54" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" fill="${fillColor}"/>
  <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" stroke="${strokeColor}" stroke-width="2.35"/>
  ${showDefaultSymbol ? '<circle cx="23" cy="20.5" r="12.4" fill="#111111"/>' : ""}
  ${showDefaultSymbol ? `<g transform="translate(15.35 12.9) scale(0.66)" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v6"/>
    <path d="M5 2v6"/>
    <path d="M7 2v6"/>
    <path d="M3 8c0 1.1.9 2 2 2s2-.9 2-2"/>
    <path d="M5 10v12"/>
    <path d="M19 2c-2.8 1.6-4 4.1-4 7.5V13h4"/>
    <path d="M19 2v20"/>
  </g>` : ""}
</svg>`;

function createPreviewRestaurantPinOverlay({ map, position, markerTone = "default", group = {}, title = "" }) {
  if (typeof window === "undefined" || !window.google?.maps) return null;
  const overlay = new window.google.maps.OverlayView();
  let node = null;

  overlay.onAdd = function onAdd() {
    const width = 34;
    const height = 40;
    const dominantTag = getDominantRestaurantTag(group);
    const tagTheme = dominantTag ? getRestaurantTagPinTheme(dominantTag) : null;
    const tagMarkup = dominantTag ? getRestaurantTagIconMarkup(dominantTag) : null;
    const strokeColor =
      markerTone === "own"
        ? "#2BD36B"
        : markerTone === "followed"
          ? "#F2C94C"
          : (tagTheme?.stroke || "white");
    const fillColor = tagTheme?.fill || "#FFFFFF";
    const showDefaultSymbol = !tagMarkup;

    node = document.createElement("div");
    if (title) node.title = title;
    node.style.position = "absolute";
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.transform = "translate(-50%, -100%)";
    node.style.zIndex = "12";
    node.style.pointerEvents = "none";

    const pin = document.createElement("div");
    pin.style.position = "relative";
    pin.style.width = `${width}px`;
    pin.style.height = `${height}px`;
    pin.style.filter = "drop-shadow(0 2px 2px rgba(0,0,0,0.24))";
    pin.innerHTML = getRestaurantPinSvgMarkup(strokeColor, fillColor, showDefaultSymbol)
      .replace("<svg ", `<svg width="${width}" height="${height}" style="display:block" `);

    if (tagMarkup) {
      const iconSize = 15;
      const iconWrap = document.createElement("div");
      iconWrap.style.position = "absolute";
      iconWrap.style.left = "50%";
      iconWrap.style.top = "6.6px";
      iconWrap.style.width = `${iconSize}px`;
      iconWrap.style.height = `${iconSize}px`;
      iconWrap.style.transform = "translate(-50%, 0)";
      iconWrap.style.display = "flex";
      iconWrap.style.alignItems = "center";
      iconWrap.style.justifyContent = "center";
      iconWrap.innerHTML = tagMarkup
        .replace('width="23"', `width="${iconSize}"`)
        .replace('height="23"', `height="${iconSize}"`);
      pin.appendChild(iconWrap);
    }

    node.appendChild(pin);
    this.getPanes()?.overlayLayer.appendChild(node);
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
    node?.remove();
    node = null;
  };

  overlay.setMap(map);
  return overlay;
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

function createPreviewAvatarOverlay({ map, position, users }) {
  if (typeof window === "undefined" || !window.google?.maps || !users?.length) return null;
  const overlay = new window.google.maps.OverlayView();
  let node = null;

  overlay.onAdd = function onAdd() {
    node = document.createElement("div");
    node.style.position = "absolute";
    node.style.display = "flex";
    node.style.alignItems = "center";
    node.style.justifyContent = "center";
    node.style.pointerEvents = "none";
    node.style.transform = "translate(-50%, -100%) translateY(-41px)";
    node.style.zIndex = "4";

    users.slice(0, 3).forEach((user, index) => {
      const avatar = document.createElement(user.photoURL ? "img" : "span");
      avatar.style.width = "19px";
      avatar.style.height = "19px";
      avatar.style.borderRadius = "999px";
      avatar.style.border = "0";
      avatar.style.background = "#111111";
      avatar.style.color = "white";
      avatar.style.boxShadow = "0 4px 10px rgba(0,0,0,0.24)";
      avatar.style.objectFit = "cover";
      avatar.style.display = "flex";
      avatar.style.alignItems = "center";
      avatar.style.justifyContent = "center";
      avatar.style.fontSize = "8px";
      avatar.style.fontWeight = "800";
      if (index > 0) avatar.style.marginLeft = "-6px";
      if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.alt = user.name || "User";
      } else {
        avatar.textContent = (user.name || "U").slice(0, 1).toUpperCase();
      }
      node.appendChild(avatar);
    });

    this.getPanes()?.overlayLayer.appendChild(node);
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
    node?.remove();
    node = null;
  };

  overlay.setMap(map);
  return overlay;
}

export default function MapPreview({
  className = "",
  groups = [],
  focusSingleGroup = false,
  singleGroupZoom = 15,
  showAvatars = true,
  verticalOffsetPx = 0,
  interactive = false,
  onMapClick = null,
}) {
  const { user } = useAuth();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [state, setState] = useState("loading");
  const [followingIds, setFollowingIds] = useState([]);
  const followingIdSet = useMemo(() => normalizeUserIds(followingIds), [followingIds]);
  const ownIdSet = useMemo(() => normalizeUserIds([user?.uid, user?.id, user?.userId]), [user?.id, user?.uid, user?.userId]);

  useEffect(() => {
    if (!showAvatars) {
      setFollowingIds([]);
      return undefined;
    }
    if (!user?.uid) {
      setFollowingIds([]);
      return undefined;
    }
    let cancelled = false;
    getFollowingForUser(user.uid, { force: true })
      .then((ids) => {
        if (!cancelled) setFollowingIds(Array.isArray(ids) ? ids : []);
      })
      .catch(() => {
        if (!cancelled) setFollowingIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showAvatars, user?.uid]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapNodeRef.current) return;
        const focusedGroup = focusSingleGroup && groups.length === 1 ? groups[0] : null;
        const initialZoom = focusedGroup ? singleGroupZoom : 4;
        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: focusedGroup ? getOffsetCenter(focusedGroup, initialZoom, verticalOffsetPx) : MILAN_PREVIEW_CENTER,
          zoom: initialZoom,
          disableDefaultUI: true,
          clickableIcons: false,
          draggable: interactive,
          gestureHandling: interactive ? "greedy" : "none",
          keyboardShortcuts: false,
          scrollwheel: interactive,
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        setState("ready");
      })
      .catch(() => {
        if (mounted) setState("error");
      });
    return () => {
      mounted = false;
    };
  }, [interactive]);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current || typeof onMapClick !== "function") return undefined;
    const listener = mapRef.current.addListener("click", onMapClick);
    return () => listener?.remove?.();
  }, [onMapClick, state]);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current || typeof window === "undefined") return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    groups.forEach((group) => {
      if (!Number.isFinite(group?.lat) || !Number.isFinite(group?.lng)) return;
      const ownUsers = showAvatars ? (group.users || []).filter((groupUser) => mapUserMatchesIdSet(groupUser, ownIdSet)) : [];
      const followedUsers = showAvatars ? (group.users || []).filter((groupUser) => mapUserMatchesIdSet(groupUser, followingIdSet)) : [];
      const hasOwnUser = ownUsers.length > 0;
      const markerUsers = [...ownUsers, ...followedUsers.filter((groupUser) => !mapUserMatchesIdSet(groupUser, ownIdSet))];
      const marker = createPreviewRestaurantPinOverlay({
        map: mapRef.current,
        position: { lat: group.lat, lng: group.lng },
        title: group.name || "Restaurant",
        group,
        markerTone: hasOwnUser ? "own" : followedUsers.length ? "followed" : "default",
      });
      if (marker) markersRef.current.push(marker);
      if (markerUsers.length) {
        const overlay = createPreviewAvatarOverlay({
          map: mapRef.current,
          position: { lat: group.lat, lng: group.lng },
          users: markerUsers,
        });
        if (overlay) markersRef.current.push(overlay);
      }
    });
    if (focusSingleGroup && groups.length === 1) {
      const group = groups[0];
      if (Number.isFinite(group?.lat) && Number.isFinite(group?.lng)) {
        mapRef.current.setZoom(singleGroupZoom);
        mapRef.current.setCenter(getOffsetCenter(group, singleGroupZoom, verticalOffsetPx));
      }
    }
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [focusSingleGroup, followingIdSet, groups, ownIdSet, showAvatars, singleGroupZoom, state, verticalOffsetPx]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={mapNodeRef} className="absolute inset-0" />
      {state !== "ready" ? (
        <div className="absolute inset-0 bg-[#18201B]">
          <div
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#E64646] text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <RestaurantMapIcon className="h-6 w-6" strokeWidth={2.1} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
