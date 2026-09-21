"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
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
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from "../lib/dishImage";
import {
  getDishIngredientItems,
  getIngredientColor,
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
    if (!query) return dishPool.slice(0, 24);
    return dishPool
      .filter((dish) => {
        const name = String(dish?.name || "").toLowerCase();
        const ingredients = getDishIngredientItems(dish).map((item) => item.name.toLowerCase()).join(" ");
        return name.includes(query) || ingredients.includes(query);
      })
      .slice(0, 24);
  }, [dishPool, dishSearch]);

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
        <div className="top-action-btn">
          <ShoppingCart size={19} />
        </div>
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
              const color = getIngredientColor(item.color || inferIngredientColorId(item.name));
              const count = Math.max(1, Number(item.count || 1));
              return (
                <span
                  key={item.key}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold leading-none"
                  style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text, WebkitTextFillColor: color.text }}
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
            className="min-w-0 flex-1 bg-transparent py-1 text-[16px] outline-none placeholder:text-black/35"
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
              return (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => addDish(dish)}
                  disabled={Boolean(savingKey)}
                  className={`overflow-hidden rounded-[1.2rem] border text-left shadow-[0_12px_28px_rgba(0,0,0,0.08)] ${darkMode ? "border-white/10 bg-[#151515] text-white" : "border-black/8 bg-white"}`}
                >
                  <img
                    src={getDishImageUrl(dish, "thumb")}
                    alt={dish.name || ""}
                    className="aspect-square w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_DISH_IMAGE;
                    }}
                  />
                  <div className="p-3">
                    <div className="truncate text-sm font-black">{dish.name || "Dish"}</div>
                    <div className={`mt-1 text-xs font-semibold ${darkMode ? "text-white/48" : "text-black/45"}`}>
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

      <section className="mt-6 pb-6">
        <h2 className="mb-3 text-lg font-bold">{language === "it" ? "Piatti in lista" : "Dishes in list"}</h2>
        {sourceDishes.length ? (
          <div className="space-y-3">
            {sourceDishes.map((dish) => (
              <Link
                key={dish.id}
                href={`/dish/${dish.id}?source=all_dishes`}
                className={`flex items-center gap-3 rounded-[1.2rem] border p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${darkMode ? "border-white/10 bg-[#151515] text-white" : "border-black/8 bg-white"}`}
              >
                <img
                  src={getDishImageUrl(dish, "thumb")}
                  alt={dish.name || ""}
                  className="h-16 w-16 rounded-[0.95rem] object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_DISH_IMAGE;
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-bold">{dish.name || "Dish"}</div>
                  <div className={`mt-1 text-xs ${darkMode ? "text-white/48" : "text-black/45"}`}>
                    {getDishIngredientItems(dish).length} {language === "it" ? "ingredienti" : "ingredients"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={`rounded-[1.2rem] px-4 py-8 text-center text-sm ${darkMode ? "bg-white/8 text-white/58" : "bg-white/72 text-black/55"}`}>
            {language === "it" ? "Gli ingredienti aggiunti da ricette compariranno qui." : "Ingredients added from recipes will appear here."}
          </div>
        )}
      </section>

      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <BottomNav />
    </div>
  );
}
