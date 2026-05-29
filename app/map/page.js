"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, X } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import RestaurantMapView from "../../components/RestaurantMapView";
import SwipeDeck from "../../components/SwipeDeck";
import { useAuth } from "../lib/auth";
import { getAllDishesFromFirestore, getLeaderboardRestaurantAnswers, saveDishToUserList } from "../lib/firebaseHelpers";
import { getRestaurantDishGroups } from "../lib/restaurants";
import { getSessionPageCache, setSessionPageCache } from "../lib/sessionPageCache";
import { useUnreadDirects } from "../lib/useUnreadDirects";
import { useLanguage } from "../../components/LanguageProvider";

const MAP_CACHE_KEY = "map:restaurants";

function MapPageLoading({ title = "Mappa ristoranti" }) {
  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-hidden bg-[#000000] px-4 pt-1 text-white">
      <div className="app-top-nav -mx-4 mb-2 flex items-center justify-between px-4 pb-1.5">
        <div className="h-7 w-44 animate-pulse rounded-full bg-white/12" />
        <div className="h-11 w-11 animate-pulse rounded-[1rem] bg-white/10" />
      </div>
      <div className="mx-auto h-[calc(100dvh-var(--app-top-nav-offset)-var(--app-bottom-nav-height)-3.75rem)] min-h-[24rem] w-full max-w-[42rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <div className="relative h-full w-full bg-[radial-gradient(circle_at_28%_24%,rgba(230,70,70,0.20),transparent_22%),radial-gradient(circle_at_74%_40%,rgba(228,180,63,0.16),transparent_20%),linear-gradient(135deg,#161616_0%,#0B0B0B_48%,#191919_100%)]">
          <div className="absolute left-[22%] top-[28%] h-10 w-9 animate-pulse rounded-full border-2 border-white/18 bg-[#E64646]/80 shadow-[0_10px_24px_rgba(230,70,70,0.26)]" />
          <div className="absolute right-[24%] top-[44%] h-9 w-8 animate-pulse rounded-full border-2 border-white/18 bg-[#E4B43F]/90 shadow-[0_10px_24px_rgba(228,180,63,0.24)]" />
          <div className="absolute bottom-5 left-4 right-4 rounded-[1.6rem] border border-white/10 bg-black/72 p-4">
            <div className="mb-3 h-5 w-40 animate-pulse rounded-full bg-white/18" />
            <div className="flex gap-2">
              <div className="h-20 w-24 animate-pulse rounded-[1rem] bg-white/10" />
              <div className="h-20 w-24 animate-pulse rounded-[1rem] bg-white/10" />
              <div className="h-20 flex-1 animate-pulse rounded-[1rem] bg-white/8" />
            </div>
          </div>
          <span className="sr-only">{title}</span>
        </div>
      </div>
    </div>
  );
}

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
  const handleModalDishAction = async (dish) => {
    if (!user?.uid || !dish?.id) return false;
    return saveDishToUserList(user.uid, dish.id, dish);
  };

  if (loading || loadingMapData) {
    return <MapPageLoading title={t("Loading map")} />;
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
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/72 px-4 py-[calc(var(--app-top-nav-offset)+0.75rem)] backdrop-blur-sm"
          onClick={() => setSelectedDish(null)}
        >
          <div
            className="flex w-full max-w-md flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedDish(null)}
              className="no-accent-border mb-3 flex h-11 w-11 items-center justify-center self-end rounded-full bg-white/12 text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md"
              aria-label="Close dish"
            >
              <X size={19} />
            </button>
            <div className="relative h-[min(78dvh,42rem)] w-full">
              <SwipeDeck
                dishes={[selectedDish]}
                fitHeight
                trackSwipes={false}
                onAction={handleModalDishAction}
                actionLabel="+"
                actionClassName="add-action-btn w-14 h-14 text-[36px]"
                actionToast="Added to DishList"
                dismissOnAction={false}
                currentUser={user}
              />
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<MapPageLoading title="Loading map" />}>
      <MapPageContent />
    </Suspense>
  );
}
