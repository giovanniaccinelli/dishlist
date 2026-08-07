import { inferIngredientColorId, normalizeIngredientItems } from "./ingredients";

const LOCAL_RECIPES = [
  { match: /carbonara/i, items: ["pasta", "eggs", "pecorino", "guanciale", "black pepper"] },
  { match: /amatriciana/i, items: ["pasta", "tomato", "guanciale", "pecorino", "chili"] },
  { match: /cacio\s*e\s*pepe/i, items: ["pasta", "pecorino", "black pepper"] },
  { match: /pesto/i, items: ["basil", "pine nuts", "parmesan", "garlic", "olive oil"] },
  { match: /risotto/i, items: ["rice", "stock", "butter", "parmesan", "onion"] },
  { match: /pizza/i, items: ["flour", "yeast", "tomato", "mozzarella"] },
  { match: /burger/i, items: ["burger buns", "beef patty", "cheese", "lettuce", "tomato"] },
  { match: /pancake/i, items: ["flour", "eggs", "milk", "butter", "sugar"] },
  { match: /salad|insalata/i, items: ["lettuce", "tomato", "cucumber", "feta", "olives"] },
  { match: /chicken|pollo/i, items: ["chicken", "garlic", "lemon", "rosemary"] },
  { match: /salmon|salmone/i, items: ["salmon", "lemon", "dill", "yogurt"] },
  { match: /tiramisu/i, items: ["mascarpone", "eggs", "coffee", "ladyfingers", "cocoa"] },
];

export function suggestIngredientsLocally(dishName = "") {
  const recipe = LOCAL_RECIPES.find((entry) => entry.match.test(dishName));
  const items = recipe?.items || [];
  return normalizeIngredientItems(items.map((name) => ({ name, color: inferIngredientColorId(name) })));
}

export async function suggestIngredientsFromName(dishName, dishMode = "home") {
  const cleanName = String(dishName || "").trim();
  if (cleanName.length < 2 || String(dishMode || "").toLowerCase() === "restaurant") return [];
  try {
    const response = await fetch("/api/ingredients/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishName: cleanName, dishMode }),
    });
    if (!response.ok) return suggestIngredientsLocally(cleanName);
    const data = await response.json();
    const ingredients = normalizeIngredientItems(data?.ingredients || []);
    return ingredients.length ? ingredients : suggestIngredientsLocally(cleanName);
  } catch {
    return suggestIngredientsLocally(cleanName);
  }
}
