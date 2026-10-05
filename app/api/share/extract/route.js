import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanText(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstValue(value) {
  if (Array.isArray(value)) return firstValue(value[0]);
  if (value && typeof value === "object") return value.name || value.text || value.value || "";
  return value || "";
}

function normalizeList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(/\n|,/);
  return items.map((item) => cleanText(firstValue(item))).filter(Boolean).slice(0, 30);
}

function normalizeInstructions(value) {
  if (!value) return "";
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (typeof item === "string") return cleanText(item);
      if (Array.isArray(item?.itemListElement)) return normalizeInstructions(item.itemListElement);
      return cleanText(item?.text || item?.name || "");
    })
    .filter(Boolean)
    .join("\n");
}

function findRecipeSchema(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeSchema(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;

  const type = node["@type"];
  const types = Array.isArray(type) ? type.map((item) => String(item).toLowerCase()) : [String(type || "").toLowerCase()];
  if (types.includes("recipe")) return node;

  return findRecipeSchema(node["@graph"]) || findRecipeSchema(node.mainEntity) || null;
}

function parseJsonLd(html) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].replace(/&quot;/g, '"'));
      const recipe = findRecipeSchema(parsed);
      if (recipe) return recipe;
    } catch {
      // Ignore invalid publisher JSON-LD.
    }
  }
  return null;
}

function readMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function readTitle(html) {
  return cleanText(readMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sourceUrl = String(body?.url || "").trim();
    const sharedText = cleanText(body?.text || "");

    if (!sourceUrl && !sharedText) {
      return NextResponse.json({ title: "", sourceUrl: "", ingredients: [], method: "", description: "" });
    }

    if (!sourceUrl) {
      return NextResponse.json({
        title: sharedText.split(/\n|\. /)[0]?.slice(0, 90) || "Shared dish",
        sourceUrl: "",
        ingredients: [],
        method: "",
        description: sharedText,
      });
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": "DishListBot/1.0 (+https://dishlist7.vercel.app)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await response.text();
    const recipe = parseJsonLd(html);
    const title = cleanText(firstValue(recipe?.name)) || readTitle(html) || sharedText || "Shared dish";
    const description = cleanText(firstValue(recipe?.description)) || readMeta(html, "og:description") || readMeta(html, "description") || sharedText;
    const image = firstValue(recipe?.image) || readMeta(html, "og:image");
    const ingredients = normalizeList(recipe?.recipeIngredient);
    const method = normalizeInstructions(recipe?.recipeInstructions);

    return NextResponse.json({
      title,
      sourceUrl,
      description,
      image,
      ingredients,
      method,
      confidence: recipe ? "recipe" : "metadata",
    });
  } catch (error) {
    return NextResponse.json(
      {
        title: "",
        sourceUrl: "",
        ingredients: [],
        method: "",
        description: "",
        error: error?.message || "Could not read shared link",
      },
      { status: 200 }
    );
  }
}
