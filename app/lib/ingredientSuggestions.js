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

const ITALIAN_INGREDIENT_NAMES = {
  pasta: "pasta",
  eggs: "uova",
  pecorino: "pecorino",
  guanciale: "guanciale",
  "black pepper": "pepe nero",
  tomato: "pomodoro",
  chili: "peperoncino",
  basil: "basilico",
  "pine nuts": "pinoli",
  parmesan: "parmigiano",
  garlic: "aglio",
  "olive oil": "olio d'oliva",
  rice: "riso",
  stock: "brodo",
  butter: "burro",
  onion: "cipolla",
  flour: "farina",
  yeast: "lievito",
  mozzarella: "mozzarella",
  "burger buns": "pane per burger",
  "beef patty": "hamburger di manzo",
  cheese: "formaggio",
  lettuce: "lattuga",
  milk: "latte",
  sugar: "zucchero",
  cucumber: "cetriolo",
  feta: "feta",
  olives: "olive",
  chicken: "pollo",
  lemon: "limone",
  rosemary: "rosmarino",
  salmon: "salmone",
  dill: "aneto",
  yogurt: "yogurt",
  mascarpone: "mascarpone",
  coffee: "caffe",
  ladyfingers: "savoiardi",
  cocoa: "cacao",
};

function localizeIngredientName(name, language = "en") {
  if (String(language || "").toLowerCase().startsWith("it")) {
    return ITALIAN_INGREDIENT_NAMES[name] || name;
  }
  return name;
}

export function suggestIngredientsLocally(dishName = "", language = "en") {
  const recipe = LOCAL_RECIPES.find((entry) => entry.match.test(dishName));
  const items = recipe?.items || [];
  return normalizeIngredientItems(
    items.map((name) => {
      const localizedName = localizeIngredientName(name, language);
      return { name: localizedName, color: inferIngredientColorId(localizedName) };
    })
  );
}

export async function suggestIngredientsFromName(dishName, dishMode = "home", language = "en") {
  const cleanName = String(dishName || "").trim();
  if (cleanName.length < 2 || String(dishMode || "").toLowerCase() === "restaurant") return [];
  try {
    const response = await fetch("/api/ingredients/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishName: cleanName, dishMode, language }),
    });
    if (!response.ok) return suggestIngredientsLocally(cleanName, language);
    const data = await response.json();
    const ingredients = normalizeIngredientItems(data?.ingredients || []);
    return ingredients.length ? ingredients : suggestIngredientsLocally(cleanName, language);
  } catch {
    return suggestIngredientsLocally(cleanName, language);
  }
}
