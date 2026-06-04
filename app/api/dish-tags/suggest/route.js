import { NextResponse } from "next/server";
import { TAG_OPTIONS } from "../../../lib/tags";

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-nano";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";
const MAX_SUGGESTED_TAGS = 4;

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

function normalizeSuggestedTags(tags) {
  if (!Array.isArray(tags)) return [];
  const allowed = new Set(TAG_OPTIONS);
  const seen = new Set();
  return tags
    .map((tag) => cleanString(tag, 40).toLowerCase())
    .filter((tag) => {
      if (!allowed.has(tag) || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, MAX_SUGGESTED_TAGS);
}

export async function POST(request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ tags: [], aiUsed: false, reason: "invalid_body" }, { status: 400 });
  }

  const dishName = cleanString(body?.dishName, 100);
  if (dishName.length < 2) {
    return NextResponse.json({ tags: [], aiUsed: false, reason: "missing_dish_name" });
  }

  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const openAiToken = process.env.OPENAI_API_KEY;
  const useGateway = Boolean(gatewayToken);
  const token = gatewayToken || openAiToken;
  if (!token) {
    return NextResponse.json({ tags: [], aiUsed: false, reason: "missing_ai_key" });
  }

  const endpoint = useGateway
    ? "https://ai-gateway.vercel.sh/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = process.env.DISH_TAG_AI_MODEL || (useGateway ? DEFAULT_GATEWAY_MODEL : DEFAULT_OPENAI_MODEL);
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
        temperature: 0.1,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content:
              "You select food tags for a dish upload form. Return compact JSON only. Use only tags from the allowed list. Pick 2 to 4 tags.",
          },
          {
            role: "user",
            content: JSON.stringify({
              dishName,
              dishMode: cleanString(body?.dishMode || "anywhere", 32),
              allowedTags: TAG_OPTIONS,
              output: { tags: ["exact allowed tag"] },
            }),
          },
        ],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("Dish tag AI suggestion failed:", response.status, detail.slice(0, 240));
      return NextResponse.json({
        tags: [],
        aiUsed: false,
        reason: "provider_error",
        ...(debug
          ? {
              providerStatus: response.status,
              providerDetail: detail.slice(0, 500),
              model,
            }
          : {}),
      });
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || "";
    const parsed = safeParseJson(content);
    const tags = normalizeSuggestedTags(parsed?.tags);
    return NextResponse.json({ tags, aiUsed: tags.length > 0, model });
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("Dish tag AI suggestion error:", error);
    return NextResponse.json({
      tags: [],
      aiUsed: false,
      reason: error?.name === "AbortError" ? "timeout" : "error",
      ...(debug ? { errorName: error?.name || "Error" } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }
}
