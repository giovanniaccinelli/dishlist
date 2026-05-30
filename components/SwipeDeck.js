"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CornerUpRight, Heart, ListPlus, Pencil, Maximize2, X, Users, MessageCircle } from "lucide-react";
import CommentsModal from "./CommentsModal";
import StoryHistoryModal from "./StoryHistoryModal";
import AppToast from "./AppToast";
import RestaurantMapView from "./RestaurantMapView";
import { addCommentToDish, deleteCommentThread, getCommentsForDish, getDishLikeState, toggleDishLike } from "../app/lib/firebaseHelpers";
import { DEFAULT_DISH_IMAGE, getDishImageUrl, isDishVideo } from "../app/lib/dishImage";
import { isRecipeOnlyDish } from "../app/lib/dishContent";
import { dispatchPushEvent } from "../app/lib/pushClient";
import { DishModeBadge, RestaurantMapIcon } from "./DishModeControls";
import { useLanguage } from "./LanguageProvider";
import { RatingStars } from "./RatingStars";
import { formatDishPrice } from "../app/lib/dishPrice";

function DeckAutoplayVideo({
  src,
  className = "",
  onVideoRef = null,
}) {
  const videoRef = useRef(null);

  const startVideoPlayback = useCallback((video) => {
    if (!video) return () => {};
    console.info("[SwipeDeckVideo] play attempt init", {
      mounted: Boolean(video),
      src: video.currentSrc || video.src || src || null,
      readyState: video.readyState,
    });

    let cancelled = false;
    let retryTimer = null;
    let rafId = 0;

    const clearPending = () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const attemptPlayback = (retriesLeft = 10) => {
      if (cancelled || !video.isConnected) return;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.removeAttribute("controls");
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("x-webkit-airplay", "deny");
      video.preload = "auto";
      video.defaultMuted = false;
      console.info("[SwipeDeckVideo] play() call", {
        src: video.currentSrc || video.src || src || null,
        retriesLeft,
        readyState: video.readyState,
      });

      const playPromise = video.play?.();
      if (playPromise?.catch) {
        playPromise
          .then(() => {
            console.info("[SwipeDeckVideo] play() resolved", {
              src: video.currentSrc || video.src || src || null,
            });
            clearPending();
          })
          .catch((error) => {
            console.error("[SwipeDeckVideo] play() rejected", {
              src: video.currentSrc || video.src || src || null,
              name: error?.name || null,
              message: error?.message || null,
            });
            if (cancelled || retriesLeft <= 0) return;
            retryTimer = window.setTimeout(() => {
              attemptPlayback(retriesLeft - 1);
            }, 120);
          });
        return;
      }

      if (video.paused && retriesLeft > 0 && !cancelled) {
        retryTimer = window.setTimeout(() => {
          attemptPlayback(retriesLeft - 1);
        }, 120);
      }
    };

    const run = () => {
      attemptPlayback();
      if (!video.paused) return;
      rafId = window.requestAnimationFrame(() => attemptPlayback());
    };

    if (video.readyState >= 2) {
      run();
    } else {
      const handleReady = () => {
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
        console.info("[SwipeDeckVideo] readiness event", {
          src: video.currentSrc || video.src || src || null,
          readyState: video.readyState,
        });
        run();
      };
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      try {
        video.load();
      } catch {}
    }

    return () => {
      cancelled = true;
      clearPending();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    console.info("[SwipeDeckVideo] mounted", {
      mounted: Boolean(video),
      src,
      readyState: video.readyState,
    });
    const stopPlaybackAttempt = startVideoPlayback(video);

    const handleLoadedData = () => {
      console.info("[SwipeDeckVideo] loadeddata", {
        src: video.currentSrc || video.src || src || null,
        readyState: video.readyState,
      });
    };

    const handleCanPlay = () => {
      console.info("[SwipeDeckVideo] canplay", {
        src: video.currentSrc || video.src || src || null,
        readyState: video.readyState,
      });
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      stopPlaybackAttempt();
      try {
        video.pause?.();
      } catch {}
    };
  }, [src, startVideoPlayback]);

  useEffect(() => {
    if (typeof onVideoRef !== "function") return undefined;
    const node = videoRef.current;
    onVideoRef(node);
    return () => onVideoRef(null);
  }, [onVideoRef, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={`deck-video ${className}`}
      autoPlay
      loop
      playsInline
      preload="auto"
      controls={false}
      disableRemotePlayback
      disablePictureInPicture
      controlsList="nodownload noplaybackrate noremoteplayback"
    />
  );
}

function isRestaurantDish(dish) {
  return String(dish?.dishMode || "").trim().toLowerCase() === "restaurant";
}

function getSafeRestaurantLabel(dish) {
  return typeof dish?.restaurant?.name === "string" ? dish.restaurant.name.trim() : "";
}

function getSafeRestaurantPlaceId(dish) {
  return typeof dish?.restaurant?.placeId === "string" ? dish.restaurant.placeId.trim() : "";
}

function formatDeckDishes(dishes = []) {
  return dishes.map((dish, index) => ({
    ...dish,
    _key: dish.id || `${dish.owner || "local"}-${dish.name || "dish"}-${index}`,
  }));
}

function getRelativeUploadTime(value) {
  const rawDate = value?.toDate?.() || value;
  const date = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
  const time = date?.getTime?.();
  if (!time || Number.isNaN(time)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const preloadedMedia = new Set();
const preloadingMedia = new Map();

function preloadDeckImage(src) {
  if (!src || src === DEFAULT_DISH_IMAGE || preloadedMedia.has(src)) return Promise.resolve();
  if (preloadingMedia.has(src)) return preloadingMedia.get(src);
  if (typeof window === "undefined" || typeof Image === "undefined") return Promise.resolve();

  const promise = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {}
      preloadedMedia.add(src);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = src;
    if (image.complete && image.naturalWidth > 0) {
      preloadedMedia.add(src);
      resolve();
    }
  }).finally(() => {
    preloadingMedia.delete(src);
  });

  preloadingMedia.set(src, promise);
  return promise;
}

const SwipeDeck = forwardRef(function SwipeDeck({
  dishes,
  onSwiped,
  onDeckEmpty,
  loadMoreDishes,
  hasMore,
  loadingMore,
  onResetFeed,
  onAction,
  onRightSwipe,
  onSavesPress,
  onTertiaryAction,
  actionOnRightSwipe = true,
  dismissOnAction = true,
  onSecondaryAction,
  dismissOnTertiaryAction = false,
  dismissOnSecondaryAction = true,
  actionLabel = "+",
  secondaryActionLabel,
  tertiaryActionLabel,
  actionClassName,
  secondaryActionClassName,
  tertiaryActionClassName,
  actionToast,
  secondaryActionToast,
  rightSwipeToast = "Aggiunto al profilo",
  rightSwipeErrorToast = "Action failed",
  trackSwipes = true,
  onAuthRequired,
  preserveContinuity = true,
  initialIndex = 0,
  advanceOnAnySwipe = false,
  disabled = false,
  currentUser = null,
  onCardViewed,
  onIndexChange,
  fitHeight = false,
  storyPushStatsByDish = {},
  showStoryHistoryCounter = false,
}, ref) {
  const router = useRouter();
  const { darkMode, t } = useLanguage();
  const SWIPE_EJECT_THRESHOLD = 88;
  const SWIPE_EJECT_VELOCITY = 680;
  const SWIPE_PROJECTED_THRESHOLD = 128;
  const SWIPE_MIN_ACTUAL_TRAVEL = 52;
  const initialDeck = formatDeckDishes(dishes);
  const initialDeckIndex = initialDeck.length > 0 ? Math.max(0, Math.min(initialIndex, initialDeck.length - 1)) : 0;

  const [deck, setDeck] = useState(() => initialDeck);
  const [currentIndex, setCurrentIndex] = useState(() => initialDeckIndex);
  const [deckInitialized, setDeckInitialized] = useState(() => initialDeck.length > 0);
  const [deckEmpty, setDeckEmpty] = useState(() => initialDeck.length === 0);
  const [currentMediaReadyKey, setCurrentMediaReadyKey] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [showRecipe, setShowRecipe] = useState(false);
  const [isEjecting, setIsEjecting] = useState(false);
  const [outgoingSwipe, setOutgoingSwipe] = useState(null);
  const [promotedCardMotionLocked, setPromotedCardMotionLocked] = useState(false);
  const [scrollPanelActive, setScrollPanelActive] = useState(false);
  const [recipePanelModal, setRecipePanelModal] = useState(null);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const [descriptionTruncated, setDescriptionTruncated] = useState(false);
  const [noRecipeNoticeOpen, setNoRecipeNoticeOpen] = useState(false);
  const [recipePanelOverflow, setRecipePanelOverflow] = useState({
    ingredients: false,
    method: false,
  });
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [dishCommentCount, setDishCommentCount] = useState(0);
  const [recipeCommentCount, setRecipeCommentCount] = useState(0);
  const [recipePreviewComment, setRecipePreviewComment] = useState(null);
  const [dishLikeCount, setDishLikeCount] = useState(0);
  const [dishLiked, setDishLiked] = useState(false);
  const [dishLikeSaving, setDishLikeSaving] = useState(false);
  const [commentsScope, setCommentsScope] = useState("dish");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [storyHistoryOpen, setStoryHistoryOpen] = useState(false);
  const ingredientsPanelRef = useRef(null);
  const methodPanelRef = useRef(null);
  const descriptionRef = useRef(null);
  const scrollPanelActiveRef = useRef(false);
  const currentVideoRef = useRef(null);
  const nextVideoRef = useRef(null);
  const mediaUnlockedRef = useRef(false);
  const mediaUnlockInFlightRef = useRef(false);
  const cardBackTapRef = useRef(null);
  const cardSidePreferenceRef = useRef(new Map());
  const autoResetRequestedRef = useRef(false);
  const dragTiltFactorRef = useRef(0);
  const outgoingClearedRef = useRef(false);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const cardRotate = useMotionValue(0);
  const finishOutgoingSwipe = useCallback(() => {
    if (outgoingClearedRef.current) return;
    outgoingClearedRef.current = true;
    setOutgoingSwipe(null);
    setPromotedCardMotionLocked(false);
    setIsEjecting(false);
  }, []);
  const resetDragPosition = useCallback(() => {
    dragX.stop();
    dragY.stop();
    cardRotate.stop();
    dragX.set(0);
    dragY.set(0);
    cardRotate.set(0);
    dragTiltFactorRef.current = 0;
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        dragX.stop();
        dragY.stop();
        cardRotate.stop();
        dragX.set(0);
        dragY.set(0);
        cardRotate.set(0);
      });
    }
  }, [cardRotate, dragX, dragY]);
  const updateDragTiltFactor = useCallback((event) => {
    const target = event.target;
    if (
      typeof Element !== "undefined" &&
      target instanceof Element &&
      target.closest("[data-no-drag='true']")
    ) {
      dragTiltFactorRef.current = 0;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const halfHeight = Math.max(1, rect.height / 2);
    const fromCenter = (event.clientY - centerY) / halfHeight;
    const distance = Math.min(1, Math.abs(fromCenter));
    const rawFactor = fromCenter === 0 ? 0 : Math.sign(-fromCenter) * Math.min(1, Math.max(0.38, distance * 1.35));
    dragTiltFactorRef.current = rawFactor;
  }, []);
  const updateDragRotation = useCallback(() => {
    const x = dragX.get();
    const rotate = (x / 170) * 18 * dragTiltFactorRef.current;
    cardRotate.set(Math.max(-18, Math.min(18, rotate)));
  }, [cardRotate, dragX]);
  const swipeAddEnabled = actionLabel === "+" && typeof onAction === "function";
  const rightCueOpacity = useTransform(dragX, [0, 50, 160], [0, 0.25, 0.75]);
  const leftCueOpacity = useTransform(dragX, [0, -50, -160], [0, 0.25, 0.75]);
  const rightCueScale = useTransform(dragX, [0, 50, 160], [0.7, 0.9, 1.1]);
  const leftCueScale = useTransform(dragX, [0, -50, -160], [0.7, 0.9, 1.1]);
  const normalizedDishLink = useMemo(() => {
    const rawLink = deck[currentIndex]?.dishLink?.trim();
    if (!rawLink) return "";
    return /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;
  }, [deck, currentIndex]);

  useEffect(() => {
    const formatted = formatDeckDishes(dishes);

    if (formatted.length > 0 && deckEmpty && currentIndex < formatted.length) {
      setDeckEmpty(false);
    }

    if (!deckInitialized) {
      if (formatted.length > 0) {
        setDeck(formatted);
        setCurrentIndex(Math.max(0, Math.min(initialIndex, formatted.length - 1)));
        setDeckInitialized(true);
        setDeckEmpty(false);
      } else {
        setDeckEmpty(true);
      }
      return;
    }

    if (preserveContinuity) {
      const currentKey = deck[currentIndex]?._key || null;
      const previousKeys = deck.map((dish) => dish._key).join("|");
      const nextKeys = formatted.map((dish) => dish._key).join("|");
      if (previousKeys !== nextKeys) {
        setDeck(formatted);
        setCurrentIndex(() => {
          if (!formatted.length) return 0;
          const nextIndex = currentKey ? formatted.findIndex((dish) => dish._key === currentKey) : -1;
          return nextIndex >= 0 ? nextIndex : 0;
        });
        setDeckEmpty(formatted.length === 0);
      }
      return;
    }

    if (!preserveContinuity) {
      setDeck((prev) => {
        const existing = new Set(prev.map((d) => d._key));
        const appended = formatted.filter((d) => !existing.has(d._key));
        return appended.length > 0 ? [...prev, ...appended] : prev;
      });
    }
  }, [dishes, deck, currentIndex, deckInitialized, preserveContinuity, initialIndex]);

  const currentCard = useMemo(() => deck[currentIndex] || null, [deck, currentIndex]);
  const nextCard = deck[currentIndex + 1] || null;
  const currentCardStableKey = currentCard?.id || currentCard?._key || "";
  const currentMediaReady = Boolean(currentCard && (isDishVideo(currentCard) || currentMediaReadyKey === currentCard._key));

  useEffect(() => {
    if (!currentCard?._key) {
      setCurrentMediaReadyKey("");
      return;
    }
    if (isDishVideo(currentCard)) {
      setCurrentMediaReadyKey(currentCard._key);
      return;
    }
    setCurrentMediaReadyKey("");
  }, [currentCard?._key, currentCard]);

  useEffect(() => {
    if (!deckEmpty) {
      autoResetRequestedRef.current = false;
      return;
    }
    if (typeof onResetFeed !== "function" || autoResetRequestedRef.current) return;
    autoResetRequestedRef.current = true;
    onResetFeed();
  }, [deckEmpty, onResetFeed]);

  useEffect(() => {
    const upcoming = deck
      .slice(currentIndex, currentIndex + 6)
      .filter((dish) => dish && !isDishVideo(dish))
      .map((dish) => getDishImageUrl(dish))
      .filter(Boolean);

    upcoming.forEach((src) => {
      void preloadDeckImage(src);
    });
  }, [deck, currentIndex]);

  useEffect(() => {
    if (typeof onIndexChange === "function") {
      onIndexChange(currentIndex, currentCard);
    }
  }, [currentIndex, currentCard?._key, onIndexChange]);

  const setCardBackVisible = useCallback((nextVisible) => {
    if (currentCardStableKey) cardSidePreferenceRef.current.set(currentCardStableKey, nextVisible);
    setShowRecipe(nextVisible);
  }, [currentCardStableKey]);

  useEffect(() => {
    const savedSide = currentCardStableKey ? cardSidePreferenceRef.current.get(currentCardStableKey) : undefined;
    setShowRecipe(typeof savedSide === "boolean" ? savedSide || isRecipeOnlyDish(currentCard) : isRecipeOnlyDish(currentCard));
    setRecipePanelModal(null);
    setDescriptionModalOpen(false);
    setDescriptionTruncated(false);
    setNoRecipeNoticeOpen(false);
    setScrollPanelActive(false);
    scrollPanelActiveRef.current = false;
  }, [currentCardStableKey]);

  useLayoutEffect(() => {
    if (!currentCard?.description || showRecipe) {
      setDescriptionTruncated(false);
      return undefined;
    }

    const measureDescription = () => {
      const node = descriptionRef.current;
      setDescriptionTruncated(Boolean(node && node.scrollHeight - node.clientHeight > 2));
    };

    measureDescription();

    const node = descriptionRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measureDescription);
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentCard?._key, currentCard?.description, showRecipe]);

  useEffect(() => {
    if (!showRecipe) {
      setRecipePanelOverflow({ ingredients: false, method: false });
      return;
    }

    const measureOverflow = () => {
      const ingredientsNode = ingredientsPanelRef.current;
      const methodNode = methodPanelRef.current;
      setRecipePanelOverflow({
        ingredients: Boolean(
          ingredientsNode && ingredientsNode.scrollHeight - ingredientsNode.clientHeight > 8
        ),
        method: Boolean(methodNode && methodNode.scrollHeight - methodNode.clientHeight > 8),
      });
    };

    measureOverflow();

    const nodes = [ingredientsPanelRef.current, methodPanelRef.current].filter(Boolean);
    if (!nodes.length || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureOverflow);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [showRecipe, currentCard?._key]);

  useEffect(() => {
    if (!currentCard?.id) return;
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    onCardViewed?.(currentCard);
    setComments([]);
    setDishCommentCount(0);
    setRecipeCommentCount(0);
    setRecipePreviewComment(null);
    setDishLikeCount(Math.max(0, Number(currentCard.likes || 0)));
    setDishLiked(false);
    setDishLikeSaving(false);
    setCommentsScope("dish");
    setNewComment("");
    setReplyTo(null);
    const loadPreviewComments = async () => {
      const [dishItems, recipeItems, firstRecipeItems, likeState] = await Promise.all([
        getCommentsForDish(currentCard.id, 50, "dish"),
        getCommentsForDish(currentCard.id, 50, "recipe"),
        getCommentsForDish(currentCard.id, 1, "recipe", "asc"),
        getDishLikeState(currentCard.id, currentUser?.uid || null),
      ]);
      if (cancelled) return;
      setDishCommentCount(Array.isArray(dishItems) ? dishItems.length : 0);
      setRecipeCommentCount(Array.isArray(recipeItems) ? recipeItems.length : 0);
      setRecipePreviewComment(Array.isArray(firstRecipeItems) ? firstRecipeItems[0] || null : null);
      setDishLikeCount(Math.max(0, Number(likeState?.count || 0)));
      setDishLiked(Boolean(likeState?.liked));
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => {
        void loadPreviewComments();
      }, { timeout: 900 });
    } else if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(() => {
        void loadPreviewComments();
      }, 250);
    } else {
      void loadPreviewComments();
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentCard?.id, onCardViewed]);

  const actionBottom = 24;
  const viewToggleBottom = actionBottom + 12;
  const tagsBottom = actionBottom + 64;
  const commentBottom = tagsBottom + 8;
  const textBottom = Math.max(88, commentBottom + 4);
  const recipeContentBottom = Math.max(tagsBottom + 28, 132);
  const currentCardBorderClass = isRestaurantDish(currentCard) ? "border-[#E64646]" : "border-[#E4B43F]";
  const nextCardBorderClass = isRestaurantDish(nextCard) ? "border-[#E64646]" : "border-[#E4B43F]";
  const currentCardBaseBorderColor = currentCardBorderClass === "border-[#E64646]" ? "#E64646" : "#E4B43F";
  const activeCardBorderColor = useTransform(
    dragX,
    [-160, -40, 0, 36, 140],
    [currentCardBaseBorderColor, currentCardBaseBorderColor, currentCardBaseBorderColor, "#2BD36B", "#2BD36B"]
  );
  const currentStoryStats = currentCard?.id ? storyPushStatsByDish?.[currentCard.id] || null : null;
  const currentStoryPushCount = Number(currentStoryStats?.count || 0);
  const currentStoryPushHistory = Array.isArray(currentStoryStats?.history) ? currentStoryStats.history : [];
  const currentRestaurantLabel = getSafeRestaurantLabel(currentCard);
  const currentRestaurantPlaceId = getSafeRestaurantPlaceId(currentCard);
  const currentRestaurant = currentCard?.restaurant || null;
  const currentRestaurantLat = Number(currentRestaurant?.lat);
  const currentRestaurantLng = Number(currentRestaurant?.lng);
  const currentDishPriceLabel = formatDishPrice(currentCard);
  const uploadDateLabel = getRelativeUploadTime(currentCard?.createdAt);
  const restaurantAccentBorder = isRestaurantDish(currentCard) ? "restaurant-accent-border" : "default-accent-border";
  const currentCardIsRestaurant = isRestaurantDish(currentCard);
  const hasIngredientsText = !currentCardIsRestaurant && Boolean(String(currentCard?.recipeIngredients || "").trim());
  const hasMethodText = !currentCardIsRestaurant && Boolean(String(currentCard?.recipeMethod || "").trim());
  const hasAnyRecipeText = hasIngredientsText || hasMethodText;
  const hasRestaurantMapView =
    currentCardIsRestaurant &&
    Boolean(currentRestaurantPlaceId && currentRestaurantLabel) &&
    Number.isFinite(currentRestaurantLat) &&
    Number.isFinite(currentRestaurantLng);
  const hasCardBackView = hasAnyRecipeText || hasRestaurantMapView;
  const cardBackAccent = hasRestaurantMapView ? "#B93A32" : "#FFC247";
  const cardBackSelectedTextColor = hasRestaurantMapView ? "#FFE7C7" : "#050505";
  const cardFrontLabel = hasRestaurantMapView ? "piatto" : "dish";
  const cardBackLabel = hasRestaurantMapView ? "ristorante" : "recipe";
  const currentRestaurantMapGroups = hasRestaurantMapView
    ? [
        {
          placeId: currentRestaurantPlaceId,
          name: currentRestaurantLabel,
          address: currentRestaurant?.address || "",
          lat: currentRestaurantLat,
          lng: currentRestaurantLng,
          dishes: currentCard ? [currentCard] : [],
          users: currentCard
            ? [
                {
                  id: String(currentCard.owner || currentCard.ownerId || currentCard.userId || "").trim(),
                  aliases: [
                    currentCard.owner,
                    currentCard.ownerId,
                    currentCard.userId,
                    currentCard.profileId,
                  ].filter(Boolean),
                  name: currentCard.ownerName || "User",
                  photoURL: currentCard.ownerPhotoURL || "",
                  dishes: [currentCard],
                },
              ].filter((item) => item.id)
            : [],
        },
      ]
    : [];
  const currentCardRecipeOnly = isRecipeOnlyDish(currentCard);
  const visibleRecipe = currentCardRecipeOnly || showRecipe;
  const visibleRestaurantMap = visibleRecipe && hasRestaurantMapView;
  const resolvedSecondaryActionLabel =
    typeof secondaryActionLabel === "function" ? secondaryActionLabel(currentCard) : secondaryActionLabel;
  const resolvedSecondaryActionClassName =
    typeof secondaryActionClassName === "function"
      ? secondaryActionClassName(currentCard)
      : secondaryActionClassName;
  const resolvedSecondaryActionToast =
    typeof secondaryActionToast === "function" ? secondaryActionToast(currentCard) : secondaryActionToast;
  const hasBottomActionRow =
    Boolean(resolvedSecondaryActionLabel) &&
    Boolean(tertiaryActionLabel) &&
    Boolean(actionLabel);
  const nextCardScale = useTransform(dragX, [-120, -18, 0, 18, 120], [1, 1, 1, 1, 1]);

  const startCardVideo = useCallback((video) => {
    if (!video) return () => {};

    let cancelled = false;

    const run = async () => {
      if (cancelled || !video.isConnected) return;
      try {
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.controls = false;
        video.preload = "auto";
        video.defaultMuted = false;
        await video.play?.();
      } catch {
        if (cancelled) return;
      }
    };

    const handleReady = () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      run();
    };

    if (video.readyState >= 2) {
      run();
    } else {
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      try {
        video.load();
      } catch {}
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
    };
  }, []);

  const unlockDeckMedia = useCallback(async () => {
    if (mediaUnlockedRef.current || mediaUnlockInFlightRef.current) return;

    const currentDeckVideo =
      !showRecipe && currentCard && isDishVideo(currentCard) ? currentVideoRef.current : null;
    const nextDeckVideo = nextCard && isDishVideo(nextCard) ? nextVideoRef.current : null;
    const video = currentDeckVideo || nextDeckVideo;

    if (!video) return;

    mediaUnlockInFlightRef.current = true;
    const shouldResetAfterUnlock = video !== currentDeckVideo;

    try {
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = "auto";
      video.defaultMuted = false;
      video.volume = 1;
      if (video.readyState === 0) {
        try {
          video.load();
        } catch {}
      }
      await video.play?.();
      mediaUnlockedRef.current = true;

      if (shouldResetAfterUnlock) {
        video.pause?.();
        try {
          video.currentTime = 0;
        } catch {}
      }
    } catch {
      startCardVideo(video, false);
    } finally {
      mediaUnlockInFlightRef.current = false;
    }
  }, [currentCard, nextCard, showRecipe, startCardVideo]);

  const handleDeckMediaUnlock = useCallback(() => {
    void unlockDeckMedia();
  }, [unlockDeckMedia]);

  useEffect(() => {
    const video = currentVideoRef.current;
    if (!video || showRecipe || !currentCard || !isDishVideo(currentCard)) return;
    const frame = window.requestAnimationFrame(() => {
      startCardVideo(video);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [currentCard?._key, showRecipe, startCardVideo]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      try {
        currentVideoRef.current?.pause?.();
      } catch {}
      try {
        nextVideoRef.current?.pause?.();
      } catch {}
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const StoryStatIcon = ({ size = 10 }) => (
    <svg width={size} height={size} viewBox="0 0 26 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="4.05" stroke="#2BD36B" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6.8" stroke="#2BD36B" strokeWidth="1.8" opacity="0.88" />
      <path d="M1.35 3.55V8.7" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0.2 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M2.5 3.55V6.2" stroke="#2BD36B" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M1.35 8.7V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55C20.95 4.92 19.65 7.02 19.65 9.68V12.08" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M23.6 3.55V19" stroke="#2BD36B" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );

  const openRecipePanelModal = (panel) => {
    scrollPanelActiveRef.current = true;
    setScrollPanelActive(true);
    setRecipePanelModal(panel);
  };

  const closeRecipePanelModal = () => {
    scrollPanelActiveRef.current = false;
    setScrollPanelActive(false);
    setRecipePanelModal(null);
  };

  const loadComments = async (scope = commentsScope) => {
    if (!currentCard?.id) return;
    setCommentsLoading(true);
    try {
      const items = await getCommentsForDish(currentCard.id, 30, scope);
      setComments(items);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openComments = async (scope = "dish") => {
    setCommentsScope(scope);
    setCommentsOpen(true);
    await loadComments(scope);
  };

  const submitComment = async () => {
    if (!currentCard?.id) return;
    if (!currentUser?.uid) {
      if (typeof onAuthRequired === "function") onAuthRequired();
      return;
    }
    const text = newComment.trim();
    if (!text) return;
    const ok = await addCommentToDish(currentCard.id, {
      userId: currentUser.uid,
      userName: currentUser.displayName || "User",
      userPhotoURL: currentUser.photoURL || "",
      text,
      parentId: replyTo?.id || null,
    }, commentsScope);
    if (!ok) return;
    const recipients = Array.from(
      new Set([String(currentCard.owner || "").trim()].filter(Boolean))
    ).filter((id) => id && id !== currentUser.uid);
    if (recipients.length) {
      void dispatchPushEvent("comment_posted", {
        actorId: currentUser.uid,
        recipientIds: recipients,
        dishId: currentCard.id,
        dishName: currentCard.name || "",
        commentText: text,
        isStoryComment: false,
      });
    }
    setNewComment("");
    setReplyTo(null);
    await loadComments(commentsScope);
    const items = await getCommentsForDish(currentCard.id, 50, commentsScope);
    if (commentsScope === "recipe") {
      setRecipeCommentCount(Array.isArray(items) ? items.length : 0);
      const firstItems = await getCommentsForDish(currentCard.id, 1, "recipe", "asc");
      setRecipePreviewComment(Array.isArray(firstItems) ? firstItems[0] || null : null);
    } else {
      setDishCommentCount(Array.isArray(items) ? items.length : 0);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!currentCard?.id || !comment?.id) return;
    if (comment.userId !== currentUser?.uid) return;
    const ok = await deleteCommentThread(currentCard.id, comment.id, commentsScope);
    if (!ok) return;
    await loadComments(commentsScope);
    const items = await getCommentsForDish(currentCard.id, 50, commentsScope);
    if (commentsScope === "recipe") {
      setRecipeCommentCount(Array.isArray(items) ? items.length : 0);
      const firstItems = await getCommentsForDish(currentCard.id, 1, "recipe", "asc");
      setRecipePreviewComment(Array.isArray(firstItems) ? firstItems[0] || null : null);
    } else {
      setDishCommentCount(Array.isArray(items) ? items.length : 0);
    }
  };

  const advanceCard = () => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= deck.length) {
        setDeckEmpty(true);
        if (typeof onDeckEmpty === "function") onDeckEmpty();
      }
      return next;
    });
  };

  const goToPreviousCard = () => {
    if (disabled || isEjecting || currentIndex <= 0) return;
    setDeckEmpty(false);
    setShowRecipe(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    resetDragPosition();
  };

  const goToNextCardFromArrow = async () => {
    if (disabled || isEjecting || !currentCard) return;
    setIsEjecting(true);
    const targetX = -(typeof window !== "undefined" ? window.innerWidth + 180 : 760);
    try {
      await Promise.all([
        animate(dragX, targetX, {
          type: "tween",
          duration: 0.38,
          ease: [0.16, 1, 0.3, 1],
        }).finished,
        animate(dragY, -24, {
          type: "tween",
          duration: 0.38,
          ease: [0.16, 1, 0.3, 1],
        }).finished,
      ]);
    } catch {}
    if (trackSwipes && typeof onSwiped === "function") onSwiped(currentCard.id);
    advanceCard();
    setIsEjecting(false);
    resetDragPosition();
  };

  useImperativeHandle(
    ref,
    () => ({
      previous: goToPreviousCard,
      next: goToNextCardFromArrow,
    }),
    [currentIndex, currentCard, disabled, isEjecting]
  );

  const runAction = (card) => {
    if (typeof onAction !== "function") {
      if (typeof onAuthRequired === "function") onAuthRequired();
      return;
    }
    Promise.resolve(onAction(card))
      .then((result) => {
        if (result && typeof result === "object" && result.skipToast) {
          return;
        }
        if (result === false) {
          return;
        }
        setToastVariant("success");
        setToast(actionToast || "Added to DishList");
        setTimeout(() => setToast(""), 1200);
      })
      .catch((err) => {
        console.error("Deck action failed:", err);
        setToastVariant("error");
        setToast("Action failed");
        setTimeout(() => setToast(""), 1200);
      });
  };

  const handleActionPress = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isEjecting) return;
    const card = currentCard;
    if (dismissOnAction) advanceCard();
    resetDragPosition();
    runAction(card);
  };

  const handleLikePress = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || dishLikeSaving || !currentCard?.id) return;
    if (!currentUser?.uid) {
      if (typeof onAuthRequired === "function") onAuthRequired();
      return;
    }
    const previousLiked = dishLiked;
    const previousCount = dishLikeCount;
    const optimisticLiked = !previousLiked;
    setDishLiked(optimisticLiked);
    setDishLikeCount((count) => Math.max(0, Number(count || 0) + (optimisticLiked ? 1 : -1)));
    setDishLikeSaving(true);
    const result = await toggleDishLike(currentCard.id, currentUser.uid);
    setDishLikeSaving(false);
    if (!result) {
      setDishLiked(previousLiked);
      setDishLikeCount(previousCount);
      return;
    }
    setDishLiked(Boolean(result.liked));
    setDishLikeCount(Math.max(0, Number(result.count || 0)));
  };

  const handleSecondaryActionPress = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isEjecting) return;
    if (typeof onSecondaryAction !== "function") return;
    const card = currentCard;
    if (dismissOnSecondaryAction) advanceCard();
    resetDragPosition();
    Promise.resolve(onSecondaryAction(card))
      .then((result) => {
        if (result === false) {
          setToastVariant("error");
          setToast("Action failed");
          setTimeout(() => setToast(""), 1200);
          return;
        }
        if (resolvedSecondaryActionToast) {
          setToastVariant("success");
          setToast(resolvedSecondaryActionToast);
          setTimeout(() => setToast(""), 1200);
        }
      })
      .catch((err) => {
        console.error("Deck secondary action failed:", err);
        setToastVariant("error");
        setToast("Action failed");
        setTimeout(() => setToast(""), 1200);
      });
  };

  const handleTertiaryActionPress = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isEjecting) return;
    if (typeof onTertiaryAction !== "function") return;
    const card = currentCard;
    if (dismissOnTertiaryAction) advanceCard();
    resetDragPosition();
    Promise.resolve(onTertiaryAction(card)).catch((err) => {
      console.error("Deck tertiary action failed:", err);
      setToastVariant("error");
      setToast("Action failed");
      setTimeout(() => setToast(""), 1200);
    });
  };

  const handleStartOver = () => {
    if (typeof onResetFeed === "function") {
      onResetFeed();
      return;
    }
    setCurrentIndex(0);
    setDeckEmpty(false);
    setShowRecipe(false);
    resetDragPosition();
  };

  const handleSwipeEnd = async (info, dish) => {
    if (disabled || isEjecting) return;
    const projectedX = info.offset.x + info.velocity.x * 0.28;
    const horizontalTravel = Math.abs(projectedX);
    const actualHorizontalTravel = Math.abs(info.offset.x);
    const horizontalIntent =
      actualHorizontalTravel >= SWIPE_EJECT_THRESHOLD ||
      (actualHorizontalTravel >= SWIPE_MIN_ACTUAL_TRAVEL &&
        Math.abs(info.velocity.x) >= SWIPE_EJECT_VELOCITY &&
        horizontalTravel >= SWIPE_PROJECTED_THRESHOLD);
    const verticalDominant = Math.abs(info.offset.y) > Math.max(90, horizontalTravel * 1.45);
    const shouldEject =
      horizontalIntent && !verticalDominant;
    if (shouldEject) {
      const direction = projectedX >= 0 ? 1 : -1;
      setIsEjecting(true);
      if (!advanceOnAnySwipe && swipeAddEnabled && actionOnRightSwipe && direction > 0) {
        runAction(dish);
      }
      if (!advanceOnAnySwipe && direction > 0 && typeof onRightSwipe === "function") {
        setToastVariant("swipe");
        setToast(rightSwipeToast);
        setTimeout(() => setToast(""), 1450);
        Promise.resolve(onRightSwipe(dish))
          .then((result) => {
            if (result === false) {
              setToastVariant("error");
              setToast(rightSwipeErrorToast);
              setTimeout(() => setToast(""), 1200);
              return;
            }
          })
          .catch((err) => {
            console.error("Right swipe action failed:", err);
            setToastVariant("error");
            setToast(rightSwipeErrorToast);
            setTimeout(() => setToast(""), 1200);
          });
      }
      if (trackSwipes && typeof onSwiped === "function") onSwiped(dish.id);

      const releaseX = dragX.get();
      const releaseY = dragY.get();
      const startX = Number.isFinite(releaseX) ? releaseX : info.offset.x;
      const startY = Number.isFinite(releaseY) ? releaseY : info.offset.y;
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 580;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 820;
      const cardWidth = Math.min(viewportWidth, 448);
      const targetX = direction * (cardWidth + 28);
      const referenceX = Math.abs(startX) > 18 ? startX : direction * 80;
      const slope = Math.abs(referenceX) > 1 ? startY / referenceX : 0;
      const projectedTargetY = startY + (targetX - startX) * slope;
      const targetY = Math.max(-viewportHeight * 0.42, Math.min(viewportHeight * 0.42, projectedTargetY));
      const liveRotate = cardRotate.get();
      const releaseRotate = Math.max(-18, Math.min(18, Number.isFinite(liveRotate) ? liveRotate : 0));
      const targetRotate = releaseRotate;
      const duration = 0.5;
      outgoingClearedRef.current = false;
      setOutgoingSwipe({
        key: `${dish?._key || dish?.id || "dish"}-${Date.now()}`,
        card: dish,
        startX,
        startY,
        targetX,
        targetY,
        rotateStart: releaseRotate,
        rotateEnd: targetRotate,
        duration,
        borderColor: isRestaurantDish(dish) ? "#E64646" : "#E4B43F",
        borderClass: isRestaurantDish(dish) ? "dish-card-shell--restaurant" : "dish-card-shell--default",
      });
      setPromotedCardMotionLocked(true);
      resetDragPosition();
      advanceCard();
      return;
    }
    void Promise.all([
      animate(dragX, 0, {
        type: "spring",
        stiffness: 360,
        damping: 32,
        mass: 0.72,
      }).finished,
      animate(dragY, 0, {
        type: "spring",
        stiffness: 360,
        damping: 32,
        mass: 0.72,
      }).finished,
      animate(cardRotate, 0, {
        type: "spring",
        stiffness: 360,
        damping: 32,
        mass: 0.72,
      }).finished,
    ]);
  };

  const renderImage = (
    dish,
    { active = false, preview = false, onVideoRef = null, onImageReady = null } = {}
  ) => {
    const imageSrc = getDishImageUrl(dish);
    if (isDishVideo(dish)) {
      return (
        <DeckAutoplayVideo
          src={imageSrc}
          onVideoRef={onVideoRef}
          className="pointer-events-none block w-full h-full object-cover"
        />
      );
    }
    return (
      <img
        src={imageSrc}
        alt={dish.name}
        decoding="async"
        fetchPriority={active || preview ? "high" : "auto"}
        className="block w-full h-full object-cover"
        onLoad={onImageReady || undefined}
        onError={(e) => {
          e.currentTarget.src = DEFAULT_DISH_IMAGE;
          if (typeof onImageReady === "function") onImageReady();
        }}
      />
    );
  };

  const renderPreviewChrome = (dish) => {
    if (!dish) return null;
    const previewAccentBorder = isRestaurantDish(dish) ? "restaurant-accent-border" : "default-accent-border";
    const previewRestaurantLabel = getSafeRestaurantLabel(dish);
    const previewPriceLabel = formatDishPrice(dish);
    const previewUploadDate = getRelativeUploadTime(dish.createdAt);
    const previewIsRestaurant = isRestaurantDish(dish);
    const previewHasRecipe = !previewIsRestaurant && (Boolean(String(dish?.recipeIngredients || "").trim()) || Boolean(String(dish?.recipeMethod || "").trim()));
    const previewHasRestaurantMap = previewIsRestaurant && Boolean(getSafeRestaurantPlaceId(dish) && previewRestaurantLabel);
    const previewHasToggle = previewHasRecipe || previewHasRestaurantMap;
    const previewBackAccent = previewHasRestaurantMap ? "#B93A32" : "#FFC247";
    const previewSelectedTextColor = previewHasRestaurantMap ? "#FFE7C7" : "#050505";

    return (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-32 bg-gradient-to-b from-black/50 via-black/22 via-55% to-transparent"
        />
        <div className={`pointer-events-none absolute left-4 top-4 z-[13] flex max-w-[14.5rem] flex-col items-start gap-1.5 text-white`}>
          <div className="flex min-w-0 items-center gap-2">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${previewAccentBorder} bg-black/35 text-sm font-bold`}>
              {dish.ownerPhotoURL ? (
                <img src={dish.ownerPhotoURL} alt={dish.ownerName || "User"} className="h-full w-full object-cover" />
              ) : (
                (dish.ownerName?.[0] || "U").toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.98rem] font-semibold leading-tight">{dish.ownerName || "Unknown"}</p>
              {previewUploadDate ? (
                <div className="mt-0.5 text-[0.82rem] font-medium leading-none text-white/75">
                  {previewUploadDate}
                </div>
              ) : null}
            </div>
          </div>
          {isRestaurantDish(dish) && previewRestaurantLabel ? (
            <div
              className="restaurant-accent-border max-w-full truncate rounded-full border-2 bg-black/70 px-3 py-1 text-[11px] font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-md"
              style={{ border: "2px solid #E64646", boxShadow: "inset 0 0 0 2px #E64646, 0 8px 22px rgba(0,0,0,0.28)" }}
            >
              {previewRestaurantLabel}
            </div>
          ) : null}
        </div>
        <div className="no-accent-border pointer-events-none absolute right-4 top-4 z-[13] inline-flex h-8 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <Users size={13} strokeWidth={2.25} />
          <span>{Math.max(0, Number(dish.saves || 0))}</span>
        </div>
        {previewHasToggle ? (
          <div className="pointer-events-none absolute left-5 z-[14]" style={{ bottom: viewToggleBottom }}>
            <div className="no-accent-border inline-flex h-8 items-center gap-0.5 rounded-full bg-black/82 p-0.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur-md">
              <div
                className="no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none"
                style={{ backgroundColor: previewBackAccent, color: previewSelectedTextColor, WebkitTextFillColor: previewSelectedTextColor }}
              >
                {previewHasRestaurantMap ? "piatto" : "dish"}
              </div>
              <div className="no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none text-white/95">
                {previewHasRestaurantMap ? "ristorante" : "recipe"}
              </div>
            </div>
          </div>
        ) : null}
        {actionLabel ? (
          <div className="pointer-events-none absolute right-6 z-[14] flex items-center gap-1.5" style={{ bottom: actionBottom }}>
            <div className="relative inline-flex h-14 w-10 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]">
              <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none" />
              <MessageCircle size={28} strokeWidth={2.15} />
            </div>
            <div className="relative inline-flex h-14 w-10 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]">
              <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none">{Number(dish.likes || 0) > 0 ? Number(dish.likes || 0) : ""}</span>
              <Heart size={31} strokeWidth={2.2} />
            </div>
            <div className={actionClassName || "add-action-btn no-accent-border w-14 h-14 text-[36px]"}>
              {actionLabel === "+" ? <Plus size={26} strokeWidth={2.1} /> : actionLabel}
            </div>
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[12]"
          style={{
            height: "42%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.58) 42%, rgba(0,0,0,0.32) 72%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="pointer-events-none absolute left-5 right-5 z-[13] text-white" style={{ bottom: textBottom }}>
          <div className="text-left text-2xl font-bold">{dish.name}</div>
          {dish.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-white/80">{dish.description}</p>
          ) : null}
          {dish.taggedUserName ? (
            <div className="mt-1 inline-flex max-w-full items-center rounded-full bg-black/68 px-3 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md">
              @{String(dish.taggedUserName).replace(/^@+/, "")}
            </div>
          ) : null}
          {dish?.dishMode === "restaurant" ? (
            <div className="mt-1 flex flex-col items-start gap-1">
              <RatingStars value={dish.rating} size="text-[1.05rem]" readOnly />
              {previewPriceLabel ? (
                <span className="inline-flex rounded-full bg-black/68 px-2.5 py-1 text-[11px] font-black text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md">
                  {previewPriceLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    );
  };

  if (deckEmpty || !currentCard) {
    if (typeof onResetFeed === "function") {
      return (
        <div className={`flex items-center justify-center ${fitHeight ? "h-full" : "h-[70vh]"}`}>
          <img
            src="/logo-real.png"
            alt="DishList"
            className="h-20 w-20 object-contain dishlist-loading-logo"
          />
        </div>
      );
    }
    return (
      <div className={`flex flex-col items-center justify-center text-gray-500 text-lg ${fitHeight ? "h-full" : "h-[70vh]"}`}>
        You&apos;re all caught up!
        {hasMore ? (
          <button
            onClick={loadMoreDishes}
            disabled={loadingMore}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        ) : (
          <button
            onClick={handleStartOver}
            className="mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold"
          >
            Start Over
          </button>
        )}
      </div>
    );
  }

  const freezeCurrentMotion = promotedCardMotionLocked;
  const releasePromotedMotionLock = (event) => {
    if (outgoingSwipe || isEjecting) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target;
    if (
      typeof Element !== "undefined" &&
      target instanceof Element &&
      target.closest("[data-no-drag='true']")
    ) {
      return;
    }
    resetDragPosition();
    finishOutgoingSwipe();
  };
  return (
    <div className={`flex flex-col items-center justify-center ${fitHeight ? "h-full min-h-0" : "min-h-[72vh]"}`}>
      <div
        className={`isolate relative w-full max-w-md ${fitHeight ? "h-full min-h-0" : "h-[74vh]"}`}
        onPointerDownCapture={(event) => {
          handleDeckMediaUnlock(event);
          releasePromotedMotionLock(event);
        }}
        onTouchStartCapture={(event) => {
          handleDeckMediaUnlock(event);
          releasePromotedMotionLock(event);
        }}
        onClickCapture={handleDeckMediaUnlock}
      >
        {nextCard && currentMediaReady ? (
          <motion.div
            className={`dish-card-shell pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[28px] ${nextCardBorderClass === "border-[#E64646]" ? "dish-card-shell--restaurant" : "dish-card-shell--default"} ${fitHeight ? "h-full" : "h-[74vh]"}`}
            style={{ scale: nextCardScale, zIndex: 0, borderColor: nextCardBorderClass === "border-[#E64646]" ? "#E64646" : "#E4B43F" }}
          >
            {renderImage(nextCard, {
              preview: true,
              onVideoRef: (node) => {
                nextVideoRef.current = node;
              },
            })}
            {renderPreviewChrome(nextCard)}
          </motion.div>
        ) : null}
        <AnimatePresence>
          {outgoingSwipe ? (
            <motion.div
              layout={false}
              key={outgoingSwipe.key}
              className={`dish-card-shell pointer-events-none absolute inset-0 z-[70] overflow-hidden rounded-[28px] ${outgoingSwipe.borderClass} bg-white ${fitHeight ? "h-full" : "h-[74vh]"}`}
              initial={{
                x: outgoingSwipe.startX,
                y: outgoingSwipe.startY,
                rotate: outgoingSwipe.rotateStart,
                opacity: 1,
              }}
              animate={{
                x: outgoingSwipe.targetX,
                y: outgoingSwipe.targetY,
                rotate: outgoingSwipe.rotateEnd,
                opacity: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{
                x: { type: "tween", duration: outgoingSwipe.duration, ease: "linear" },
                y: { type: "tween", duration: outgoingSwipe.duration, ease: "linear" },
                rotate: { type: "tween", duration: outgoingSwipe.duration, ease: "linear" },
                opacity: { duration: 0.12 },
              }}
              style={{
                borderColor: outgoingSwipe.borderColor,
                transformOrigin: "50% 50%",
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
              onAnimationComplete={() => {
                finishOutgoingSwipe();
              }}
            >
              {renderImage(outgoingSwipe.card, { preview: true })}
              {renderPreviewChrome(outgoingSwipe.card)}
              {outgoingSwipe.targetX > 0 ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#23C268]/22">
                  <div className="flex h-48 w-48 scale-110 flex-col items-center justify-center rounded-full border-4 border-[#23C268]/90 bg-black/45 px-5 text-center shadow-[0_0_42px_rgba(35,194,104,0.45)] backdrop-blur-sm">
                    {typeof onRightSwipe === "function" ? (
                      <>
                        <div className="mb-2 text-[1.15rem] font-black uppercase tracking-[0.1em] text-[#23C268]">
                          All dishes
                        </div>
                        <Plus size={92} strokeWidth={2.35} className="text-[#23C268]" />
                      </>
                    ) : (
                      <Plus size={110} strokeWidth={2.35} className="text-[#23C268]" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                  <div className="flex h-48 w-48 scale-110 items-center justify-center rounded-full border-4 border-white/80 bg-black/30 text-[110px] font-light leading-none text-white backdrop-blur-sm">
                    ×
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <motion.div
          key={currentCard._key}
          drag={disabled || isEjecting || scrollPanelActive || visibleRestaurantMap ? false : true}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.74}
          dragMomentum={false}
          style={{
            x: freezeCurrentMotion ? 0 : dragX,
            y: freezeCurrentMotion ? 0 : dragY,
            rotate: freezeCurrentMotion ? 0 : cardRotate,
            transformOrigin: "50% 50%",
            touchAction: visibleRestaurantMap ? "auto" : "none",
            borderColor: freezeCurrentMotion ? currentCardBaseBorderColor : activeCardBorderColor,
          }}
          onPointerDownCapture={updateDragTiltFactor}
          onTouchStartCapture={(event) => {
            const touch = event.touches?.[0];
            if (!touch) return;
            updateDragTiltFactor({
              target: event.target,
              currentTarget: event.currentTarget,
              clientY: touch.clientY,
            });
          }}
          onDrag={updateDragRotation}
          onDragEnd={(e, info) => handleSwipeEnd(info, currentCard)}
          className={`dish-card-shell pressable-card relative z-30 overflow-hidden w-full cursor-grab rounded-[28px] ${currentCardBorderClass === "border-[#E64646]" ? "dish-card-shell--restaurant" : "dish-card-shell--default"} ${visibleRestaurantMap ? "dish-card-shell--map-open" : ""} bg-white ${fitHeight ? "h-full" : "h-[74vh]"}`}
        >
          {swipeAddEnabled && !outgoingSwipe && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#23C268]/22"
              style={{ opacity: rightCueOpacity }}
            >
              <motion.div
                style={{ scale: rightCueScale }}
                className="flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-[#23C268]/90 bg-black/45 px-5 text-center shadow-[0_0_42px_rgba(35,194,104,0.45)] backdrop-blur-sm"
              >
                {typeof onRightSwipe === "function" ? (
                  <>
                    <div className="mb-2 text-[1.15rem] font-black uppercase tracking-[0.1em] text-[#23C268]">
                      All dishes
                    </div>
                    <Plus size={92} strokeWidth={2.35} className="text-[#23C268]" />
                  </>
                ) : (
                  <Plus size={110} strokeWidth={2.35} className="text-[#23C268]" />
                )}
              </motion.div>
            </motion.div>
          )}
          {!outgoingSwipe ? (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30"
              style={{ opacity: leftCueOpacity }}
            >
              <motion.div
                style={{ scale: leftCueScale }}
                className="w-48 h-48 rounded-full border-4 border-white/80 bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-[110px] leading-none font-light"
              >
                ×
              </motion.div>
            </motion.div>
          ) : null}
          {!darkMode ? (
            <div
              data-no-drag="true"
              className={`absolute top-4 left-1/2 z-30 -translate-x-1/2`}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerMoveCapture={(e) => e.stopPropagation()}
              onPointerUpCapture={(e) => e.stopPropagation()}
            >
              {hasAnyRecipeText && !currentCardRecipeOnly ? (
                <div className={`no-accent-border flex h-8 items-center gap-0.5 rounded-full border-2 ${restaurantAccentBorder} bg-black/65 p-0.5 text-white`}>
                  <button
                    data-no-drag="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setCardBackVisible(false);
                    }}
                    className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                      !visibleRecipe ? "" : "text-white/80"
                    }`}
                    style={!visibleRecipe ? { backgroundColor: cardBackAccent, color: cardBackSelectedTextColor, WebkitTextFillColor: cardBackSelectedTextColor } : undefined}
                  >
                    {cardFrontLabel}
                  </button>
                  <button
                    data-no-drag="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setCardBackVisible(true);
                    }}
                    className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                      visibleRecipe ? "" : "text-white/80"
                    }`}
                    style={visibleRecipe ? { backgroundColor: cardBackAccent, color: cardBackSelectedTextColor, WebkitTextFillColor: cardBackSelectedTextColor } : undefined}
                  >
                    {cardBackLabel}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {darkMode && !visibleRecipe ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-[24] h-32 bg-gradient-to-b from-black/50 via-black/22 via-55% to-transparent"
            />
          ) : null}
          <div className={`absolute top-4 left-4 z-30 flex flex-col items-start gap-1.5 ${darkMode ? "max-w-[14.5rem]" : "max-w-[11.5rem]"} ${visibleRestaurantMap ? "hidden" : ""}`}>
            {darkMode ? (
              <div className="flex min-w-0 items-center gap-2 text-white">
                <div className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 ${restaurantAccentBorder} bg-black/35 flex items-center justify-center text-sm font-bold`}>
                  {currentCard.ownerPhotoURL ? (
                    <img
                      src={currentCard.ownerPhotoURL}
                      alt={currentCard.ownerName || "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (currentCard.ownerName?.[0] || "U").toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  {currentCard.owner ? (
                    <Link
                      data-no-drag="true"
                      href={`/profile/${currentCard.owner}`}
                      className="block truncate text-[0.98rem] font-semibold leading-tight underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {currentCard.ownerName || "Unknown"}
                    </Link>
                  ) : (
                    <p
                      className="truncate text-[0.98rem] font-semibold leading-tight"
                    >
                      {currentCard.ownerName || "Unknown"}
                    </p>
                  )}
                  {uploadDateLabel ? (
                  <div
                    className="mt-0.5 text-[0.82rem] font-medium leading-none text-white/75"
                  >
                      {uploadDateLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              {!darkMode && currentCard?.dishMode ? <DishModeBadge dishMode={currentCard.dishMode} className="h-8 w-8 shrink-0 self-center" /> : null}
              {showStoryHistoryCounter ? (
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setStoryHistoryOpen(true);
                  }}
                  className={darkMode
                    ? "no-accent-border inline-flex h-8 items-center gap-1 rounded-full bg-black/70 px-3 text-xs font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-md self-center"
                    : `inline-flex h-8 items-center gap-1 rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 text-xs font-semibold leading-none text-white self-center`
                  }
                  aria-label="Open story push history"
                >
                  <StoryStatIcon size={12} />
                  <span>:</span>
                  <span>{currentStoryPushCount}</span>
                </button>
              ) : null}
            </div>
            {isRestaurantDish(currentCard) && currentRestaurantPlaceId && currentRestaurantLabel ? (
              <button
                type="button"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  router.push(`/map?placeId=${encodeURIComponent(currentRestaurantPlaceId)}`);
                }}
                className={darkMode
                  ? "restaurant-accent-border max-w-full truncate rounded-full border-2 bg-black/70 px-3 py-1 text-[11px] font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-md"
                  : `max-w-full truncate rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 py-1 text-[11px] font-semibold leading-none text-white`
                }
                style={{ border: "2px solid #E64646", boxShadow: "inset 0 0 0 2px #E64646, 0 8px 22px rgba(0,0,0,0.28)" }}
                aria-label={`Open ${currentRestaurantLabel} on map`}
              >
                {currentRestaurantLabel}
              </button>
            ) : null}
          </div>
          {!visibleRestaurantMap && tertiaryActionLabel && !hasBottomActionRow ? (
            <button
              type="button"
              data-no-drag="true"
              onClick={handleTertiaryActionPress}
              className={`absolute z-30 ${tertiaryActionClassName || "add-action-btn w-14 h-14"}`}
              style={{ bottom: actionBottom, right: actionLabel ? 168 : 96 }}
              aria-label="Additional action"
            >
              {tertiaryActionLabel === "list-plus" ? <ListPlus size={22} strokeWidth={2.1} /> : tertiaryActionLabel}
            </button>
          ) : null}
          {!visibleRestaurantMap ? (
            <button
              type="button"
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (typeof onSavesPress === "function") onSavesPress(currentCard);
              }}
              className={darkMode
                ? `no-accent-border absolute top-4 right-4 z-30 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-md`
                : `absolute top-4 right-4 z-30 inline-flex h-8 items-center gap-1.5 rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 text-xs font-semibold leading-none text-white`
              }
            >
              <Users size={13} strokeWidth={2.25} />
              <span>{Math.max(0, Number(currentCard.saves || 0))}</span>
            </button>
          ) : null}
          {((darkMode && hasAnyRecipeText) || hasRestaurantMapView) && !currentCardRecipeOnly ? (
            <div
              data-no-drag="true"
              className={`absolute left-5 z-40`}
              style={{ bottom: viewToggleBottom }}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerMoveCapture={(e) => e.stopPropagation()}
              onPointerUpCapture={(e) => e.stopPropagation()}
            >
              <div className={`no-accent-border inline-flex h-8 items-center gap-0.5 rounded-full p-0.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)] ${
                visibleRestaurantMap ? "bg-black/95" : "bg-black/82 backdrop-blur-md"
              }`}>
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCardBackVisible(false);
                  }}
                  className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                    !visibleRecipe ? "" : "text-white/95"
                  }`}
                  style={!visibleRecipe ? { backgroundColor: cardBackAccent, color: cardBackSelectedTextColor, WebkitTextFillColor: cardBackSelectedTextColor } : undefined}
                >
                  {cardFrontLabel}
                </button>
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCardBackVisible(true);
                  }}
                  className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                    visibleRecipe ? "" : "text-white/95"
                  }`}
                  style={visibleRecipe ? { backgroundColor: cardBackAccent, color: cardBackSelectedTextColor, WebkitTextFillColor: cardBackSelectedTextColor } : undefined}
                >
                  {cardBackLabel}
                </button>
              </div>
            </div>
          ) : null}
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: visibleRecipe ? 180 : 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div
              className={`absolute inset-0 ${visibleRecipe ? "pointer-events-none" : "pointer-events-auto"}`}
              style={{ backfaceVisibility: "hidden" }}
            >
              {!visibleRecipe && hasCardBackView && !currentCardRecipeOnly ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10"
                  onPointerDown={(e) => {
                    cardBackTapRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    const start = cardBackTapRef.current;
                    cardBackTapRef.current = null;
                    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;
                    if (moved > 10) return;
                    e.stopPropagation();
                    e.preventDefault();
                    setCardBackVisible(true);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCardBackVisible(true);
                  }}
                  style={{ touchAction: "manipulation" }}
                  aria-label={hasRestaurantMapView ? "Open restaurant map view" : "Open recipe view"}
                />
              ) : null}
              {renderImage(currentCard, {
                active: !visibleRecipe,
                onImageReady: () => setCurrentMediaReadyKey(currentCard._key),
                onVideoRef: (node) => {
                  currentVideoRef.current = node;
                },
              })}
              {!visibleRecipe && isDishVideo(currentCard) ? (
                <div
                  data-no-drag="true"
                  className="absolute inset-0 z-[11]"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  aria-hidden="true"
                />
              ) : null}
              {!visibleRecipe ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[15]"
                  style={{
                    height: "42%",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.58) 42%, rgba(0,0,0,0.32) 72%, rgba(0,0,0,0) 100%)",
                  }}
                />
              ) : null}
              {!visibleRecipe ? (
                <div className={`absolute left-5 right-5 text-white z-20`} style={{ bottom: textBottom }}>
                  {!darkMode ? (
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-7 h-7 rounded-full border-2 ${restaurantAccentBorder} bg-white/20 overflow-hidden flex items-center justify-center text-xs font-bold`}>
                        {currentCard.ownerPhotoURL ? (
                          <img
                            src={currentCard.ownerPhotoURL}
                            alt={currentCard.ownerName || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (currentCard.ownerName?.[0] || "U").toUpperCase()
                        )}
                      </div>
                      {currentCard.owner ? (
                        <Link
                          data-no-drag="true"
                          href={`/profile/${currentCard.owner}`}
                          className="text-lg font-semibold leading-none underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {currentCard.ownerName || "Unknown"}
                        </Link>
                      ) : (
                        <p className="text-lg font-semibold leading-none">
                          {currentCard.ownerName || "Unknown"}
                        </p>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-no-drag="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      router.push(`/dishes?q=${encodeURIComponent(currentCard.name || "")}`);
                    }}
                    className="text-left text-2xl font-bold hover:underline"
                  >
                    {currentCard.name}
                  </button>
                    {currentCard.description || normalizedDishLink ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
                    {currentCard.description ? (
                      <p
                        ref={descriptionRef}
                        data-no-drag={descriptionTruncated ? "true" : undefined}
                        onClick={(e) => {
                          if (!descriptionTruncated) return;
                          e.stopPropagation();
                          e.preventDefault();
                          setDescriptionModalOpen(true);
                        }}
                        onPointerDown={(e) => {
                          if (descriptionTruncated) e.stopPropagation();
                        }}
                        className={`min-w-0 flex-1 line-clamp-2 ${descriptionTruncated ? "cursor-pointer" : ""}`}
                        title={descriptionTruncated ? currentCard.description : undefined}
                      >
                        {currentCard.description}
                      </p>
                    ) : null}
                    {normalizedDishLink ? (
                      <a
                        href={normalizedDishLink}
                        target="_blank"
                        rel="noreferrer"
                        data-no-drag="true"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        className={darkMode
                          ? "no-accent-border inline-flex shrink-0 items-center gap-1 rounded-full bg-black/68 px-2.5 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md"
                          : `inline-flex shrink-0 items-center gap-1 rounded-full border-2 ${restaurantAccentBorder} bg-black/18 px-2.5 py-1 text-[11px] font-semibold text-white/92 backdrop-blur-[6px]`
                        }
                      >
                        <span>Link</span>
                        <CornerUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </a>
                    ) : null}
                  </div>
                  ) : null}
                  {currentCard.taggedUserName ? (
                    currentCard.taggedUserId ? (
                      <Link
                        data-no-drag="true"
                        href={currentUser?.uid && currentCard.taggedUserId === currentUser.uid ? "/profile" : `/profile/${currentCard.taggedUserId}`}
                        className={darkMode
                          ? "no-accent-border mt-1 inline-flex max-w-full items-center rounded-full bg-black/68 px-3 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md underline-offset-2 hover:underline"
                          : `mt-1 inline-flex max-w-full items-center rounded-full border-2 ${restaurantAccentBorder} bg-black/18 px-3 py-1 text-[11px] font-semibold text-white/92 backdrop-blur-[6px] underline-offset-2 hover:underline`
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{String(currentCard.taggedUserName).replace(/^@+/, "")}
                      </Link>
                    ) : (
                      <div
                        className={darkMode
                          ? "no-accent-border mt-1 inline-flex max-w-full items-center rounded-full bg-black/68 px-3 py-1 text-[11px] font-semibold text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md"
                          : `mt-1 inline-flex max-w-full items-center rounded-full border-2 ${restaurantAccentBorder} bg-black/18 px-3 py-1 text-[11px] font-semibold text-white/92 backdrop-blur-[6px]`
                        }
                      >
                        @{String(currentCard.taggedUserName).replace(/^@+/, "")}
                      </div>
                    )
                  ) : null}
                  {currentCard?.dishMode === "restaurant" ? (
                    <div className="mt-1 flex flex-col items-start gap-1">
                      <RatingStars value={currentCard.rating} size="text-[1.05rem]" readOnly />
                      {currentDishPriceLabel ? (
                        <span
                          className={darkMode
                            ? "no-accent-border inline-flex rounded-full bg-black/68 px-2.5 py-1 text-[11px] font-black text-white/92 shadow-[0_8px_22px_rgba(0,0,0,0.22)] backdrop-blur-md"
                            : `inline-flex rounded-full border-2 ${restaurantAccentBorder} bg-black/18 px-2.5 py-1 text-[11px] font-black text-white/92 backdrop-blur-[6px]`
                          }
                        >
                          {currentDishPriceLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div
              className={`absolute inset-0 overflow-hidden ${
                darkMode ? "bg-[#101010] text-white" : "bg-white text-black"
              } ${hasRestaurantMapView ? "p-0" : "p-6 pt-16"} ${visibleRecipe ? "pointer-events-auto" : "pointer-events-none"}`}
              style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
            >
              {!hasRestaurantMapView ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!currentCardRecipeOnly) setCardBackVisible(false);
                  }}
                  aria-label="Close recipe view"
                />
              ) : null}
              {hasRestaurantMapView ? (
                <div className="absolute inset-0 bg-black shadow-none">
                  <RestaurantMapView
                    groups={currentRestaurantMapGroups}
                    initialSelectedPlaceId={currentRestaurantPlaceId}
                    showSearch={false}
                    embedded
                    onMapClick={() => {
                      if (!currentCardRecipeOnly) setCardBackVisible(false);
                    }}
                  />
                </div>
              ) : (
              <div
                className="pointer-events-none absolute left-6 right-6 top-16 z-20 min-h-0 flex flex-col"
                style={{ bottom: `${recipeContentBottom}px` }}
              >
                <div className="mb-5 shrink-0">
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                    Recipe
                  </div>
                  <h2 className="mt-2 text-[2rem] leading-none font-bold tracking-tight">{currentCard.name}</h2>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  {!hasAnyRecipeText ? (
                    <div className={`flex min-h-0 flex-1 items-center justify-center rounded-[1.6rem] border px-6 py-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.04)] ${
                      darkMode ? "border-white/10 bg-[#1A1A1A]" : "border-black/8 bg-[linear-gradient(180deg,#FFFDFC_0%,#F7F2E8_100%)]"
                    }`}>
                      <div className={`text-[1.65rem] font-bold tracking-tight ${darkMode ? "text-white/42" : "text-black/42"}`}>
                        No recipe provided
                      </div>
                    </div>
                  ) : null}
                  {hasIngredientsText ? (
                  <div
                    ref={ingredientsPanelRef}
                    data-no-drag="true"
                    className={`min-h-0 flex-1 rounded-[1.4rem] border-2 ${restaurantAccentBorder} px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)] overflow-hidden relative ${
                      darkMode ? "bg-[#1A1A1A] text-white" : "bg-white"
                    }`}
                  >
                    <div className="mb-1 pr-10">
                      <h3 className={`text-[13px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Ingredients</h3>
                      {recipePanelOverflow.ingredients ? (
                        <button
                          type="button"
                          data-no-drag="true"
                          data-expand-panel="true"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            scrollPanelActiveRef.current = true;
                            setScrollPanelActive(true);
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openRecipePanelModal("ingredients");
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openRecipePanelModal("ingredients");
                          }}
                          className={`pointer-events-auto absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${restaurantAccentBorder} ${
                            darkMode ? "bg-[#242424] text-white/70" : "bg-[#F7F5EF] text-black/65"
                          }`}
                          style={{ touchAction: "manipulation" }}
                          aria-label="Open ingredients full screen"
                        >
                          <Maximize2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className={`text-sm leading-6 whitespace-pre-wrap ${darkMode ? "text-white/78" : "text-black/80"}`}>
                      {currentCard.recipeIngredients}
                    </p>
                  </div>
                  ) : null}
                  {hasMethodText ? (
                  <div
                    ref={methodPanelRef}
                    data-no-drag="true"
                    className={`min-h-0 flex-1 rounded-[1.4rem] border-2 ${restaurantAccentBorder} px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)] overflow-hidden relative ${
                      darkMode ? "bg-[#1A1A1A] text-white" : "bg-white"
                    }`}
                  >
                    <div className="mb-1 pr-10">
                      <h3 className={`text-[13px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/45" : "text-black/45"}`}>Method</h3>
                      {recipePanelOverflow.method ? (
                        <button
                          type="button"
                          data-no-drag="true"
                          data-expand-panel="true"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            scrollPanelActiveRef.current = true;
                            setScrollPanelActive(true);
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openRecipePanelModal("method");
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openRecipePanelModal("method");
                          }}
                          className={`pointer-events-auto absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${restaurantAccentBorder} ${
                            darkMode ? "bg-[#242424] text-white/70" : "bg-[#F7F5EF] text-black/65"
                          }`}
                          style={{ touchAction: "manipulation" }}
                          aria-label="Open method full screen"
                        >
                          <Maximize2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className={`text-sm leading-6 whitespace-pre-wrap ${darkMode ? "text-white/78" : "text-black/80"}`}>
                      {currentCard.recipeMethod}
                    </p>
                  </div>
                  ) : null}
                  <button
                    type="button"
                    data-no-drag="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openComments("recipe");
                    }}
                    className={`pointer-events-auto flex w-full shrink-0 items-center gap-3 rounded-[1.25rem] border-2 ${restaurantAccentBorder} px-3 py-3 text-left ${
                      darkMode ? "bg-[#181818] text-white" : "bg-white text-black"
                    }`}
                  >
                    {recipePreviewComment ? (
                      <>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-bold ${
                          darkMode ? "bg-white/12 text-white/70" : "bg-black/10 text-black/70"
                        }`}>
                          {recipePreviewComment.userPhotoURL ? (
                            <img
                              src={recipePreviewComment.userPhotoURL}
                              alt={recipePreviewComment.userName || "User"}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            recipePreviewComment.userName?.[0] || "U"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-[13px] leading-5 ${darkMode ? "text-white/82" : "text-black/78"}`}>
                            <span className={`font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                              {recipePreviewComment.userName || "User"}
                            </span>{" "}
                            {recipePreviewComment.text}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={`min-w-0 flex-1 text-[13px] font-semibold ${darkMode ? "text-white/76" : "text-black/70"}`}>
                        {t("Comment on the recipe")}
                      </div>
                    )}
                    {recipeCommentCount > 0 ? (
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                        darkMode ? "bg-white/10 text-white" : "bg-black/6 text-black"
                      }`}>
                        {recipeCommentCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
              )}
            </div>
          </motion.div>

          {!visibleRestaurantMap && actionLabel && !hasBottomActionRow ? (
            <div className={`absolute right-6 z-30 flex items-center gap-1.5`} style={{ bottom: actionBottom }}>
              <button
                type="button"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openComments("dish");
                }}
                className="relative inline-flex h-14 w-10 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]"
                aria-label="Open comments"
              >
                <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none">{dishCommentCount > 0 ? dishCommentCount : ""}</span>
                <MessageCircle size={28} strokeWidth={2.15} />
              </button>
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => {
                  void handleLikePress(e);
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="relative inline-flex h-14 w-10 -translate-x-1 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] disabled:opacity-70"
                aria-label={dishLiked ? "Unlike dish" : "Like dish"}
                disabled={dishLikeSaving}
              >
                <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none">{dishLikeCount > 0 ? dishLikeCount : ""}</span>
                <Heart
                  size={31}
                  strokeWidth={2.2}
                  className={dishLiked ? "" : "text-white"}
                  fill={dishLiked ? (currentCardIsRestaurant ? "#E64646" : "#E4B43F") : "none"}
                  color={dishLiked ? (currentCardIsRestaurant ? "#E64646" : "#E4B43F") : "currentColor"}
                />
              </button>
              <button
                data-no-drag="true"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  handleActionPress(e);
                }}
                className={
                  actionClassName ||
                  "add-action-btn no-accent-border w-14 h-14 text-[36px]"
                }
                aria-label="Action"
                disabled={disabled}
              >
                {actionLabel === "+" ? <Plus size={26} strokeWidth={2.1} /> : actionLabel}
              </button>
            </div>
          ) : null}

          {!visibleRestaurantMap && resolvedSecondaryActionLabel && !hasBottomActionRow && (
            <div className={`absolute left-6 z-30`} style={{ bottom: actionBottom }}>
              <button
                data-no-drag="true"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  handleSecondaryActionPress(e);
                }}
                className={
                  resolvedSecondaryActionClassName ||
                  "no-accent-border px-4 py-2 rounded-full bg-black text-white text-sm font-semibold shadow-lg"
                }
                aria-label="Secondary action"
                disabled={disabled}
              >
                {resolvedSecondaryActionLabel === "Edit" ? (
                  <Pencil size={18} strokeWidth={2.1} />
                ) : resolvedSecondaryActionLabel === "map" ? (
                  <RestaurantMapIcon className="h-[1.45rem] w-[1.45rem] text-white" strokeWidth={2.1} />
                ) : (
                  resolvedSecondaryActionLabel
                )}
              </button>
            </div>
          )}

          {!visibleRestaurantMap && hasBottomActionRow ? (
            <div className={`absolute left-4 right-4 z-30 flex items-center justify-end gap-1.5`} style={{ bottom: actionBottom }}>
              <button
                data-no-drag="true"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  handleSecondaryActionPress(e);
                }}
                className="add-action-btn action-btn-white-ring h-14 w-14 shrink-0"
                aria-label="Secondary action"
                disabled={disabled}
              >
                {resolvedSecondaryActionLabel === "Edit" ? <Pencil size={18} strokeWidth={2.1} /> : resolvedSecondaryActionLabel}
              </button>
              <button
                type="button"
                data-no-drag="true"
                onClick={handleTertiaryActionPress}
                className="add-action-btn action-btn-white-ring h-14 w-14 shrink-0"
                aria-label="Additional action"
              >
                {tertiaryActionLabel === "list-plus" ? <ListPlus size={22} strokeWidth={2.1} /> : tertiaryActionLabel}
              </button>
              <button
                type="button"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openComments("dish");
                }}
                className="relative inline-flex h-14 w-10 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]"
                aria-label="Open comments"
              >
                <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none">{dishCommentCount > 0 ? dishCommentCount : ""}</span>
                <MessageCircle size={28} strokeWidth={2.15} />
              </button>
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => {
                  void handleLikePress(e);
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="relative inline-flex h-14 w-10 -translate-x-1 items-center justify-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] disabled:opacity-70"
                aria-label={dishLiked ? "Unlike dish" : "Like dish"}
                disabled={dishLikeSaving}
              >
                <span className="absolute -top-1 left-1/2 min-h-[14px] -translate-x-1/2 text-[12px] font-bold leading-none">{dishLikeCount > 0 ? dishLikeCount : ""}</span>
                <Heart
                  size={31}
                  strokeWidth={2.2}
                  className={dishLiked ? "" : "text-white"}
                  fill={dishLiked ? (currentCardIsRestaurant ? "#E64646" : "#E4B43F") : "none"}
                  color={dishLiked ? (currentCardIsRestaurant ? "#E64646" : "#E4B43F") : "currentColor"}
                />
              </button>
              <button
                data-no-drag="true"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  handleActionPress(e);
                }}
                className={`add-action-btn action-btn-white-ring h-14 w-14 shrink-0 ${String(actionClassName || "").includes("text-[#2BD36B]") ? "text-[#2BD36B]" : "text-[36px]"}`}
                aria-label="Action"
                disabled={disabled}
              >
                {actionLabel === "+" ? <Plus size={26} strokeWidth={2.1} /> : actionLabel}
              </button>
            </div>
          ) : null}

        </motion.div>
      </div>

      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        title={commentsScope === "recipe" ? "Recipe comments" : "Comments"}
        comments={comments}
        loading={commentsLoading}
        onDelete={handleDeleteComment}
        newComment={newComment}
        setNewComment={setNewComment}
        disabled={false}
        onSubmit={submitComment}
        currentUser={currentUser}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
      {showStoryHistoryCounter ? (
        <StoryHistoryModal
          open={storyHistoryOpen}
          onClose={() => setStoryHistoryOpen(false)}
          dishName={currentCard?.name || "Dish"}
          history={currentStoryPushHistory}
        />
      ) : null}
      <AnimatePresence>
        {descriptionModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[141] flex items-center justify-center bg-black/34 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDescriptionModalOpen(false)}
          >
            <motion.div
              className={`w-full max-w-sm rounded-[1.45rem] border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] ${
                darkMode ? "border-white/12 bg-[#111] text-white" : "border-black/10 bg-white text-black"
              }`}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-lg font-black leading-tight">{currentCard?.name || "Dish"}</div>
                <button
                  type="button"
                  onClick={() => setDescriptionModalOpen(false)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    darkMode ? "bg-white/8 text-white" : "bg-black/5 text-black"
                  }`}
                  aria-label="Close description"
                >
                  <X size={16} />
                </button>
              </div>
              <p className={`max-h-[48vh] overflow-y-auto whitespace-pre-wrap text-sm font-semibold leading-6 ${darkMode ? "text-white/76" : "text-black/72"}`}>
                {currentCard?.description || ""}
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {noRecipeNoticeOpen ? (
          <motion.div
            className="fixed inset-0 z-[141] flex items-center justify-center bg-black/22 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNoRecipeNoticeOpen(false)}
          >
            <motion.div
              className="w-full max-w-xs rounded-[1.6rem] border border-black/10 bg-white px-5 pb-5 pt-4 text-center shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setNoRecipeNoticeOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black/60"
                  aria-label="Close message"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="text-[1.1rem] font-semibold text-black">This dish has no recipe.</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {recipePanelModal ? (
          <motion.div
            className="fixed inset-0 z-[140] bg-black/28 backdrop-blur-[3px] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeRecipePanelModal}
          >
            <motion.div
              className={`relative w-full max-w-md max-h-[68vh] overflow-hidden rounded-[30px] border shadow-[0_30px_80px_rgba(0,0,0,0.24)] ${
                darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-[linear-gradient(180deg,#FCFAF4_0%,#F7F2E8_100%)] text-black"
              }`}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="flex max-h-[68vh] min-h-0 flex-col px-5 pb-5 pt-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                    Recipe
                  </div>
                  <h3 className="mt-1 text-[1.6rem] font-bold leading-none">
                    {recipePanelModal === "ingredients" ? "Ingredients" : "Method"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeRecipePanelModal}
                  className={`w-11 h-11 rounded-[1.1rem] border shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center ${
                    darkMode ? "border-white/12 bg-[#202020] text-white" : "border-black/10 bg-white"
                  }`}
                  aria-label="Close full screen recipe panel"
                >
                  <X size={18} />
                </button>
              </div>
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[1.7rem] border px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                  darkMode ? "border-white/10 bg-[#1A1A1A]" : "border-black/8 bg-white"
                }`}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="mb-4 text-xl font-bold leading-tight">{currentCard?.name}</div>
                <p className={`text-sm leading-7 whitespace-pre-wrap ${darkMode ? "text-white/80" : "text-black/80"}`}>
                  {recipePanelModal === "ingredients"
                    ? currentCard?.recipeIngredients || "No ingredients provided."
                    : currentCard?.recipeMethod || "No method provided."}
                </p>
              </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AppToast message={toast} variant={toastVariant} />
    </div>
  );
});

export default SwipeDeck;
