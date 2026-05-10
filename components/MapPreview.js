"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { RestaurantMapIcon } from "./DishModeControls";

const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };

export default function MapPreview({ className = "" }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapNodeRef.current) return;
        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: MILAN_CENTER,
          zoom: 11,
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
