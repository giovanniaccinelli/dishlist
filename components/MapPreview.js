"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { RestaurantMapIcon } from "./DishModeControls";

const EUROPE_PREVIEW_CENTER = { lat: 50.8, lng: 12.2 };
const PIN_SVG = encodeURIComponent(`
<svg width="42" height="50" viewBox="0 0 42 50" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 49C21 49 38 31.6 38 18.8C38 8.96 30.39 2 21 2C11.61 2 4 8.96 4 18.8C4 31.6 21 49 21 49Z" fill="#E64646"/>
  <path d="M21 49C21 49 38 31.6 38 18.8C38 8.96 30.39 2 21 2C11.61 2 4 8.96 4 18.8C4 31.6 21 49 21 49Z" stroke="white" stroke-width="3"/>
  <circle cx="21" cy="19" r="11.2" fill="#111111"/>
  <g transform="translate(14 12) scale(0.6)" stroke="white" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v6"/>
    <path d="M5 2v6"/>
    <path d="M7 2v6"/>
    <path d="M3 8c0 1.1.9 2 2 2s2-.9 2-2"/>
    <path d="M5 10v12"/>
    <path d="M19 2c-2.8 1.6-4 4.1-4 7.5V13h4"/>
    <path d="M19 2v20"/>
  </g>
</svg>`);

function getRestaurantMarkerIcon() {
  if (typeof window === "undefined" || !window.google?.maps) return undefined;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${PIN_SVG}`,
    scaledSize: new window.google.maps.Size(32, 38),
    anchor: new window.google.maps.Point(16, 38),
  };
}

export default function MapPreview({ className = "", groups = [] }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapNodeRef.current) return;
        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: EUROPE_PREVIEW_CENTER,
          zoom: 4,
          disableDefaultUI: true,
          clickableIcons: false,
          draggable: false,
          gestureHandling: "none",
          keyboardShortcuts: false,
          scrollwheel: false,
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
  }, []);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current || typeof window === "undefined") return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    groups.forEach((group) => {
      if (!Number.isFinite(group?.lat) || !Number.isFinite(group?.lng)) return;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: group.lat, lng: group.lng },
        title: group.name || "Restaurant",
        clickable: false,
        icon: getRestaurantMarkerIcon(),
      });
      markersRef.current.push(marker);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [groups, state]);

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
