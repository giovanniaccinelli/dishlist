"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleUserRound } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import RestaurantMapView from "../../components/RestaurantMapView";
import { RestaurantMapIcon } from "../../components/DishModeControls";
import { useAuth } from "../lib/auth";
import { getAllDishesFromFirestore } from "../lib/firebaseHelpers";
import { getRestaurantDishGroups } from "../lib/restaurants";
import { useLanguage } from "../../components/LanguageProvider";

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [dishes, setDishes] = useState([]);
  const [loadingMapData, setLoadingMapData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMapData(true);
      try {
        const allDishes = await getAllDishesFromFirestore();
        if (cancelled) return;
        setDishes(allDishes.filter((dish) => dish?.isPublic !== false));
      } catch (error) {
        console.error("Failed to load restaurant map dishes:", error);
        if (!cancelled) setDishes([]);
      } finally {
        if (!cancelled) setLoadingMapData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => getRestaurantDishGroups(dishes), [dishes]);
  const selectedPlaceId = searchParams.get("placeId") || "";

  if (loading || loadingMapData) {
    return <FullScreenLoading title={t("Loading map")} />;
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="top-action-btn"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.06)] border border-black/10">
          <RestaurantMapIcon className="h-4 w-4 text-[#E64646]" />
          <span className="text-sm font-semibold text-black">{t("Restaurants map")}</span>
        </div>
        <button
          type="button"
          onClick={() => router.push(user ? "/profile" : "/")}
          className="top-action-btn"
          aria-label="Profile"
        >
          <CircleUserRound size={18} />
        </button>
      </div>

      <div className="mb-4 px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/36">
          {t("World map")}
        </div>
        <h1 className="mt-2 text-[2rem] leading-none font-semibold text-black">
          {t("Restaurants map")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-black/58">
          A shared map of restaurants people have linked to their dishes, with the meals posted from each place.
        </p>
      </div>

      <RestaurantMapView
        groups={groups}
        initialSelectedPlaceId={selectedPlaceId}
        emptyTitle="No restaurants pinned yet"
        emptyText="Restaurant dishes with a selected place will show up here."
        className="mb-5 mx-auto h-[calc(100dvh-19rem)] min-h-[22rem] max-h-[28rem] max-w-[25rem]"
        dishHrefBuilder={(dish) => `/dish/${dish.id}?source=public&mode=single`}
      />

      <BottomNav />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<FullScreenLoading title="Loading map" />}>
      <MapPageContent />
    </Suspense>
  );
}
