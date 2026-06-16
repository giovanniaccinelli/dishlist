"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, Plus, Star, Trash2 } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";
import { TAG_DECOR } from "../app/lib/tagDecor";
import { getTagForDishlistId, isTagDishlistId } from "../app/lib/tagDishlists";
import { getDarkTagChipClass, getTagChipClass } from "../app/lib/tags";

const PICKER_ORDER = ["all_dishes", "saved", "uploaded", "to_try"];

function StoryStatIcon({ size = 18 }) {
  return (
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
}

function orderPickerLists(lists = [], pinAllDishesFirst = false) {
  const systemRank = new Map(PICKER_ORDER.map((id, index) => [id, index]));
  return [...lists].sort((a, b) => {
    if (pinAllDishesFirst) {
      if (a.id === "all_dishes") return -1;
      if (b.id === "all_dishes") return 1;
    }
    const aRank = systemRank.has(a.id) ? systemRank.get(a.id) : 50;
    const bRank = systemRank.has(b.id) ? systemRank.get(b.id) : 50;
    return aRank - bRank;
  });
}

function getSortingTagCardClass(dishlist, darkMode = false) {
  const tag = isTagDishlistId(dishlist?.id) ? getTagForDishlistId(dishlist.id) : dishlist?.tag;
  if (!tag) return "";
  const active = Number(dishlist?.count || 0) > 0;
  return darkMode ? getDarkTagChipClass(tag, active) : getTagChipClass(tag, active);
}

function getDishlistDisplayName(dishlist, t = (value) => value) {
  const tag = isTagDishlistId(dishlist?.id) ? getTagForDishlistId(dishlist.id) : dishlist?.tag;
  if (tag) {
    const translated = t(tag);
    return translated ? translated.charAt(0).toUpperCase() + translated.slice(1) : translated;
  }
  return t(dishlist?.name || "");
}

export default function DishlistPickerModal({
  open,
  onClose,
  lists = [],
  dishName = "dish",
  loading = false,
  title = "Choose dishlists",
  eyebrow = "Add To",
  mode = "multiple",
  selectedIds = [],
  lockedIds = [],
  onToggle,
  onSelect,
  onConfirm,
  confirmLabel = "Save",
  variant = "sheet",
  dishPreview = null,
  storyOption = false,
  storySelected = false,
  onToggleStory,
  publicDish = true,
  onTogglePublicDish,
  onDiscard,
}) {
  const { darkMode, t, language } = useLanguage();
  const [sortingSearch, setSortingSearch] = useState("");
  const selectedSet = new Set(selectedIds);
  const lockedSet = new Set(lockedIds);
  const isSwipeCard = variant === "swipe";
  const isSortingCard = variant === "sorting";
  const orderedLists = isSortingCard ? lists : orderPickerLists(lists, isSwipeCard);
  useEffect(() => {
    if (!open) setSortingSearch("");
  }, [open]);
  const displayedLists = useMemo(() => {
    if (!isSortingCard) return orderedLists;
    const query = sortingSearch.trim().toLowerCase();
    if (!query) return orderedLists;
    return orderedLists.filter((dishlist) => getDishlistDisplayName(dishlist, t).toLowerCase().includes(query));
  }, [isSortingCard, orderedLists, sortingSearch, t]);
  const hasUnlockedSelection = selectedIds.some((id) => !lockedSet.has(id));
  const resolvedConfirmLabel = isSortingCard ? (hasUnlockedSelection ? "Aggiungi" : "Salta") : confirmLabel;
  const sortingSearchPlaceholder = t(language === "it" ? "Cerca dishlist" : "Search dishlist");
  const accentPalette = [
    { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" },
    { border: "#D7B443", bg: "#FFF8D9", darkBg: "#332B10", soft: "rgba(215,180,67,0.18)" },
    { border: "#E94B35", bg: "#FFF0EC", darkBg: "#371813", soft: "rgba(233,75,53,0.16)" },
  ];
  const getAccent = (dishlist, index) => {
    if (dishlist.id === "all_dishes") return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
    if (dishlist.id === "saved") return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
    if (dishlist.id === "to_try") return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
    if (dishlist.id === "uploaded") return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
    return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex justify-center p-4 ${isSortingCard ? "items-end" : isSwipeCard ? "items-center" : "items-end"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
          className={`no-accent-border relative flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-[2rem] border px-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${isSortingCard ? "pb-0" : "pb-5"} ${
              isSortingCard ? "h-[min(92dvh,50rem)] max-h-[calc(100dvh-1rem)]" : isSwipeCard ? "h-[82vh]" : "h-[min(82vh,calc(100dvh-2rem))]"
            } ${
              darkMode
                ? `text-white ${isSwipeCard || isSortingCard ? "border-[#2BD36B]/28 bg-[#0D120E]" : "border-white/12 bg-[#101010]"}`
                : isSwipeCard || isSortingCard
                  ? "border-[#2BD36B]/30 bg-[linear-gradient(180deg,#F7FFF8_0%,#F5F4EC_100%)]"
                  : "border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.98)_100%)]"
            }`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`no-accent-border mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full ${darkMode ? "bg-white/14" : "bg-black/12"}`} />
            <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  isSwipeCard || isSortingCard
                    ? darkMode ? "text-[#76E59E]" : "text-[#179B55]"
                    : darkMode ? "text-white/42" : "text-black/40"
                }`}>
                  {eyebrow}
                </p>
                <h3 className={`mt-1 text-[1.4rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                  {title}
                </h3>
                {!isSwipeCard && !isSortingCard ? (
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/62" : "text-black/55"}`}>{dishName}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {isSortingCard && onDiscard ? (
                  <button
                    type="button"
                    onClick={onDiscard}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                      darkMode
                        ? "border-[#F25555]/28 bg-[#2A1111] text-[#FF6A6A]"
                        : "border-[#F25555]/18 bg-[#FFF1F1] text-[#E34C4C]"
                    }`}
                    aria-label={t("Remove saved dish")}
                  >
                    <Trash2 size={17} strokeWidth={2.15} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-full px-3 py-1 text-sm ${darkMode ? "text-white/70" : "text-black/55"}`}
                >
                  {t("Close")}
                </button>
              </div>
            </div>
            {isSortingCard ? (
              <div className="mb-3 shrink-0">
                <input
                  type="text"
                  value={sortingSearch}
                  onChange={(event) => setSortingSearch(event.target.value)}
                  placeholder={sortingSearchPlaceholder}
                  className={`w-full rounded-[1rem] border px-4 py-3 text-[16px] font-medium outline-none ${
                    darkMode ? "border-white/12 bg-[#171717] text-white placeholder:text-white/32" : "border-black/8 bg-white text-black placeholder:text-black/32"
                  }`}
                  style={{ fontSize: 16 }}
                />
              </div>
            ) : null}
            {dishPreview && (isSwipeCard || isSortingCard) ? (
              <div className={`mb-4 shrink-0 overflow-hidden rounded-[1.55rem] border ${
                darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white/85"
              }`}>
                <div className={`relative w-full overflow-hidden ${isSortingCard ? "h-40" : "h-52"}`}>
                  <img
                    src={getDishImageUrl(dishPreview)}
                    alt={dishPreview?.name || dishName}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <div className={`absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/78 via-55% to-transparent px-4 text-white ${isSortingCard ? "min-h-[54%] pb-3 pt-12" : "min-h-[62%] pb-4 pt-16"}`}>
                    {!isSortingCard ? (
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/64">
                        {t("Salvato")}
                      </div>
                    ) : null}
                    <div className={`mt-1 truncate leading-none ${isSortingCard ? "text-[1.34rem] font-bold" : "text-[1.55rem] font-black"}`}>
                      {dishPreview?.name || dishName}
                    </div>
                  </div>
                </div>
              </div>
            ) : dishPreview ? (
              <div className={`mb-4 flex shrink-0 items-center gap-3 rounded-[1.35rem] border p-2.5 ${
                darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white/85"
              }`}>
                <img
                  src={getDishImageUrl(dishPreview, "thumb")}
                  alt={dishPreview?.name || dishName}
                  className="h-16 w-16 rounded-[1rem] object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${darkMode ? "text-white/42" : "text-black/40"}`}>
                    {t("Just swiped")}
                  </div>
                  <div className={`truncate text-base font-bold ${darkMode ? "text-white" : "text-black"}`}>
                    {dishPreview?.name || dishName}
                  </div>
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className={`rounded-[1.4rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-[#F2EFE8] text-black/55"}`}>
                {t("Loading dishlists...")}
              </div>
            ) : displayedLists.length === 0 ? (
              <div className={`rounded-[1.4rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-[#F2EFE8] text-black/55"}`}>
                {isSortingCard && sortingSearch.trim() ? t("No results") : t("No dishlists yet.")}
              </div>
            ) : (
              <>
                <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto ${isSortingCard ? "px-1 pb-24 pt-1" : "pr-1"}`}>
                  {storyOption ? (
                    <button
                      type="button"
                      onClick={onToggleStory}
                      className={`no-accent-border mb-1 flex items-center justify-between rounded-[1.15rem] border px-3.5 py-3 text-left ${
                        darkMode
                          ? storySelected
                            ? "border-[#2BD36B]/70 bg-[#172119] text-white"
                            : "border-white/12 bg-[#181818] text-white"
                          : storySelected
                            ? "border-[#2BD36B]/70 bg-[#F8FFF9]"
                            : "border-black/8 bg-white/90"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/6" : "bg-black/[0.035]"}`}>
                          <StoryStatIcon size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                            {t("Lo sto mangiando")}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`no-accent-border ml-4 flex h-7 w-7 items-center justify-center rounded-full border ${
                          darkMode
                            ? storySelected
                              ? "border-[#2BD36B] bg-[#2BD36B] text-black"
                              : "border-white/16 bg-[#242424] text-white/65"
                            : storySelected
                              ? "border-[#2BD36B] bg-[#2BD36B] text-black"
                              : "border-black/10 bg-[#F7F5EF] text-black/65"
                        }`}
                      >
                        {storySelected ? <Check size={14} /> : <Plus size={14} />}
                      </div>
                    </button>
                  ) : null}
                  {isSortingCard ? (
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      {displayedLists.map((dishlist) => {
                        const selected = selectedSet.has(dishlist.id);
                        const locked = lockedSet.has(dishlist.id);
                        const preview = Array.isArray(dishlist.dishes) ? dishlist.dishes.slice(0, 4) : [];
                        const tag = isTagDishlistId(dishlist.id) ? getTagForDishlistId(dishlist.id) : "";
                        const TagIcon = tag ? TAG_DECOR[tag]?.icon : null;
                        const tagCardClass = TagIcon ? getSortingTagCardClass(dishlist, darkMode) : "";
                        return (
                          <button
                            key={dishlist.id}
                            type="button"
                            onClick={() => {
                              if (locked) return;
                              onToggle?.(dishlist);
                            }}
                            className={`relative rounded-[1.35rem] border p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${
                              selected
                                ? darkMode
                                  ? "border-[#2BD36B] bg-[#102817] ring-2 ring-[#2BD36B]/90 ring-offset-2 ring-offset-[#0D120E]"
                                  : "border-[#1FA463] bg-[#F2FFF6] ring-2 ring-[#1FA463]/85 ring-offset-2 ring-offset-white"
                                : TagIcon
                                  ? `border-2 ${tagCardClass}`
                                : darkMode
                                  ? "border-white/12 bg-[#181818]"
                                  : "border-black/10 bg-white"
                            }`}
                            style={selected ? { boxShadow: "0 0 0 1px rgba(43,211,107,0.95), 0 14px 28px rgba(0,0,0,0.18)" } : undefined}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className={`min-w-0 truncate text-sm font-black ${darkMode ? "text-white" : "text-black"}`}>{getDishlistDisplayName(dishlist, t)}</div>
                            </div>
                            {TagIcon ? (
                              <div className="grid aspect-square place-items-center">
                                <TagIcon className={`h-16 w-16 ${TAG_DECOR[tag]?.iconClass || ""}`} strokeWidth={2.05} />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5">
                                {Array.from({ length: 4 }).map((_, slot) => {
                                  const dish = preview[slot];
                                  return dish ? (
                                    <img
                                      key={`${dishlist.id}-${dish.id || slot}`}
                                      src={getDishImageUrl(dish, "thumb")}
                                      alt={dish.name || ""}
                                      className="aspect-square rounded-[0.75rem] object-cover"
                                      onError={(event) => {
                                        event.currentTarget.src = DEFAULT_DISH_IMAGE;
                                      }}
                                    />
                                  ) : (
                                    <div key={`${dishlist.id}-empty-${slot}`} className={`aspect-square rounded-[0.75rem] ${darkMode ? "bg-white/8" : "bg-black/6"}`} />
                                  );
                                })}
                              </div>
                            )}
                            {selected ? (
                              <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#2BD36B] text-black shadow-[0_8px_18px_rgba(43,211,107,0.32)]">
                                <Check size={15} strokeWidth={2.5} />
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : displayedLists.map((dishlist, index) => {
                    const selected = selectedSet.has(dishlist.id);
                    const locked = lockedSet.has(dishlist.id);
                    const accent = getAccent(dishlist, index);
                    const tag = isTagDishlistId(dishlist.id) ? getTagForDishlistId(dishlist.id) : "";
                    const TagIcon = tag ? TAG_DECOR[tag]?.icon : null;
                    return (
                      <button
                        key={dishlist.id}
                        type="button"
                        onClick={() => {
                          if (mode === "single") {
                            onSelect?.(dishlist);
                            return;
                          }
                          if (locked) return;
                          onToggle?.(dishlist);
                        }}
                        className={`no-accent-border flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.05)] ${
                          darkMode
                            ? selected
                              ? "text-white"
                              : "border-white/12 bg-[#181818] text-white"
                            : selected
                              ? ""
                              : "border-black/8 bg-white/90"
                        }`}
                        style={
                          selected
                            ? { borderColor: accent.border, background: darkMode ? accent.darkBg : accent.bg }
                            : isSwipeCard
                              ? { borderColor: accent.soft }
                              : undefined
                        }
                      >
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                            <span className="inline-flex items-center gap-1.5">
                              {dishlist.id === "saved" ? <Star size={14} className="text-[#D9B550] fill-[#F3D88C]" /> : null}
                              {TagIcon ? <TagIcon className={`h-4 w-4 shrink-0 ${TAG_DECOR[tag]?.iconClass || ""}`} strokeWidth={2.1} /> : null}
                              <span>{getDishlistDisplayName(dishlist, t)}</span>
                            </span>
                          </div>
                          {!isSwipeCard ? <div className={`mt-0.5 text-xs ${darkMode ? "text-white/55" : "text-black/48"}`}>
                            {Number(dishlist.count || 0)} {t("dishes")}
                          </div> : null}
                        </div>
                        <div
                          className={`no-accent-border ml-4 flex h-9 w-9 items-center justify-center rounded-full border ${
                            darkMode
                              ? selected
                                ? "text-white"
                                : "border-white/14 bg-[#242424] text-white/70"
                              : selected
                                ? "text-white"
                                : "border-black/10 bg-[#F7F5EF] text-black/65"
                          }`}
                          style={selected ? { borderColor: accent.border, background: accent.border } : undefined}
                        >
                          {locked ? <Lock size={15} /> : selected ? <Check size={16} /> : <Plus size={16} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {mode === "multiple" ? (
                  <div className={`${isSortingCard ? "absolute bottom-0 left-5 right-5 z-10 flex h-[5.75rem] items-end justify-end gap-3 border-t pb-5 pt-2" : "sticky bottom-0 mt-4 flex shrink-0 items-center justify-between gap-3 border-t pt-4"} ${
                    darkMode ? "border-white/10 bg-[#101010]" : "border-black/8 bg-[#FAF7F0]"
                  }`}>
                    {isSwipeCard || isSortingCard ? (
                      isSortingCard ? null : <div className="h-2 w-2 rounded-full bg-[#2BD36B]" />
                    ) : (
                      onTogglePublicDish ? (
                        <button
                          type="button"
                          onClick={onTogglePublicDish}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                            darkMode
                              ? publicDish
                                ? "border-white/14 bg-white/6 text-white"
                                : "border-white/10 bg-[#121212] text-white/66"
                              : publicDish
                                ? "border-black/10 bg-white/70 text-black/68"
                                : "border-black/8 bg-[#F2EFE8] text-black/48"
                          }`}
                          aria-pressed={publicDish}
                        >
                          <span
                            className={`flex h-5 w-9 items-center rounded-full border p-[2px] transition ${
                              darkMode
                                ? publicDish
                                  ? "border-white/18 bg-white/7 justify-end"
                                  : "border-white/10 bg-white/6 justify-start"
                                : publicDish
                                  ? "border-black/10 bg-black/[0.05] justify-end"
                                  : "border-black/8 bg-black/[0.04] justify-start"
                            }`}
                          >
                            <span className={`h-4 w-4 rounded-full ${darkMode ? "bg-white" : "bg-black/80"}`} />
                          </span>
                          <span>{t("Public dish")}</span>
                        </button>
                      ) : (
                        <div className={`text-xs ${darkMode ? "text-white/55" : "text-black/50"}`}>
                          {selectedIds.length} {t(selectedIds.length === 1 ? "selected singular" : "selected plural")}
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={onConfirm}
                      className="dish-modal-primary-btn min-h-[3.15rem] rounded-full px-6 text-sm font-bold transition disabled:opacity-60"
                    >
                      {t(resolvedConfirmLabel)}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
