"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { Map as MapIcon, Plus, Search, Trash2, X } from "lucide-react";
import AuthPromptModal from "../../components/AuthPromptModal";
import BottomNav from "../../components/BottomNav";
import { FullScreenLoading } from "../../components/AppLoadingState";
import { useLanguage } from "../../components/LanguageProvider";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import {
  addDishIngredientsToShoppingList,
  addShoppingListIngredient,
  clearShoppingList,
  getAllDishlistsForUser,
  removeShoppingListIngredient,
} from "../lib/firebaseHelpers";
import { hasDishMedia } from "../lib/dishContent";
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import {
  getDishIngredientItems,
  getIngredientPillStyle,
  inferIngredientColorId,
  normalizeIngredientKey,
  normalizeIngredientName,
} from "../lib/ingredients";

function normalizeShoppingListDocs(docs = []) {
  return docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      const name = normalizeIngredientName(data.name);
      const key = normalizeIngredientKey(data.key || name || docSnap.id);
      if (!name || !key) return null;
      return {
        id: key,
        key,
        name,
        color: data.color || inferIngredientColorId(name),
        count: Math.max(1, Number(data.count || 1)),
        dishIds: Array.isArray(data.dishIds) ? data.dishIds.map((id) => String(id || "")).filter(Boolean) : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function stableHash(value = "") {
  return String(value || "").split("").reduce((hash, char) => {
    const next = (hash << 5) - hash + char.charCodeAt(0);
    return next | 0;
  }, 0);
}

function sortShoppingItems(items = []) {
  return [...items].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
}

function NoPhotoRecipePreview({ dish, darkMode, compact = false }) {
  const ingredients = getDishIngredientItems(dish).slice(0, compact ? 4 : 8);
  return (
    <div className={`relative flex ${compact ? "h-full w-full rounded-[0.95rem]" : "aspect-square w-full"} items-start justify-center overflow-hidden border-2 bg-[#111111] px-2 text-white shadow-[inset_0_0_0_2px_rgba(228,180,63,0.72),inset_0_0_30px_rgba(228,180,63,0.16)] ${compact ? "py-2" : "pt-8"}`} style={{ borderColor: "#E4B43F" }}>
      <div className={`flex w-full flex-wrap justify-center gap-1 overflow-hidden ${compact ? "max-h-[2.55rem]" : "max-h-[4.2rem]"}`}>
        {ingredients.length ? (
          ingredients.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center rounded-full border font-bold leading-none ${compact ? "min-h-4 max-w-full px-1.5 py-0.5 text-[8px]" : "min-h-6 max-w-[92%] px-2 py-1 text-[11px]"}`}
              style={getIngredientPillStyle(item.color, darkMode)}
            >
              <span className="truncate">{item.name}</span>
            </span>
          ))
        ) : (
          <span className="rounded-full border border-[#E4B43F]/34 bg-[#2A220C]/84 px-2 py-1 text-[10px] font-black text-[#FFE4A3]">Ricetta</span>
        )}
      </div>
    </div>
  );
}

export default function ShoppingListPage() {
  const { user, loading } = useAuth();
  const { t, darkMode, language } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [items, setItems] = useState([]);
  const [dishPool, setDishPool] = useState([]);
  const [draft, setDraft] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [suggestionSeed, setSuggestionSeed] = useState(() => Date.now());
  const [selectedDish, setSelectedDish] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) setShowAuthPrompt(true);
  }, [loading, user]);

  useEffect(() => {
    if (!user?.uid) {
      setItems([]);
      return undefined;
    }
    return onSnapshot(collection(db, "users", user.uid, "shoppingListItems"), (snapshot) => {
      setItems(normalizeShoppingListDocs(snapshot.docs));
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setDishPool([]);
      setLoadingDishes(false);
      return undefined;
    }
    let active = true;
    (async () => {
      setLoadingDishes(true);
      try {
        const lists = await getAllDishlistsForUser(user.uid);
        if (!active) return;
        const allDishes = lists.find((dishlist) => dishlist.id === "all_dishes")?.dishes || [];
        const recipeDishes = allDishes
          .filter((dish) => String(dish?.dishMode || "").toLowerCase() !== "restaurant")
          .filter((dish) => getDishIngredientItems(dish).length > 0);
        setSuggestionSeed(Date.now());
        setDishPool(recipeDishes);
      } finally {
        if (active) setLoadingDishes(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const ingredientKeys = useMemo(() => new Set(items.map((item) => item.key)), [items]);
  const dishesById = useMemo(() => {
    const entries = [];
    dishPool.forEach((dish) => {
      const id = String(dish?.id || "");
      if (!id) return;
      entries.push([id, dish], [normalizeIngredientKey(id), dish]);
    });
    return new Map(entries);
  }, [dishPool]);
  const sourceDishes = useMemo(() => {
    const ids = Array.from(new Set(items.flatMap((item) => item.dishIds || [])));
    return ids.map((id) => dishesById.get(id)).filter(Boolean);
  }, [dishesById, items]);
  const visibleDishes = useMemo(() => {
    const query = dishSearch.trim().toLowerCase();
    const ranked = dishPool
      .map((dish, index) => {
        const ingredients = getDishIngredientItems(dish);
        const addedCount = ingredients.filter((ingredient) => ingredientKeys.has(ingredient.key)).length;
        const missingCount = ingredients.length - addedCount;
        const randomRank = Math.abs(stableHash(`${suggestionSeed}:${dish?.id || dish?.name || index}`));
        const usefulnessScore =
          (missingCount > 0 ? 100 : 0) +
          Math.min(addedCount, 4) * 12 +
          Math.min(missingCount, 8);
        return { dish, ingredients, addedCount, missingCount, usefulnessScore, randomRank, index };
      })
      .filter((dish) => {
        if (!query) return true;
        const name = String(dish.dish?.name || "").toLowerCase();
        const ingredients = dish.ingredients.map((item) => item.name.toLowerCase()).join(" ");
        return name.includes(query) || ingredients.includes(query);
      })
      .sort((a, b) => {
        if (a.missingCount === 0 && b.missingCount > 0) return 1;
        if (b.missingCount === 0 && a.missingCount > 0) return -1;
        if (b.usefulnessScore !== a.usefulnessScore) return b.usefulnessScore - a.usefulnessScore;
        if (a.randomRank !== b.randomRank) return a.randomRank - b.randomRank;
        return a.index - b.index;
      })
      .map(({ dish }) => dish);
    return ranked
      .slice(0, 24);
  }, [dishPool, dishSearch, ingredientKeys, suggestionSeed]);

  const addTypedIngredient = async () => {
    const name = normalizeIngredientName(draft);
    if (!user?.uid || !name) return;
    setSavingKey(`ingredient:${name}`);
    const ok = await addShoppingListIngredient(user.uid, { name, color: inferIngredientColorId(name) });
    if (ok) setDraft("");
    setSavingKey("");
  };

  const addDish = async (dish) => {
    if (!user?.uid || !dish?.id) return;
    setSavingKey(`dish:${dish.id}`);
    await addDishIngredientsToShoppingList(user.uid, dish);
    setSavingKey("");
    setSelectedDish(null);
  };

  const addDishIngredient = async (dish, ingredient) => {
    if (!user?.uid || !dish?.id || !ingredient?.key) return;
    const sourceDishId = normalizeIngredientKey(dish.id);
    const key = normalizeIngredientKey(ingredient.key || ingredient.name);
    const name = normalizeIngredientName(ingredient.name);
    if (!key || !name) return;
    setSavingKey(`dish:${dish.id}:ingredient:${ingredient.key}`);
    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.key === key);
      if (existing) {
        return sortShoppingItems(currentItems.map((item) => {
          if (item.key !== key) return item;
          const dishIds = Array.from(new Set([...(item.dishIds || []), sourceDishId].filter(Boolean)));
          return {
            ...item,
            dishIds,
            count: dishIds.length > (item.dishIds || []).length ? Math.max(1, Number(item.count || 1)) + 1 : Math.max(1, Number(item.count || 1)),
          };
        }));
      }
      return sortShoppingItems([
        ...currentItems,
        {
          id: key,
          key,
          name,
          color: ingredient.color || inferIngredientColorId(name),
          count: 1,
          dishIds: sourceDishId ? [sourceDishId] : [],
        },
      ]);
    });
    try {
      await addShoppingListIngredient(user.uid, { ...ingredient, key, name }, { sourceDishId: dish.id });
    } finally {
      setSavingKey("");
    }
  };

  const removeIngredient = async (item) => {
    if (!user?.uid) return;
    setSavingKey(`remove:${item.key}`);
    await removeShoppingListIngredient(user.uid, item.key || item.id || item.name);
    setSavingKey("");
  };

  const clearAll = async () => {
    if (!user?.uid || !items.length) return;
    setSavingKey("clear");
    await clearShoppingList(user.uid);
    setSavingKey("");
  };

  if (loading) return <FullScreenLoading title="Loading" />;

  return (
    <div className="bottom-nav-spacer h-[100dvh] overflow-y-auto bg-transparent px-4 pt-1 text-black">
      <div className="app-top-nav -mx-4 mb-2 flex items-center justify-between px-4 pb-1.5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2BD36B]">Shopping</p>
          <h1 className="text-2xl font-bold">{t("Lista della spesa")}</h1>
        </div>
        <Link href="/map" className="top-action-btn" aria-label="Mappa ristoranti">
          <MapIcon size={19} />
        </Link>
      </div>

      <section className={`rounded-[1.6rem] border p-4 ${darkMode ? "border-[#2BD36B]/24 bg-[#0D120E] text-white" : "border-[#2BD36B]/28 bg-[#F7FFF8]"}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold opacity-70">
            {items.reduce((sum, item) => sum + Math.max(1, Number(item.count || 1)), 0)} {language === "it" ? "ingredienti" : "ingredients"}
          </div>
          {items.length ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={Boolean(savingKey)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2BD36B]/35 bg-white/90 px-3 py-2 text-xs font-bold text-[#168A4A] disabled:opacity-50"
            >
              <Trash2 size={14} />
              {t("Svuota")}
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addTypedIngredient();
            }}
            placeholder={t("Aggiungi ingrediente")}
            className={`min-w-0 flex-1 rounded-full border px-4 py-3 text-[16px] outline-none ${darkMode ? "border-white/12 bg-[#171717] text-white placeholder:text-white/32" : "border-black/8 bg-white text-black placeholder:text-black/35"}`}
            style={{ fontSize: 16 }}
            disabled={Boolean(savingKey)}
          />
          <button
            type="button"
            onClick={addTypedIngredient}
            disabled={Boolean(savingKey) || !draft.trim()}
            className="no-accent-border flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2BD36B] text-black disabled:opacity-50"
            aria-label="Add ingredient"
          >
            <Plus size={19} strokeWidth={2.4} />
          </button>
        </div>

        {items.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const count = Math.max(1, Number(item.count || 1));
              return (
                <span
                  key={item.key}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold leading-none"
                  style={getIngredientPillStyle(item.color || inferIngredientColorId(item.name), darkMode)}
                >
                  {item.name}
                  {count > 1 ? <span className="font-black">x{count}</span> : null}
                  <button
                    type="button"
                    onClick={() => removeIngredient(item)}
                    disabled={Boolean(savingKey)}
                    className="no-accent-border -mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/8"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X size={12} strokeWidth={2.4} />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <div className={`rounded-[1.25rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/58" : "bg-white/72 text-black/55"}`}>
            {language === "it" ? "Aggiungi ingredienti a mano o scegli una ricetta." : "Add ingredients manually or choose a recipe."}
          </div>
        )}

        {sourceDishes.length ? (
          <div className={`mt-4 space-y-2 border-t pt-4 ${darkMode ? "border-white/10" : "border-[#2BD36B]/18"}`}>
            {sourceDishes.map((dish) => {
              const ingredients = getDishIngredientItems(dish);
              const addedCount = ingredients.filter((ingredient) => ingredientKeys.has(ingredient.key)).length;
              return (
                <Link
                  key={dish.id}
                  href={`/dish/${dish.id}?source=all_dishes`}
                  className={`flex items-center gap-3 rounded-[1.2rem] border p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/10 bg-[#151515] text-white" : "border-black/8 bg-white"}`}
                >
                  <div className="h-16 w-16 shrink-0">
                    {hasDishMedia(dish) ? (
                      <img
                        src={getDishImageUrl(dish, "thumb")}
                        alt={dish.name || ""}
                        className="h-16 w-16 rounded-[0.95rem] object-cover"
                        onError={(event) => {
                          event.currentTarget.src = DEFAULT_DISH_IMAGE;
                        }}
                      />
                    ) : (
                      <NoPhotoRecipePreview dish={dish} darkMode={darkMode} compact />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold">{dish.name || "Dish"}</div>
                    <div className={`mt-1 text-xs font-semibold ${darkMode ? "text-white/48" : "text-black/45"}`}>
                      {addedCount}/{ingredients.length} {language === "it" ? "in lista" : "in list"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">{language === "it" ? "Aggiungi da ricette" : "Add from recipes"}</h2>
        <div className={`mb-3 flex items-center gap-2 rounded-full border px-3 py-2 ${darkMode ? "border-white/12 bg-[#151515] text-white" : "border-black/8 bg-white/85"}`}>
          <Search size={18} className={darkMode ? "text-white/45" : "text-black/38"} />
          <input
            type="text"
            value={dishSearch}
            onChange={(event) => setDishSearch(event.target.value)}
            placeholder={language === "it" ? "Cerca piatti o ingredienti" : "Search dishes or ingredients"}
            className={`min-w-0 flex-1 bg-transparent py-1 text-[16px] outline-none ${darkMode ? "placeholder:text-white/32" : "placeholder:text-black/35"}`}
            style={{ fontSize: 16 }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {loadingDishes ? (
            <div className="col-span-2 py-8 text-center text-sm text-black/45">{t("Loading...")}</div>
          ) : visibleDishes.length ? (
            visibleDishes.map((dish) => {
              const ingredients = getDishIngredientItems(dish);
              const addedCount = ingredients.filter((ingredient) => ingredientKeys.has(ingredient.key)).length;
              const noMedia = !hasDishMedia(dish);
              return (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => setSelectedDish(dish)}
                  disabled={Boolean(savingKey)}
                  className={`overflow-hidden rounded-[1.2rem] border text-left shadow-[0_12px_28px_rgba(0,0,0,0.08)] ${noMedia ? "border-white/10 bg-[#151515] text-white" : darkMode ? "border-white/10 bg-[#151515] text-white" : "border-black/8 bg-white text-black"}`}
                >
                  {!noMedia ? (
                    <img
                      src={getDishImageUrl(dish, "thumb")}
                      alt={dish.name || ""}
                      className="aspect-square w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_DISH_IMAGE;
                      }}
                    />
                  ) : (
                    <NoPhotoRecipePreview dish={dish} darkMode={darkMode} />
                  )}
                  <div className={`${noMedia ? "border-t border-white/8 bg-[#151515] text-white" : ""} p-3`}>
                    <div className={`truncate text-sm font-black ${noMedia ? "text-white" : ""}`}>{dish.name || "Dish"}</div>
                    <div className={`mt-1 text-xs font-semibold ${darkMode || noMedia ? "text-white/48" : "text-black/45"}`}>
                      {addedCount}/{ingredients.length} {language === "it" ? "in lista" : "in list"}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="col-span-2 rounded-[1.2rem] bg-white/72 px-4 py-8 text-center text-sm text-black/55">
              {language === "it" ? "Nessuna ricetta trovata." : "No recipes found."}
            </div>
          )}
        </div>
      </section>

      {selectedDish ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/58 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-[3px]"
          onClick={() => setSelectedDish(null)}
        >
          <div
            className={`max-h-[82dvh] w-full max-w-md overflow-hidden rounded-[1.75rem] border shadow-[0_24px_70px_rgba(0,0,0,0.34)] ${darkMode ? "border-white/12 bg-[#101010] text-white" : "border-black/10 bg-white text-black"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={hasDishMedia(selectedDish) ? "relative h-48 overflow-hidden" : "relative px-4 pb-3 pt-5"}>
              {hasDishMedia(selectedDish) ? (
                <>
                  <img
                    src={getDishImageUrl(selectedDish)}
                    alt={selectedDish.name || ""}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/45 to-transparent px-4 pb-4 pt-14 text-white">
                    <div className="text-[1.55rem] font-black leading-none">{selectedDish.name || "Dish"}</div>
                  </div>
                </>
              ) : (
                <div className="pr-12 text-[1.55rem] font-black leading-none">{selectedDish.name || "Dish"}</div>
              )}
              <button
                type="button"
                onClick={() => setSelectedDish(null)}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/62 text-white backdrop-blur-md"
                aria-label="Close dish ingredients"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(82dvh-12rem)] overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2BD36B]">Ingredienti</p>
                  <div className={`mt-1 text-sm ${darkMode ? "text-white/52" : "text-black/50"}`}>
                    {getDishIngredientItems(selectedDish).filter((ingredient) => ingredientKeys.has(ingredient.key)).length}/{getDishIngredientItems(selectedDish).length} {language === "it" ? "gia in lista" : "already in list"}
                  </div>
                </div>
                <Link
                  href={`/dish/${selectedDish.id}?source=all_dishes`}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${darkMode ? "bg-white/10 text-white" : "bg-black/7 text-black"}`}
                >
                  {language === "it" ? "Apri" : "Open"}
                </Link>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {getDishIngredientItems(selectedDish).map((ingredient) => {
                  const inList = ingredientKeys.has(ingredient.key);
                  const ingredientSavingKey = `dish:${selectedDish.id}:ingredient:${ingredient.key}`;
                  return (
                    <span
                      key={ingredient.key}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold leading-none ${inList ? "" : "opacity-82"}`}
                      style={getIngredientPillStyle(ingredient.color || inferIngredientColorId(ingredient.name), darkMode)}
                    >
                      {ingredient.name}
                      {inList ? (
                        <span className="font-black">✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addDishIngredient(selectedDish, ingredient)}
                          disabled={Boolean(savingKey)}
                          className="no-accent-border -mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/8 disabled:opacity-50"
                          aria-label={`Add ${ingredient.name}`}
                        >
                          {savingKey === ingredientSavingKey ? <span className="dishlist-action-spinner h-3 w-3" /> : <Plus size={12} strokeWidth={2.6} />}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => addDish(selectedDish)}
                disabled={Boolean(savingKey)}
                className="dish-modal-primary-btn flex min-h-[3.15rem] w-full items-center justify-center rounded-full px-5 text-sm font-bold disabled:opacity-60"
              >
                {savingKey === `dish:${selectedDish.id}` ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="dishlist-action-spinner" />
                    <span>{language === "it" ? "Aggiungo..." : "Adding..."}</span>
                  </span>
                ) : (
                  language === "it" ? "Aggiungi ingredienti" : "Add ingredients"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <BottomNav />
    </div>
  );
}
