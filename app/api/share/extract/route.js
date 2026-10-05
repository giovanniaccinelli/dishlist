import { NextResponse } from "next/server";
import { TAG_OPTIONS } from "../../../lib/tags";

export const runtime = "nodejs";

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-nano";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

function cleanText(value = "") {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampText(value = "", maxLength = 400) {
  return cleanText(value).slice(0, maxLength);
}

function firstValue(value) {
  if (Array.isArray(value)) return firstValue(value[0]);
  if (value && typeof value === "object") return value.name || value.text || value.value || "";
  return value || "";
}

function normalizeList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(/\n|,/);
  const seen = new Set();
  return items
    .map((item) => clampText(firstValue(item), 120))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
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

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(TAG_OPTIONS);
  const seen = new Set();
  return value
    .map((tag) => clampText(tag, 40).toLowerCase())
    .filter((tag) => {
      if (!allowed.has(tag) || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, 6);
}

function normalizeTimers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((timer) => ({
      label: clampText(timer?.label || timer?.name || "", 60),
      minutes: Math.round(Number(timer?.minutes || timer?.durationMinutes || 0)),
    }))
    .filter((timer) => timer.label && timer.minutes > 0 && timer.minutes <= 720)
    .slice(0, 8);
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

function htmlToVisibleText(html) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/section|\/article)>/gi, "\n")
  );
}

function readDuration(recipe, key) {
  const raw = firstValue(recipe?.[key]);
  if (!raw) return "";
  const iso = String(raw).match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) {
    const hours = Number(iso[1] || 0);
    const minutes = Number(iso[2] || 0);
    const total = hours * 60 + minutes;
    return total ? `${total} min` : "";
  }
  return clampText(raw, 40);
}

function shouldUseAi(draft) {
  return !draft.title || draft.ingredients.length < 2 || cleanText(draft.method).length < 40;
}

function mergeDrafts(base, aiDraft) {
  if (!aiDraft) return base;
  return {
    ...base,
    title: base.title || aiDraft.title,
    description: base.description || aiDraft.description,
    ingredients: base.ingredients.length ? base.ingredients : aiDraft.ingredients,
    method: base.method || aiDraft.method,
    servings: base.servings || aiDraft.servings,
    prepTime: base.prepTime || aiDraft.prepTime,
    cookTime: base.cookTime || aiDraft.cookTime,
    totalTime: base.totalTime || aiDraft.totalTime,
    tags: base.tags?.length ? base.tags : aiDraft.tags,
    timers: base.timers?.length ? base.timers : aiDraft.timers,
    aiUsed: Boolean(aiDraft.aiUsed),
    model: aiDraft.model || base.model,
    confidence: base.confidence === "recipe" ? "recipe" : aiDraft.confidence || base.confidence,
  };
}

async function extractWithAi({ title, description, visibleText, sharedText }) {
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const openAiToken = process.env.OPENAI_API_KEY;
  const useGateway = Boolean(gatewayToken);
  const token = gatewayToken || openAiToken;
  if (!token) return null;

  const endpoint = useGateway
    ? "https://ai-gateway.vercel.sh/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = process.env.SHARE_RECIPE_AI_MODEL || (useGateway ? DEFAULT_GATEWAY_MODEL : DEFAULT_OPENAI_MODEL);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 6500);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Extract a cooking recipe from shared webpage text for a DishList upload draft. Return compact JSON only. Do not invent details. Ingredients should include useful quantities when present. Method should be plain steps separated by newlines. Tags must be selected only from the allowedTags list.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title,
              description,
              sharedText,
              pageText: visibleText.slice(0, 12000),
              allowedTags: TAG_OPTIONS,
              output: {
                title: "",
                description: "",
                ingredients: ["ingredient with quantity if present"],
                method: "step one\nstep two",
                servings: "",
                prepTime: "",
                cookTime: "",
                totalTime: "",
                timers: [{ label: "timer name", minutes: 10 }],
                tags: ["exact allowed tag"],
              },
            }),
          },
        ],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) return null;
    const result = await response.json();
    const parsed = safeParseJson(result?.choices?.[0]?.message?.content || "");
    if (!parsed) return null;
    return {
      title: clampText(parsed.title, 120),
      description: clampText(parsed.description, 500),
      ingredients: normalizeList(parsed.ingredients),
      method: normalizeInstructions(parsed.method || parsed.instructions),
      servings: clampText(parsed.servings, 40),
      prepTime: clampText(parsed.prepTime, 40),
      cookTime: clampText(parsed.cookTime, 40),
      totalTime: clampText(parsed.totalTime, 40),
      timers: normalizeTimers(parsed.timers),
      tags: normalizeTags(parsed.tags),
      aiUsed: true,
      model,
      confidence: "ai",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
        confidence: "text",
        aiUsed: false,
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
    const visibleText = htmlToVisibleText(html);
    const title = cleanText(firstValue(recipe?.name)) || readTitle(html) || sharedText || "Shared dish";
    const description = cleanText(firstValue(recipe?.description)) || readMeta(html, "og:description") || readMeta(html, "description") || sharedText;
    const image = firstValue(recipe?.image) || readMeta(html, "og:image");
    const ingredients = normalizeList(recipe?.recipeIngredient);
    const method = normalizeInstructions(recipe?.recipeInstructions);
    const baseDraft = {
      title,
      sourceUrl,
      description,
      image,
      ingredients,
      method,
      servings: clampText(firstValue(recipe?.recipeYield), 40),
      prepTime: readDuration(recipe, "prepTime"),
      cookTime: readDuration(recipe, "cookTime"),
      totalTime: readDuration(recipe, "totalTime"),
      tags: [],
      timers: [],
      confidence: recipe ? "recipe" : "metadata",
      aiUsed: false,
    };

    const aiDraft = shouldUseAi(baseDraft)
      ? await extractWithAi({ title, description, visibleText, sharedText })
      : null;
    const draft = mergeDrafts(baseDraft, aiDraft);

    return NextResponse.json({
      ...draft,
      title: draft.title || sharedText || "Shared dish",
      sourceUrl,
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
