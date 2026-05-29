"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, X } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import RestaurantMapView from "../../components/RestaurantMapView";
import SwipeDeck from "../../components/SwipeDeck";
import { useAuth } from "../lib/auth";
import { getAllDishesFromFirestore, getLeaderboardRestaurantAnswers } from "../lib/firebaseHelpers";
import { getRestaurantDishGroups } from "../lib/restaurants";
import { getSessionPageCache, setSessionPageCache } from "../lib/sessionPageCache";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { useLanguage } from "../../components/LanguageProvider";

const MAP_CACHE_KEY = "map:restaurants";

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { hasUnread: hasUnreadDirects } = useUnreadDirects(user?.uid);
  const cachedMap = getSessionPageCache(MAP_CACHE_KEY)?.value;
  const [dishes, setDishes] = useState(() => cachedMap?.dishes || []);
  const [leaderboardRestaurantAnswers, setLeaderboardRestaurantAnswers] = useState(() => cachedMap?.leaderboardRestaurantAnswers || []);
  const [loadingMapData, setLoadingMapData] = useState(() => !cachedMap);
  const [selectedDish, setSelectedDish] = useState(null);

  useEffect(() => {
    const cached = getSessionPageCache(MAP_CACHE_KEY)?.value;
    if (cached) {
      setDishes(cached.dishes || []);
      setLeaderboardRestaurantAnswers(cached.leaderboardRestaurantAnswers || []);
      setLoadingMapData(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoadingMapData(true);
      try {
        const [allDishes, restaurantAnswers] = await Promise.all([
          getAllDishesFromFirestore(),
          getLeaderboardRestaurantAnswers(),
        ]);
        if (cancelled) return;
        const publicDishes = allDishes.filter((dish) => dish?.isPublic !== false);
        setDishes(publicDishes);
        setLeaderboardRestaurantAnswers(restaurantAnswers);
        setSessionPageCache(MAP_CACHE_KEY, {
          dishes: publicDishes,
          leaderboardRestaurantAnswers: restaurantAnswers,
        });
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
    <div className="bottom-nav-spacer h-[100dvh] overflow-hidden overscroll-none bg-transparent px-4 pt-1 text-black relative">
      <div className="app-top-nav -mx-4 px-4 pb-1.5 mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Mappa ristoranti")}</h1>
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
        className="mb-3 mx-auto h-[calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-3.75rem)] min-h-[24rem] max-h-none w-full max-w-[42rem]"
        dishHrefBuilder={(dish) => `/dish/${dish.id}?source=public&mode=single`}
        onDishSelect={setSelectedDish}
      />

      {selectedDish ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 px-4 py-[calc(var(--app-top-nav-offset)+0.75rem)] backdrop-blur-sm"
          onClick={() => setSelectedDish(null)}
        >
          <div
            className="relative h-[min(78dvh,42rem)] w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedDish(null)}
              className="no-accent-border absolute right-3 top-3 z-[130] flex h-10 w-10 items-center justify-center rounded-full bg-black/72 text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
              aria-label="Close dish"
            >
              <X size={18} />
            </button>
            <SwipeDeck
              dishes={[selectedDish]}
              fitHeight
              trackSwipes={false}
              actionLabel=""
              dismissOnAction={false}
              currentUser={user}
            />
          </div>
        </div>
      ) : null}

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
