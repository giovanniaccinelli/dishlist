import { NextResponse } from "next/server";
import { inferIngredientColorId, normalizeIngredientItems } from "../../../lib/ingredients";
import { suggestIngredientsLocally } from "../../../lib/ingredientSuggestions";

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-nano";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

function cleanString(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeAiIngredients(items) {
  if (!Array.isArray(items)) return [];
  return normalizeIngredientItems(
    items
      .map((item) => {
        if (typeof item === "string") return { name: item, color: inferIngredientColorId(item) };
        return { name: cleanString(item?.name, 48), color: cleanString(item?.color || inferIngredientColorId(item?.name), 24) };
      })
      .filter((item) => item.name)
  ).slice(0, 12);
}

function isGenericPantryStaple(name = "") {
  const key = cleanString(name, 80).toLowerCase();
  return /^(sale|salt|pepe|pepper|black pepper|white pepper|olio|oil|olive oil|extra virgin olive oil|olio evo|evo oil)$/.test(key);
}

function isDishDefiningPantryStaple(name = "", dishName = "") {
  const ingredient = cleanString(name, 80).toLowerCase();
  const dish = cleanString(dishName, 100).toLowerCase();
  if (/pepper|pepe/.test(ingredient) && /pepe|pepper|carbonara/.test(dish)) return true;
  if (/oil|olio/.test(ingredient) && /aglio.*olio|olio.*aglio|pesto/.test(dish)) return true;
  return false;
}

function removeGenericPantryStaples(items, dishName) {
  return items.filter((item) => !isGenericPantryStaple(item?.name) || isDishDefiningPantryStaple(item?.name, dishName));
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ingredients: [], aiUsed: false, reason: "invalid_body" }, { status: 400 });
  }

  const dishName = cleanString(body?.dishName, 100);
  const dishMode = cleanString(body?.dishMode || "home", 32).toLowerCase();
  if (dishName.length < 2 || dishMode === "restaurant") {
    return NextResponse.json({ ingredients: [], aiUsed: false, reason: "unsupported" });
  }

  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const openAiToken = process.env.OPENAI_API_KEY;
  const useGateway = Boolean(gatewayToken);
  const token = gatewayToken || openAiToken;
  if (!token) {
    return NextResponse.json({ ingredients: suggestIngredientsLocally(dishName), aiUsed: false, reason: "missing_ai_key" });
  }

  const endpoint = useGateway
    ? "https://ai-gateway.vercel.sh/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = process.env.INGREDIENT_AI_MODEL || (useGateway ? DEFAULT_GATEWAY_MODEL : DEFAULT_OPENAI_MODEL);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 4500);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 260,
        messages: [
          {
            role: "system",
            content:
              "Suggest distinctive grocery ingredients for a home-cooked dish. Return compact JSON only. Use simple ingredient names, no quantities. Avoid generic pantry staples such as salt, pepper, olive oil, or oil unless one is a defining ingredient in the dish name. Pick a color id for each ingredient from: green, mint, blue, yellow, orange, red, pink, purple, slate.",
          },
          {
            role: "user",
            content: JSON.stringify({
              dishName,
              output: { ingredients: [{ name: "ingredient", color: "green" }] },
            }),
          },
        ],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ ingredients: suggestIngredientsLocally(dishName), aiUsed: false, reason: "provider_error" });
    }

    const result = await response.json();
    const parsed = safeParseJson(result?.choices?.[0]?.message?.content || "");
    const ingredients = removeGenericPantryStaples(normalizeAiIngredients(parsed?.ingredients), dishName);
    return NextResponse.json({ ingredients: ingredients.length ? ingredients : suggestIngredientsLocally(dishName), aiUsed: ingredients.length > 0, model });
  } catch (error) {
    return NextResponse.json({ ingredients: suggestIngredientsLocally(dishName), aiUsed: false, reason: error?.name === "AbortError" ? "timeout" : "error" });
  } finally {
    clearTimeout(timeout);
  }
}
