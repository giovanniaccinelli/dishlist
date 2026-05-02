"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";

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
  const swipeStartRef = useRef(null);

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
    if (!selectedGroup || !mapRef.current) return;
    if (!Number.isFinite(selectedGroup.lat) || !Number.isFinite(selectedGroup.lng)) return;
    mapRef.current.panTo({ lat: selectedGroup.lat, lng: selectedGroup.lng });
    const currentZoom = mapRef.current.getZoom?.() || 0;
    if (currentZoom < 13) {
      mapRef.current.setZoom(13);
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
        {
          input: trimmed,
          types: ["establishment"],
        },
        (results, status) => {
          if (requestRef.current !== requestId) return;
          const googleResults =
            status === window.google?.maps?.places?.PlacesServiceStatus?.OK && Array.isArray(results)
              ? results
              : [];
          const seen = new Set();
          const merged = [...localMatches, ...googleResults].filter((item) => {
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
      center: { lat: 20, lng: 0 },
      zoom: 2,
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
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: group.name,
      });
      marker.addListener("click", () => setSelectedPlaceId(group.placeId));
      markersRef.current.push(marker);
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
      mapRef.current.setZoom(13);
      return;
    }

    mapRef.current.fitBounds(bounds, 56);
    const listener = window.google.maps.event.addListenerOnce(mapRef.current, "bounds_changed", () => {
      if (mapRef.current.getZoom() > 12) {
        mapRef.current.setZoom(12);
      }
    });

    return () => {
      if (listener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [groups, mapState]);

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
    <div className={`restaurant-accent-border h-[44vh] min-h-[22rem] overflow-hidden rounded-[2rem] border-2 bg-[#F4EFE6] shadow-[0_24px_50px_rgba(0,0,0,0.10)] ${className}`}>
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
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id || prediction.description}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handlePredictionSelect(prediction)}
                    className="flex w-full items-start gap-2 border-b border-black/6 px-3 py-2.5 text-left last:border-b-0 hover:bg-black/[0.03]"
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0 text-[#E64646]" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-black">
                        {prediction.structured_formatting?.main_text || prediction.description}
                      </div>
                      <div className="truncate text-xs text-black/45">
                        {prediction.structured_formatting?.secondary_text || prediction.description}
                      </div>
                    </div>
                  </button>
                ))}
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
          <div className="restaurant-accent-border absolute inset-x-3 bottom-3 top-[5.5rem] z-10 overflow-hidden rounded-[1.7rem] border-2 bg-white/96 shadow-[0_18px_40px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <div
              className="h-full"
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
                  className="flex h-full flex-col overflow-hidden p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="shrink-0 text-[#E64646]" />
                        <div className="truncate text-[1rem] font-semibold text-black">{selectedGroup.name}</div>
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
                    <div className="mt-3 flex flex-1 min-h-0 items-stretch gap-3 overflow-x-auto pb-1">
                      {selectedGroup.users.map((user) => (
                        <div key={`${selectedGroup.placeId}-${user.id}`} className="flex h-full w-[10.4rem] shrink-0 flex-col">
                          <div className="restaurant-accent-border mb-2 flex items-center gap-2 rounded-full border-2 bg-black/[0.04] px-2.5 py-1.5">
                            <Avatar user={user} />
                            <span className="max-w-[6.4rem] truncate text-xs font-medium text-black/72">
                              {user.name || "User"}
                            </span>
                          </div>
                          {user.dishes?.[0] ? (
                            <button
                              type="button"
                              onClick={() => openDish(user.dishes[0])}
                              className="restaurant-accent-border flex min-h-0 flex-1 overflow-hidden rounded-[1.35rem] border-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.06)]"
                            >
                              <div className="relative h-full w-full overflow-hidden">
                                <img
                                  src={getDishImageUrl(user.dishes[0], "thumb")}
                                  alt={user.dishes[0].name || "Dish"}
                                  className="h-full w-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/12 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-white">
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
                        </div>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
