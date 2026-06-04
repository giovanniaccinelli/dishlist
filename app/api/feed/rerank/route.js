import { NextResponse } from "next/server";

const MAX_CANDIDATES = 80;
const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-nano";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

function cleanString(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => cleanString(tag, 40).toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((dish) => ({
      id: cleanString(dish?.id, 80),
      name: cleanString(dish?.name, 100),
      mode: cleanString(dish?.mode || dish?.dishMode, 32),
      tags: cleanTags(dish?.tags),
      fromFollowedUser: Boolean(dish?.fromFollowedUser),
      hasLocation: Boolean(dish?.hasLocation),
      saves: Number.isFinite(Number(dish?.saves)) ? Number(dish.saves) : 0,
      likes: Number.isFinite(Number(dish?.likes)) ? Number(dish.likes) : 0,
      createdAt: Number.isFinite(Number(dish?.createdAt)) ? Number(dish.createdAt) : 0,
    }))
    .filter((dish) => dish.id && dish.name)
    .slice(0, MAX_CANDIDATES);
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

function uniqueKnownIds(ids, allowedIds) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  return ids
    .map((id) => cleanString(id, 80))
    .filter((id) => {
      if (!id || seen.has(id) || !allowedIds.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export async function POST(request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ orderedIds: [], aiUsed: false, reason: "invalid_body" }, { status: 400 });
  }

  const candidates = normalizeCandidates(body?.candidates);
  if (candidates.length < 3) {
    return NextResponse.json({ orderedIds: [], aiUsed: false, reason: "too_few_candidates" });
  }

  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const openAiToken = process.env.OPENAI_API_KEY;
  const useGateway = Boolean(gatewayToken);
  const token = gatewayToken || openAiToken;
  if (!token) {
    return NextResponse.json({ orderedIds: [], aiUsed: false, reason: "missing_ai_key" });
  }

  const endpoint = useGateway
    ? "https://ai-gateway.vercel.sh/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model =
    process.env.FEED_AI_MODEL ||
    (useGateway ? DEFAULT_GATEWAY_MODEL : DEFAULT_OPENAI_MODEL);

  const userTaste = {
    representativeTags: cleanTags(body?.userTaste?.representativeTags),
    savedTagCounts: Object.fromEntries(
      Object.entries(body?.userTaste?.savedTagCounts || {})
        .map(([tag, count]) => [cleanString(tag, 40).toLowerCase(), Number(count) || 0])
        .filter(([tag, count]) => tag && count > 0)
        .slice(0, 24)
    ),
    mode: cleanString(body?.userTaste?.mode || "anywhere", 32),
  };

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 2200);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You rerank a food social app feed. Return compact JSON only. Prefer dishes matching the user's taste, followed users, fresh posts, variety, and strong signals. Do not invent ids.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Return {\"orderedIds\":[...]} with the best order for these candidate dish ids.",
              userTaste,
              candidates,
            }),
          },
        ],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("Feed AI rerank failed:", response.status, detail.slice(0, 240));
      return NextResponse.json({
        orderedIds: [],
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
    const allowedIds = new Set(candidates.map((dish) => dish.id));
    const orderedIds = uniqueKnownIds(parsed?.orderedIds, allowedIds);
    return NextResponse.json({
      orderedIds,
      aiUsed: orderedIds.length > 0,
      model,
    });
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("Feed AI rerank error:", error);
    return NextResponse.json({
      orderedIds: [],
      aiUsed: false,
      reason: error?.name === "AbortError" ? "timeout" : "error",
      ...(debug ? { errorName: error?.name || "Error" } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }
}
