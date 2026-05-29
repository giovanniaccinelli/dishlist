"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, Plus, Star } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../app/lib/dishImage";
import { TAG_DECOR } from "../app/lib/tagDecor";
import { getTagForDishlistId, isTagDishlistId } from "../app/lib/tagDishlists";

const PICKER_ORDER = ["saved", "to_try", "uploaded"];

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
    if (a.id === "all_dishes") return 1;
    if (b.id === "all_dishes") return -1;
    const aRank = systemRank.has(a.id) ? systemRank.get(a.id) : 50;
    const bRank = systemRank.has(b.id) ? systemRank.get(b.id) : 50;
    return aRank - bRank;
  });
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
}) {
  const { darkMode, t } = useLanguage();
  const selectedSet = new Set(selectedIds);
  const lockedSet = new Set(lockedIds);
  const isSwipeCard = variant === "swipe";
  const orderedLists = orderPickerLists(lists, isSwipeCard);
  const accentPalette = [
    { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" },
    { border: "#D7B443", bg: "#FFF8D9", darkBg: "#332B10", soft: "rgba(215,180,67,0.18)" },
    { border: "#E94B35", bg: "#FFF0EC", darkBg: "#371813", soft: "rgba(233,75,53,0.16)" },
  ];
  const getAccent = (dishlist, index) => {
    if (dishlist.id === "saved") return { border: "#D7B443", bg: "#FFF8D9", darkBg: "#332B10", soft: "rgba(215,180,67,0.18)" };
    if (dishlist.id === "to_try") return { border: "#2BD36B", bg: "#ECFFF1", darkBg: "#12351F", soft: "rgba(43,211,107,0.16)" };
    if (dishlist.id === "uploaded") return { border: "#E94B35", bg: "#FFF0EC", darkBg: "#371813", soft: "rgba(233,75,53,0.16)" };
    return accentPalette[index % accentPalette.length];
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex justify-center p-4 ${isSwipeCard ? "items-center" : "items-end"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
          className={`no-accent-border flex min-h-0 w-full max-w-md flex-col rounded-[2rem] border px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
              isSwipeCard ? "h-[82vh]" : "h-[min(82vh,calc(100dvh-2rem))]"
            } ${
              darkMode
                ? `text-white ${isSwipeCard ? "border-[#2BD36B]/28 bg-[#0D120E]" : "border-white/12 bg-[#101010]"}`
                : isSwipeCard
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
                  isSwipeCard
                    ? darkMode ? "text-[#76E59E]" : "text-[#179B55]"
                    : darkMode ? "text-white/42" : "text-black/40"
                }`}>
                  {eyebrow}
                </p>
                <h3 className={`mt-1 text-[1.4rem] font-semibold leading-tight ${darkMode ? "text-white" : "text-black"}`}>
                  {title}
                </h3>
                {!isSwipeCard ? (
                  <p className={`mt-1 text-sm ${darkMode ? "text-white/62" : "text-black/55"}`}>{dishName}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full px-3 py-1 text-sm ${darkMode ? "text-white/70" : "text-black/55"}`}
              >
                {t("Close")}
              </button>
            </div>
            {dishPreview && isSwipeCard ? (
              <div className={`mb-4 shrink-0 overflow-hidden rounded-[1.55rem] border ${
                darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white/85"
              }`}>
                <div className="relative h-52 w-full overflow-hidden">
                  <img
                    src={getDishImageUrl(dishPreview)}
                    alt={dishPreview?.name || dishName}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex min-h-[62%] flex-col justify-end bg-gradient-to-t from-black via-black/78 via-55% to-transparent px-4 pb-4 pt-16 text-white">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/64">
                      {t("Salvato")}
                    </div>
                    <div className="mt-1 truncate text-[1.55rem] font-black leading-none">
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
            ) : orderedLists.length === 0 ? (
              <div className={`rounded-[1.4rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/60" : "bg-[#F2EFE8] text-black/55"}`}>
                {t("No dishlists yet.")}
              </div>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
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
                  {orderedLists.map((dishlist, index) => {
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
                              <span>{t(dishlist.name)}</span>
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
                  <div className={`sticky bottom-0 mt-4 flex shrink-0 items-center justify-between gap-3 border-t pt-4 ${
                    darkMode ? "border-white/10 bg-[#101010]" : "border-black/8 bg-[#FAF7F0]"
                  }`}>
                    {isSwipeCard ? (
                      <div className="h-2 w-2 rounded-full bg-[#2BD36B]" />
                    ) : (
                      <div className={`text-xs ${darkMode ? "text-white/55" : "text-black/50"}`}>
                        {selectedIds.length} {t(selectedIds.length === 1 ? "selected singular" : "selected plural")}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={onConfirm}
                      className={`rounded-full px-6 py-3.5 text-sm font-bold shadow-[0_12px_26px_rgba(31,164,99,0.2)] ${
                        darkMode || isSwipeCard ? "border border-[#45C47A]/45 bg-[#1FA463] text-white" : "bg-[#111111] text-white"
                      }`}
                    >
                      {t(confirmLabel)}
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
