"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "../app/lib/googleMapsClient";
import { getFollowingForUser } from "../app/lib/firebaseHelpers";
import { useAuth } from "../app/lib/auth";
import { RestaurantMapIcon } from "./DishModeControls";

const MILAN_PREVIEW_CENTER = { lat: 45.4642, lng: 9.19 };
const getPinSvg = (strokeColor = "white") => encodeURIComponent(`
<svg width="42" height="50" viewBox="0 0 42 50" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 49C21 49 38 31.6 38 18.8C38 8.96 30.39 2 21 2C11.61 2 4 8.96 4 18.8C4 31.6 21 49 21 49Z" fill="#E64646"/>
  <path d="M21 49C21 49 38 31.6 38 18.8C38 8.96 30.39 2 21 2C11.61 2 4 8.96 4 18.8C4 31.6 21 49 21 49Z" stroke="${strokeColor}" stroke-width="2"/>
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

function getRestaurantMarkerIcon(markerTone = "default") {
  if (typeof window === "undefined" || !window.google?.maps) return undefined;
  const strokeColor = markerTone === "own" ? "#2BD36B" : markerTone === "followed" ? "#F2C94C" : "white";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${getPinSvg(strokeColor)}`,
    scaledSize: new window.google.maps.Size(32, 38),
    anchor: new window.google.maps.Point(16, 38),
  };
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
    node.style.transform = "translate(-50%, -100%) translateY(-39px)";
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

export default function MapPreview({ className = "", groups = [] }) {
  const { user } = useAuth();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [state, setState] = useState("loading");
  const [followingIds, setFollowingIds] = useState([]);
  const followingIdSet = useMemo(() => new Set((followingIds || []).map((id) => String(id || "").trim()).filter(Boolean)), [followingIds]);

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
      .catch(() => {
        if (!cancelled) setFollowingIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapNodeRef.current) return;
        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: MILAN_PREVIEW_CENTER,
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
      const ownUsers = (group.users || []).filter((groupUser) => String(groupUser.id || "").trim() === String(user?.uid || "").trim());
      const followedUsers = (group.users || []).filter((groupUser) => followingIdSet.has(String(groupUser.id || "").trim()));
      const hasOwnUser = ownUsers.length > 0;
      const markerUsers = [...ownUsers, ...followedUsers.filter((groupUser) => String(groupUser.id || "").trim() !== String(user?.uid || "").trim())];
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: group.lat, lng: group.lng },
        title: group.name || "Restaurant",
        clickable: false,
        icon: getRestaurantMarkerIcon(hasOwnUser ? "own" : followedUsers.length ? "followed" : "default"),
      });
      markersRef.current.push(marker);
      if (markerUsers.length) {
        const overlay = createPreviewAvatarOverlay({
          map: mapRef.current,
          position: { lat: group.lat, lng: group.lng },
          users: markerUsers,
        });
        if (overlay) markersRef.current.push(overlay);
      }
    });
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [followingIdSet, groups, state, user?.uid]);

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
