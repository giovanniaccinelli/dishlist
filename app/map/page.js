"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import RestaurantMapView from "../../components/RestaurantMapView";
import { RestaurantMapIcon } from "../../components/DishModeControls";
import { useAuth } from "../lib/auth";
import { getAllDishesFromFirestore, getLeaderboardRestaurantAnswers } from "../lib/firebaseHelpers";
import { getRestaurantDishGroups } from "../lib/restaurants";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { useLanguage } from "../../components/LanguageProvider";

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const [dishes, setDishes] = useState([]);
  const [leaderboardRestaurantAnswers, setLeaderboardRestaurantAnswers] = useState([]);
  const [loadingMapData, setLoadingMapData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMapData(true);
      try {
        const [allDishes, restaurantAnswers] = await Promise.all([
          getAllDishesFromFirestore(),
          getLeaderboardRestaurantAnswers(),
        ]);
        if (cancelled) return;
        setDishes(allDishes.filter((dish) => dish?.isPublic !== false));
        setLeaderboardRestaurantAnswers(restaurantAnswers);
      } catch (error) {
        console.error("Failed to load restaurant map dishes:", error);
        if (!cancelled) {
          setDishes([]);
          setLeaderboardRestaurantAnswers([]);
        }
      } finally {
        if (!cancelled) setLoadingMapData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => getRestaurantDishGroups(dishes, leaderboardRestaurantAnswers), [dishes, leaderboardRestaurantAnswers]);
  const selectedPlaceId = searchParams.get("placeId") || "";

  if (loading || loadingMapData) {
    return <FullScreenLoading title={t("Loading map")} />;
  }

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between">
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
          onClick={() => router.push(user ? "/directs" : "/")}
          className="top-action-btn relative"
          aria-label="Directs"
        >
          <Send size={18} />
          {hasUnreadDirects ? <span className="no-accent-border absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E64646]" /> : null}
        </button>
      </div>

      <RestaurantMapView
        groups={groups}
        initialSelectedPlaceId={selectedPlaceId}
        emptyTitle="No restaurants pinned yet"
        emptyText="Restaurant dishes with a selected place will show up here."
        className="mb-3 mx-auto h-[calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-4.25rem)] min-h-[27rem] max-h-none w-full max-w-[42rem]"
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
