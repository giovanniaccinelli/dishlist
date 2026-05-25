"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";
import { useAuth } from "../app/lib/auth";
import DishRatingBadge from "./DishRatingBadge";

const getRestaurantPinSvg = (strokeColor = "white") => encodeURIComponent(`
<svg width="46" height="54" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" fill="#E64646"/>
  <path d="M23 52C23 52 41 33.65 41 20.25C41 9.95 32.94 2.5 23 2.5C13.06 2.5 5 9.95 5 20.25C5 33.65 23 52 23 52Z" stroke="${strokeColor}" stroke-width="2.1"/>
  <circle cx="23" cy="20.5" r="12.4" fill="#111111"/>
  <g transform="translate(15.35 12.9) scale(0.66)" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v6"/>
    <path d="M5 2v6"/>
    <path d="M7 2v6"/>
    <path d="M3 8c0 1.1.9 2 2 2s2-.9 2-2"/>
    <path d="M5 10v12"/>
    <path d="M19 2c-2.8 1.6-4 4.1-4 7.5V13h4"/>
    <path d="M19 2v20"/>
  </g>
</svg>`);

function getRestaurantMarkerIcon(markerTone = "default") {
  if (typeof window === "undefined" || !window.google?.maps) return undefined;
  const strokeColor = markerTone === "own" ? "#2BD36B" : markerTone === "followed" ? "#F2C94C" : "white";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${getRestaurantPinSvg(strokeColor)}`,
    scaledSize: new window.google.maps.Size(36, 42),
    anchor: new window.google.maps.Point(18, 42),
  };
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
}) {
  const router = useRouter();
  const { user } = useAuth();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
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
  const swipeStartRef = useRef(null);
  const followingIdSet = useMemo(() => new Set((followingIds || []).map((id) => String(id || "").trim()).filter(Boolean)), [followingIds]);

  const selectedGroup = useMemo(() => {
    if (selectedPlaceId === "__none__") return null;
    if (!selectedPlaceId) return null;
    return groups.find((group) => group.placeId === selectedPlaceId) || groups[0] || null;
  }, [groups, selectedPlaceId]);

  useEffect(() => {
    if (!initialSelectedPlaceId) return;
    setSelectedPlaceId(initialSelectedPlaceId);
  }, [initialSelectedPlaceId]);

  useEffect(() => {
    if (!user?.uid) {
      setFollowingIds([]);
      return undefined;
    }
    let cancelled = false;
    getFollowingForUser(user.uid)
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
    if (!selectedGroup || !mapRef.current) return;
    if (!Number.isFinite(selectedGroup.lat) || !Number.isFinite(selectedGroup.lng)) return;
    mapRef.current.panTo({ lat: selectedGroup.lat, lng: selectedGroup.lng });
    const currentZoom = mapRef.current.getZoom?.() || 0;
    if (currentZoom < 14) {
      mapRef.current.setZoom(14);
    }
  }, [selectedGroup?.placeId]);

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

    const localMatches = groups
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
              _pinnedGroup: groups.find((group) => group.placeId === item.place_id) || null,
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
  }, [groups, mapState, query, searchFocused]);

  useEffect(() => {
    if (mapState !== "ready") return;
    if (!mapNodeRef.current) return;
    if (mapRef.current) return;

    mapRef.current = new window.google.maps.Map(mapNodeRef.current, {
      center: { lat: 45.4642, lng: 9.19 },
      zoom: 5,
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
  }, [mapState]);

  useEffect(() => {
    if (!mapRef.current || mapState !== "ready") return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!groups.length) {
      setSelectedPlaceId("__none__");
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    groups.forEach((group) => {
      const position = { lat: group.lat, lng: group.lng };
      const followedUsers = (group.users || []).filter((groupUser) => followingIdSet.has(String(groupUser.id || "").trim()));
      const ownUsers = (group.users || []).filter((groupUser) => String(groupUser.id || "").trim() === String(user?.uid || "").trim());
      const hasFollowedUser = followedUsers.length > 0;
      const hasOwnUser = ownUsers.length > 0;
      const markerUsers = [...ownUsers, ...followedUsers.filter((groupUser) => String(groupUser.id || "").trim() !== String(user?.uid || "").trim())];
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: group.name,
        icon: getRestaurantMarkerIcon(hasOwnUser ? "own" : hasFollowedUser ? "followed" : "default"),
      });
      marker.addListener("click", () => setSelectedPlaceId(group.placeId));
      markersRef.current.push(marker);
      if (markerUsers.length) {
        const overlay = createFollowedAvatarOverlay({
          map: mapRef.current,
          position,
          users: markerUsers,
          onClick: () => setSelectedPlaceId(group.placeId),
        });
        if (overlay) markersRef.current.push(overlay);
      }
      bounds.extend(position);
    });

    setSelectedPlaceId((current) => {
      if (current === "__none__") return current;
      return current && groups.some((group) => group.placeId === current) ? current : "__none__";
    });

    const highlightedGroup =
      (initialSelectedPlaceId && groups.find((group) => group.placeId === initialSelectedPlaceId)) ||
      (selectedPlaceId && selectedPlaceId !== "__none__" && groups.find((group) => group.placeId === selectedPlaceId));

    if (highlightedGroup) {
      mapRef.current.setCenter({ lat: highlightedGroup.lat, lng: highlightedGroup.lng });
      mapRef.current.setZoom(14);
      return;
    }

    if (groups.length === 1) {
      mapRef.current.setCenter({ lat: groups[0].lat, lng: groups[0].lng });
      mapRef.current.setZoom(14);
      return;
    }

    mapRef.current.setCenter({ lat: 45.4642, lng: 9.19 });
    mapRef.current.setZoom(5);
  }, [followingIdSet, groups, mapState, user?.uid]);

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
    () => Math.max(0, groups.findIndex((group) => group.placeId === selectedGroup?.placeId)),
    [groups, selectedGroup?.placeId]
  );

  const cycleRestaurant = (direction) => {
    if (!groups.length) return;
    const nextIndex = (selectedIndex + direction + groups.length) % groups.length;
    focusGroup(groups[nextIndex], direction);
  };

  const focusGroup = (group, direction = 0) => {
    if (!group) return;
    setSheetDirection(direction);
    setSelectedPlaceId(group.placeId || "");
    if (mapRef.current && typeof group.lat === "number" && typeof group.lng === "number") {
      mapRef.current.panTo({ lat: group.lat, lng: group.lng });
      mapRef.current.setZoom(14);
    }
    setQuery(group.name || "");
    setPredictions([]);
    setSearchFocused(false);
  };

  const handlePredictionSelect = (prediction) => {
    const matchingGroup = groups.find((group) => group.placeId === prediction?.place_id);
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
        mapRef.current.panTo({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
        mapRef.current.setZoom(14);
      }
    );
  };

  const showPredictions = searchFocused && query.trim().length > 0 && predictions.length > 0;
  return (
    <div className={`restaurant-accent-border min-h-[22rem] overflow-hidden rounded-[2rem] border-2 bg-[#F4EFE6] shadow-[0_24px_50px_rgba(0,0,0,0.10)] ${className}`}>
      <div className="relative h-full min-h-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-x-3 top-3 z-10">
          <div className="restaurant-accent-border overflow-hidden rounded-[1.2rem] border-2 bg-white/95 shadow-[0_14px_28px_rgba(0,0,0,0.10)] backdrop-blur-md">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Search size={16} className="shrink-0 text-black/35" />
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
                  className="restaurant-accent-border flex h-7 w-7 items-center justify-center rounded-full border-2 bg-black/5 text-black/55"
                  aria-label="Clear restaurant search"
                >
                  <X size={14} />
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

        {mapState === "ready" && groups.length > 0 ? (
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
            className="absolute inset-x-3 bottom-3 z-10 overflow-visible"
            onPointerDown={(event) => {
              swipeStartRef.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              if (!swipeStartRef.current) return;
              const dx = event.clientX - swipeStartRef.current.x;
              const dy = event.clientY - swipeStartRef.current.y;
              swipeStartRef.current = null;
              if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
                cycleRestaurant(dx < 0 ? 1 : -1);
              }
            }}
          >
            <AnimatePresence initial={false} mode="wait" custom={sheetDirection}>
              <motion.div
                key={selectedGroup.placeId}
                custom={sheetDirection}
                initial={{ x: sheetDirection > 0 ? 86 : sheetDirection < 0 ? -86 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: sheetDirection > 0 ? -86 : sheetDirection < 0 ? 86 : 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="restaurant-accent-border flex max-h-[22rem] flex-col overflow-hidden rounded-[1.7rem] border-2 bg-white/96 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.14)] backdrop-blur-md"
              >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="shrink-0 text-[#E64646]" />
                        {selectedGroup.googleMapsUrl ? (
                          <a
                            href={selectedGroup.googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-[1rem] font-semibold text-black underline decoration-black/30 underline-offset-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {selectedGroup.name}
                          </a>
                        ) : (
                          <div className="truncate text-[1rem] font-semibold text-black">{selectedGroup.name}</div>
                        )}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-black/52">{selectedGroup.address || "Pinned restaurant"}</div>
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

                  {selectedGroup.users?.length ? (
                    <div className={`mt-3 flex max-w-full touch-pan-x snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-1 ${selectedGroup.users.length === 1 ? "justify-center" : ""}`}
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      {selectedGroup.users.map((user) => (
                        <div key={`${selectedGroup.placeId}-${user.id}`} className="flex w-40 shrink-0 snap-start flex-col">
                          <button
                            type="button"
                            onClick={() => user.id && router.push(`/profile/${encodeURIComponent(user.id)}`)}
                            className="restaurant-accent-border mb-2 flex h-10 w-full items-center gap-2 rounded-[1rem] border-2 bg-white px-2 text-left shadow-[0_8px_18px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
                          >
                            <Avatar user={user} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-bold leading-none text-black">
                                {user.name || "User"}
                              </span>
                            </span>
                          </button>
                          {user.dishes?.[0] ? (
                            <button
                              type="button"
                              onClick={() => openDish(user.dishes[0])}
                              className="restaurant-accent-border flex h-40 w-full overflow-hidden rounded-[1.25rem] border-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                            >
                              <div className="relative h-full w-full overflow-hidden">
                                <DishRatingBadge dish={user.dishes[0]} className="text-[10px]" />
                                <img
                                  src={getDishImageUrl(user.dishes[0], "thumb")}
                                  alt={user.dishes[0].name || "Dish"}
                                  className="h-full w-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                  }}
                                />
                                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/88 via-black/48 to-transparent px-2.5 pb-2.5 pt-8 text-white pointer-events-none flex flex-col justify-end gap-0.5">
                                  <div className="truncate text-sm font-semibold">
                                    {user.dishes[0].name || "Untitled dish"}
                                  </div>
                                  {(user.dishes?.length || 0) > 1 ? (
                                    <div className="mt-0.5 text-[10px] text-white/80">
                                      +{user.dishes.length - 1} more here
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          ) : null}
                          {user.leaderboardAnswers?.[0] ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/leaderboard/${user.leaderboardAnswers[0].questionId}`)}
                              className={`restaurant-accent-border ${user.dishes?.[0] ? "mt-2 min-h-[4.2rem]" : "h-40"} w-full rounded-[1.25rem] border-2 bg-[linear-gradient(180deg,#FFF4F4_0%,#FFFFFF_100%)] px-3 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition active:scale-[0.98]`}
                            >
                              <div className="line-clamp-2 text-[12px] font-black leading-tight text-black">
                                {user.leaderboardAnswers[0].questionTitle || "Leaderboard"}
                              </div>
                              <div className="mt-2 truncate text-[13px] font-bold text-[#E64646]">
                                {user.leaderboardAnswers[0].text || selectedGroup.name}
                              </div>
                              <div className="mt-2 inline-flex items-center rounded-full bg-[#E64646]/10 px-2 py-1 text-[10px] font-black text-[#E64646]">
                                {Math.max(0, Number(user.leaderboardAnswers[0].voteCount || 0))} voti
                              </div>
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </div>
  );
}
