"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { normalizeRestaurant } from "../app/lib/restaurants";

function buildRestaurantFromPlace(place) {
  return normalizeRestaurant({
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address,
    lat: place.geometry?.location?.lat?.(),
    lng: place.geometry?.location?.lng?.(),
    googleMapsUrl:
      place.url ||
      `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(place.place_id || "")}`,
  });
}

export default function RestaurantPlacePicker({
  value = null,
  onChange,
  label = "Restaurant (optional)",
  placeholder = "Search restaurant",
  className = "",
}) {
  const [query, setQuery] = useState(value?.name || "");
  const [predictions, setPredictions] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    setQuery(value?.name || "");
  }, [value?.name]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted) return;
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        placesServiceRef.current = new google.maps.places.PlacesService(document.createElement("div"));
        setReady(true);
        setLoadError("");
      })
      .catch((error) => {
        if (!mounted) return;
        console.warn("Restaurant picker unavailable:", error);
        setReady(false);
        setLoadError("Restaurant search unavailable");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isFocused) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setPredictions([]);
      setLoadingPredictions(false);
      return;
    }

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
          setLoadingPredictions(false);
          if (
            status !== window.google?.maps?.places?.PlacesServiceStatus?.OK ||
            !Array.isArray(results)
          ) {
            setPredictions([]);
            return;
          }
          setPredictions(results.slice(0, 6));
        }
      );
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isFocused, query, ready]);

  const showPredictions = useMemo(
    () => ready && isFocused && query.trim().length > 0 && predictions.length > 0,
    [isFocused, predictions.length, query, ready]
  );

  const handleSelectPrediction = (prediction) => {
    if (!prediction?.place_id || !placesServiceRef.current) return;
    setDetailsLoading(true);
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["place_id", "name", "formatted_address", "geometry", "url"],
      },
      (place, status) => {
        setDetailsLoading(false);
        if (
          status !== window.google?.maps?.places?.PlacesServiceStatus?.OK ||
          !place
        ) {
          return;
        }
        const restaurant = buildRestaurantFromPlace(place);
        if (!restaurant) return;
        setQuery(restaurant.name);
        setPredictions([]);
        setIsFocused(false);
        onChange?.(restaurant);
      }
    );
  };

  const handleClear = () => {
    setQuery("");
    setPredictions([]);
    onChange?.(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-black/72">{label}</label>
        {value?.googleMapsUrl ? (
          <a
            href={value.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#E64646]"
          >
            Open in Maps
          </a>
        ) : null}
      </div>

      <div className="rounded-[1.35rem] border border-black/10 bg-white/90 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-black/35" />
          <input
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setIsFocused(false), 120);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              if (value?.placeId && nextValue.trim() !== value.name) {
                onChange?.(null);
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-black placeholder:text-black/35 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-black/55"
              aria-label="Clear restaurant"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {value ? (
          <div className="mt-3 rounded-[1rem] bg-[#FFF7EB] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#E64646]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-black">{value.name}</div>
                <div className="mt-0.5 text-xs leading-5 text-black/55">{value.address || "Restaurant selected"}</div>
              </div>
            </div>
          </div>
        ) : null}

        {!ready && !loadError ? (
          <div className="mt-3 text-xs text-black/45">Loading restaurant search...</div>
        ) : null}
        {loadError ? (
          <div className="mt-3 text-xs text-black/45">{loadError}</div>
        ) : null}
        {loadingPredictions ? (
          <div className="mt-3 text-xs text-black/45">Searching...</div>
        ) : null}
        {detailsLoading ? (
          <div className="mt-3 text-xs text-black/45">Loading restaurant details...</div>
        ) : null}
        {showPredictions ? (
          <div className="mt-3 overflow-hidden rounded-[1rem] border border-black/8 bg-[#FFFCF7]">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => handleSelectPrediction(prediction)}
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
  );
}
