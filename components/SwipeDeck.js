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
import { Plus, CornerUpRight, ListPlus, Pencil, Maximize2, X } from "lucide-react";
import CommentsModal from "./CommentsModal";
import StoryHistoryModal from "./StoryHistoryModal";
import AppToast from "./AppToast";
import { addCommentToDish, deleteCommentThread, getCommentsForDish } from "../app/lib/firebaseHelpers";
import { DEFAULT_DISH_IMAGE, getDishImageUrl, isDishVideo } from "../app/lib/dishImage";
import { DishModeBadge } from "./DishModeControls";

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
  onSharePress,
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
  rightSwipeToast = "Added to All dishes",
  rightSwipeErrorToast = "Action failed",
  trackSwipes = true,
  onAuthRequired,
  preserveContinuity = true,
  initialIndex = 0,
  advanceOnAnySwipe = false,
  disabled = false,
  currentUser = null,
  onCardViewed,
  fitHeight = false,
  storyPushStatsByDish = {},
  showStoryHistoryCounter = false,
}, ref) {
  const router = useRouter();
  const SWIPE_EJECT_THRESHOLD = 70;

  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [deckEmpty, setDeckEmpty] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [showRecipe, setShowRecipe] = useState(false);
  const [isEjecting, setIsEjecting] = useState(false);
  const [scrollPanelActive, setScrollPanelActive] = useState(false);
  const [recipePanelModal, setRecipePanelModal] = useState(null);
  const [noRecipeNoticeOpen, setNoRecipeNoticeOpen] = useState(false);
  const [recipePanelOverflow, setRecipePanelOverflow] = useState({
    ingredients: false,
    method: false,
  });
  const [tagsHeight, setTagsHeight] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [previewComment, setPreviewComment] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [storyHistoryOpen, setStoryHistoryOpen] = useState(false);
  const tagsRef = useRef(null);
  const ingredientsPanelRef = useRef(null);
  const methodPanelRef = useRef(null);
  const scrollPanelActiveRef = useRef(false);
  const currentVideoRef = useRef(null);
  const nextVideoRef = useRef(null);
  const mediaUnlockedRef = useRef(false);
  const mediaUnlockInFlightRef = useRef(false);
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-240, 0, 240], [-14, 0, 14]);
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
    const formatted = dishes.map((d, i) => ({
      ...d,
      _key: d.id || `${d.owner || "local"}-${d.name || "dish"}-${i}`,
    }));

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

  useEffect(() => {
    setShowRecipe(false);
    setRecipePanelModal(null);
    setNoRecipeNoticeOpen(false);
    setScrollPanelActive(false);
    scrollPanelActiveRef.current = false;
  }, [currentCard?._key]);

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
    onCardViewed?.(currentCard);
    setComments([]);
    setPreviewComment(null);
    setNewComment("");
    setReplyTo(null);
    (async () => {
      const top = await getCommentsForDish(currentCard.id, 1);
      setPreviewComment(top?.[0] || null);
    })();
  }, [currentCard?.id, onCardViewed]);

  useEffect(() => {
    if (!tagsRef.current) return;
    const el = tagsRef.current;
    const updateHeight = () => {
      setTagsHeight(el.offsetHeight || 0);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentCard?._key]);

  const actionBottom = 24;
  const tagsBottom = actionBottom + 64;
  const commentBottom = tagsBottom + tagsHeight + 8;
  const textBottom = Math.max(120, commentBottom + 40);
  const recipeContentBottom = Math.max(tagsBottom + tagsHeight + 28, 132);
  const nextCard = deck[currentIndex + 1] || null;
  const currentCardBorderClass = isRestaurantDish(currentCard) ? "border-[#E64646]" : "border-[#E4B43F]";
  const nextCardBorderClass = isRestaurantDish(nextCard) ? "border-[#E64646]" : "border-[#E4B43F]";
  const currentStoryStats = currentCard?.id ? storyPushStatsByDish?.[currentCard.id] || null : null;
  const currentStoryPushCount = Number(currentStoryStats?.count || 0);
  const currentStoryPushHistory = Array.isArray(currentStoryStats?.history) ? currentStoryStats.history : [];
  const currentRestaurantLabel = getSafeRestaurantLabel(currentCard);
  const currentRestaurantPlaceId = getSafeRestaurantPlaceId(currentCard);
  const restaurantAccentBorder = isRestaurantDish(currentCard) ? "restaurant-accent-border" : "default-accent-border";
  const hasIngredientsText = Boolean(String(currentCard?.recipeIngredients || "").trim());
  const hasMethodText = Boolean(String(currentCard?.recipeMethod || "").trim());
  const hasAnyRecipeText = hasIngredientsText || hasMethodText;
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
    Boolean(actionLabel) &&
    typeof onSharePress === "function";
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

  const loadComments = async () => {
    if (!currentCard?.id) return;
    setCommentsLoading(true);
    try {
      const items = await getCommentsForDish(currentCard.id, 30);
      setComments(items);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    await loadComments();
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
    });
    if (!ok) return;
    setNewComment("");
    setReplyTo(null);
    await loadComments();
    const top = await getCommentsForDish(currentCard.id, 1);
    setPreviewComment(top?.[0] || null);
  };

  const handleDeleteComment = async (comment) => {
    if (!currentCard?.id || !comment?.id) return;
    if (comment.userId !== currentUser?.uid) return;
    const ok = await deleteCommentThread(currentCard.id, comment.id);
    if (!ok) return;
    await loadComments();
    const top = await getCommentsForDish(currentCard.id, 1);
    setPreviewComment(top?.[0] || null);
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
    dragX.set(0);
  };

  const goToNextCardFromArrow = async () => {
    if (disabled || isEjecting || !currentCard) return;
    setIsEjecting(true);
    const targetX = -(typeof window !== "undefined" ? window.innerWidth * 1.2 : 700);
    try {
      await animate(dragX, targetX, {
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.6,
      }).finished;
    } catch {}
    if (trackSwipes && typeof onSwiped === "function") onSwiped(currentCard.id);
    advanceCard();
    setIsEjecting(false);
    dragX.set(0);
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
    dragX.set(0);
    runAction(card);
  };

  const handleSecondaryActionPress = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isEjecting) return;
    if (typeof onSecondaryAction !== "function") return;
    const card = currentCard;
    if (dismissOnSecondaryAction) advanceCard();
    dragX.set(0);
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
    dragX.set(0);
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
    dragX.set(0);
  };

  const handleSwipeEnd = async (info, dish) => {
    if (disabled || isEjecting) return;
    if (Math.abs(info.offset.x) >= SWIPE_EJECT_THRESHOLD) {
      const direction = info.offset.x > 0 ? 1 : -1;
      setIsEjecting(true);
      if (!advanceOnAnySwipe && swipeAddEnabled && actionOnRightSwipe && info.offset.x > 0) {
        runAction(dish);
      }
      if (!advanceOnAnySwipe && info.offset.x > 0 && typeof onRightSwipe === "function") {
        Promise.resolve(onRightSwipe(dish))
          .then((result) => {
            if (result === false) {
              setToastVariant("error");
              setToast(rightSwipeErrorToast);
              setTimeout(() => setToast(""), 1200);
              return;
            }
            setToastVariant("success");
            setToast(rightSwipeToast);
            setTimeout(() => setToast(""), 1200);
          })
          .catch((err) => {
            console.error("Right swipe action failed:", err);
            setToastVariant("error");
            setToast(rightSwipeErrorToast);
            setTimeout(() => setToast(""), 1200);
          });
      }
      if (trackSwipes && typeof onSwiped === "function") onSwiped(dish.id);

      const targetX =
        direction * (typeof window !== "undefined" ? window.innerWidth * 1.2 : 700);
      try {
        await animate(dragX, targetX, {
          type: "spring",
          stiffness: 280,
          damping: 28,
          mass: 0.6,
        }).finished;
      } catch {}
      advanceCard();
      setIsEjecting(false);
      dragX.set(0);
      return;
    }
    animate(dragX, 0, {
      type: "spring",
      stiffness: 420,
      damping: 34,
      mass: 0.55,
    });
  };

  const renderImage = (
    dish,
    { active = false, preview = false, onVideoRef = null } = {}
  ) => {
    const imageSrc = getDishImageUrl(dish);
    if (isDishVideo(dish)) {
      return (
        <DeckAutoplayVideo
          src={imageSrc}
          onVideoRef={onVideoRef}
          className="pointer-events-none w-full h-full object-cover"
        />
      );
    }
    return (
      <img
        src={imageSrc}
        alt={dish.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = DEFAULT_DISH_IMAGE;
        }}
      />
    );
  };

  const getTags = (dish) => {
    if (!Array.isArray(dish?.tags)) return [];
    return dish.tags
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  };

  const handleTagPress = (tag, event) => {
    event.stopPropagation();
    event.preventDefault();
    router.push(`/explore?category=${encodeURIComponent(`tag-${tag}`)}`);
  };

  const TAG_COLORS = [
    "bg-[#DFF3FF] text-[#123B52]",
    "bg-[#E9FBD8] text-[#1D4F1A]",
    "bg-[#FFF2D9] text-[#6A3E00]",
    "bg-[#FFE3EC] text-[#6A1A36]",
    "bg-[#EDE8FF] text-[#33205D]",
    "bg-[#E5F7F4] text-[#0F4D45]",
  ];

  if (deckEmpty || !currentCard) {
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

  return (
    <div className={`flex flex-col items-center justify-center ${fitHeight ? "h-full min-h-0" : "min-h-[72vh]"}`}>
      <div
        className={`relative w-full max-w-md ${fitHeight ? "h-full min-h-0" : "h-[74vh]"}`}
        onPointerDownCapture={handleDeckMediaUnlock}
        onTouchStartCapture={handleDeckMediaUnlock}
        onClickCapture={handleDeckMediaUnlock}
      >
        {nextCard ? (
          <motion.div
            className={`dish-card-shell pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] ${nextCardBorderClass === "border-[#E64646]" ? "dish-card-shell--restaurant" : "dish-card-shell--default"} ${fitHeight ? "h-full" : "h-[74vh]"}`}
            style={{ scale: nextCardScale, borderColor: nextCardBorderClass === "border-[#E64646]" ? "#E64646" : "#E4B43F" }}
          >
            {renderImage(nextCard, {
              preview: true,
              onVideoRef: (node) => {
                nextVideoRef.current = node;
              },
            })}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </motion.div>
        ) : null}
        <motion.div
          key={currentCard._key}
          drag={disabled || isEjecting || scrollPanelActive ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={advanceOnAnySwipe ? 0.22 : 0.9}
          style={{
            x: dragX,
            rotate: cardRotate,
            touchAction: "none",
            borderColor: currentCardBorderClass === "border-[#E64646]" ? "#E64646" : "#E4B43F",
          }}
          onDragEnd={(e, info) => handleSwipeEnd(info, currentCard)}
          className={`dish-card-shell pressable-card relative overflow-hidden w-full cursor-grab rounded-[28px] ${currentCardBorderClass === "border-[#E64646]" ? "dish-card-shell--restaurant" : "dish-card-shell--default"} bg-white ${fitHeight ? "h-full" : "h-[74vh]"}`}
        >
          {swipeAddEnabled && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#2BD36B]/25"
              style={{ opacity: rightCueOpacity }}
            >
              <motion.div
                style={{ scale: rightCueScale }}
                className="flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-white/80 bg-[#2BD36B]/35 px-5 text-center backdrop-blur-sm"
              >
                {typeof onRightSwipe === "function" ? (
                  <>
                    <div className="mb-2 text-[1.15rem] font-black uppercase tracking-[0.1em] text-white">
                      All dishes
                    </div>
                    <Plus size={92} strokeWidth={2.2} className="text-white" />
                  </>
                ) : (
                  <Plus size={110} strokeWidth={2.1} className="text-white" />
                )}
              </motion.div>
            </motion.div>
          )}
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
          <div
            data-no-drag="true"
            className="absolute top-4 left-1/2 z-30 -translate-x-1/2"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerMoveCapture={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
          >
            {hasAnyRecipeText ? (
              <div className={`no-accent-border flex h-8 items-center gap-0.5 rounded-full border-2 ${restaurantAccentBorder} bg-black/65 p-0.5 text-white`}>
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowRecipe(false);
                  }}
                  className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                    !showRecipe ? "bg-white text-black" : "text-white/80"
                  }`}
                >
                  dish
                </button>
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowRecipe(true);
                  }}
                  className={`no-accent-border inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-none ${
                    showRecipe ? "bg-white text-black" : "text-white/80"
                  }`}
                >
                  recipe
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setNoRecipeNoticeOpen(true);
                }}
                className={`inline-flex h-8 items-center rounded-full border-2 ${restaurantAccentBorder} bg-white px-3 text-[13px] font-semibold leading-none text-black shadow-[0_10px_24px_rgba(0,0,0,0.12)]`}
              >
                dish
              </button>
            )}
          </div>
          <div className="absolute top-4 left-4 z-30 flex max-w-[11.5rem] flex-col items-start gap-1.5">
            <div className="flex items-center gap-1.5">
              {currentCard?.dishMode ? <DishModeBadge dishMode={currentCard.dishMode} className="h-8 w-8 shrink-0 self-center" /> : null}
              {showStoryHistoryCounter ? (
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setStoryHistoryOpen(true);
                  }}
                  className={`inline-flex h-8 items-center gap-1 rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 text-xs font-semibold leading-none text-white self-center`}
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
                className={`max-w-full truncate rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 py-1 text-[11px] font-semibold leading-none text-white`}
                aria-label={`Open ${currentRestaurantLabel} on map`}
              >
                {currentRestaurantLabel}
              </button>
            ) : null}
          </div>
          {typeof onSharePress === "function" && !hasBottomActionRow && (
            <button
              type="button"
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSharePress(currentCard);
              }}
              className="add-action-btn absolute z-30 w-14 h-14"
              style={{ bottom: actionBottom, right: actionLabel ? 96 : 24 }}
              aria-label="Share dish"
            >
              <CornerUpRight size={24} strokeWidth={2.1} />
            </button>
          )}
          {tertiaryActionLabel && !hasBottomActionRow ? (
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
          <button
            type="button"
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (typeof onSavesPress === "function") onSavesPress(currentCard);
            }}
            className={`absolute top-4 right-4 z-30 inline-flex h-8 items-center rounded-full border-2 ${restaurantAccentBorder} bg-black/65 px-3 text-xs font-semibold leading-none text-white`}
          >
            saves: {Number(currentCard.saves || 0)}
          </button>
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: showRecipe ? 180 : 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div
              className={`absolute inset-0 ${showRecipe ? "pointer-events-none" : "pointer-events-auto"}`}
              style={{ backfaceVisibility: "hidden" }}
            >
              {!showRecipe && hasAnyRecipeText ? (
                <button
                  type="button"
                  className="absolute inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRecipe(true);
                  }}
                  aria-label="Open recipe view"
                />
              ) : null}
              {renderImage(currentCard, {
                active: !showRecipe,
                onVideoRef: (node) => {
                  currentVideoRef.current = node;
                },
              })}
              {!showRecipe && isDishVideo(currentCard) ? (
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              {!showRecipe ? (
                <div className="absolute left-5 right-5 text-white z-20" style={{ bottom: textBottom }}>
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
                        <p className="min-w-0 flex-1 line-clamp-2">
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
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 ${restaurantAccentBorder} bg-black/18 px-2.5 py-1 text-[11px] font-semibold text-white/92 backdrop-blur-[6px]`}
                        >
                          <span>Link</span>
                          <CornerUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div
              className={`absolute inset-0 bg-white text-black p-6 pt-16 overflow-hidden ${showRecipe ? "pointer-events-auto" : "pointer-events-none"}`}
              style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
            >
              <button
                type="button"
                className="absolute inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowRecipe(false);
                }}
                aria-label="Close recipe view"
              />
              <div
                className="pointer-events-none absolute left-6 right-6 top-16 z-20 min-h-0 flex flex-col"
                style={{ bottom: `${recipeContentBottom}px` }}
              >
                <div className="mb-5 shrink-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
                    Recipe
                  </div>
                  <h2 className="mt-2 text-[2rem] leading-none font-bold tracking-tight">{currentCard.name}</h2>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  {!hasAnyRecipeText ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[1.6rem] border border-black/8 bg-[linear-gradient(180deg,#FFFDFC_0%,#F7F2E8_100%)] px-6 py-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
                      <div className="text-[1.65rem] font-bold tracking-tight text-black/42">
                        No recipe provided
                      </div>
                    </div>
                  ) : null}
                  {hasIngredientsText ? (
                  <div
                    ref={ingredientsPanelRef}
                    data-no-drag="true"
                    className={`min-h-0 flex-1 rounded-[1.4rem] border-2 ${restaurantAccentBorder} bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)] overflow-hidden relative`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-black/45">Ingredients</h3>
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
                          className={`pointer-events-auto relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${restaurantAccentBorder} bg-[#F7F5EF] text-black/65`}
                          style={{ touchAction: "manipulation" }}
                          aria-label="Open ingredients full screen"
                        >
                          <Maximize2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6 text-black/80 whitespace-pre-wrap">
                      {currentCard.recipeIngredients}
                    </p>
                  </div>
                  ) : null}
                  {hasMethodText ? (
                  <div
                    ref={methodPanelRef}
                    data-no-drag="true"
                    className={`min-h-0 flex-1 rounded-[1.4rem] border-2 ${restaurantAccentBorder} bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)] overflow-hidden relative`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-black/45">Method</h3>
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
                          className={`pointer-events-auto relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${restaurantAccentBorder} bg-[#F7F5EF] text-black/65`}
                          style={{ touchAction: "manipulation" }}
                          aria-label="Open method full screen"
                        >
                          <Maximize2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6 text-black/80 whitespace-pre-wrap">
                      {currentCard.recipeMethod}
                    </p>
                  </div>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>

          {actionLabel && !hasBottomActionRow ? (
            <div className="absolute right-6 z-30" style={{ bottom: actionBottom }}>
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

          {resolvedSecondaryActionLabel && !hasBottomActionRow && (
            <div className="absolute left-4 z-30" style={{ bottom: actionBottom }}>
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
                {resolvedSecondaryActionLabel === "Edit" ? <Pencil size={18} strokeWidth={2.1} /> : resolvedSecondaryActionLabel}
              </button>
            </div>
          )}

          {hasBottomActionRow ? (
            <div className="absolute left-4 right-4 z-30 flex items-center justify-between" style={{ bottom: actionBottom }}>
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
                  onSharePress(currentCard);
                }}
                className="add-action-btn action-btn-white-ring h-14 w-14 shrink-0"
                aria-label="Share dish"
              >
                <CornerUpRight size={24} strokeWidth={2.1} />
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

          <div
            ref={tagsRef}
            className="absolute left-5 right-5 z-30 flex flex-wrap gap-2"
            style={{ bottom: tagsBottom }}
          >
            {getTags(currentCard).map((tag, idx) => (
              <button
                type="button"
                data-no-drag="true"
                key={`${tag}-${idx}`}
                className={`px-2.5 py-1 rounded-full border-2 ${restaurantAccentBorder} text-[11px] font-semibold ${
                  TAG_COLORS[idx % TAG_COLORS.length]
                }`}
                onClick={(e) => handleTagPress(tag, e)}
              >
                {tag}
              </button>
            ))}
          </div>

          {!showRecipe ? (
            <div className="absolute left-5 right-5 z-30" style={{ bottom: commentBottom }}>
              {previewComment ? (
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openComments();
                  }}
                  className="text-xs text-white/90 underline-offset-2 hover:underline"
                >
                  {previewComment.userName || "User"}: {previewComment.text}
                </button>
              ) : (
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openComments();
                  }}
                  className="text-xs text-white/70"
                >
                  Be the first to comment
                </button>
              )}
            </div>
          ) : null}
        </motion.div>
      </div>

      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
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
              className="relative w-full max-w-md max-h-[68vh] overflow-hidden rounded-[30px] border border-black/10 bg-[linear-gradient(180deg,#FCFAF4_0%,#F7F2E8_100%)] text-black shadow-[0_30px_80px_rgba(0,0,0,0.24)]"
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40">
                    Recipe
                  </div>
                  <h3 className="mt-1 text-[1.6rem] font-bold leading-none">
                    {recipePanelModal === "ingredients" ? "Ingredients" : "Method"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeRecipePanelModal}
                  className="w-11 h-11 rounded-[1.1rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)] flex items-center justify-center"
                  aria-label="Close full screen recipe panel"
                >
                  <X size={18} />
                </button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[1.7rem] border border-black/8 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="mb-4 text-xl font-bold leading-tight">{currentCard?.name}</div>
                <p className="text-sm leading-7 text-black/80 whitespace-pre-wrap">
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
