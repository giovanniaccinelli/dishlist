import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../_lib/firebaseAdmin";
import { sendApnsNotifications } from "../../_lib/apns";

async function verifyRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Missing auth token.");
  const decoded = await getAdminAuth().verifyIdToken(token);
  return decoded;
}

function uniqueNonEmpty(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getUserIdCandidates(routeId, userDoc) {
  const data = userDoc?.data?.() || userDoc || {};
  const rawAppleSub = String(data.appleSub || "").trim();
  const routeValue = String(routeId || "").trim();
  const routeAppleSub = routeValue.startsWith("apple:") ? routeValue.slice(6) : "";
  return uniqueNonEmpty([
    userDoc?.id,
    routeValue,
    data.uid,
    data.userId,
    data.appleUserId,
    data.authUid,
    rawAppleSub,
    rawAppleSub ? `apple:${rawAppleSub}` : "",
    routeAppleSub,
  ]);
}

async function resolveUserIdsForPush(userIds = []) {
  const db = getAdminDb();
  const uniqueIds = uniqueNonEmpty(userIds);
  if (!uniqueIds.length) return [];
  const usersSnapshot = await db.collection("users").get();
  const resolvedIds = new Set();

  uniqueIds.forEach((userId) => resolvedIds.add(userId));

  usersSnapshot.docs.forEach((userDoc) => {
    const candidates = getUserIdCandidates(null, userDoc);
    if (uniqueIds.some((userId) => candidates.includes(String(userId || "").trim()))) {
      candidates.forEach((candidateId) => resolvedIds.add(candidateId));
    }
  });

  const resolved = Array.from(resolvedIds);
  console.log("Resolved push user ids", {
    requestedUserIds: uniqueIds,
    resolvedUserIds: resolved,
  });
  return resolved;
}

async function getEnabledTokensForUserIds(userIds = []) {
  const db = getAdminDb();
  const uniqueIds = await resolveUserIdsForPush(userIds);
  const records = await Promise.all(
    uniqueIds.map(async (userId) => {
      const userRef = db.collection("users").doc(userId);
      const [userSnap, tokenSnap] = await Promise.all([
        userRef.get(),
        userRef.collection("pushTokens").get(),
      ]);
      return { userId, userData: userSnap.data() || {}, tokenSnap };
    })
  );
  const tokens = records.flatMap(({ userData, tokenSnap }) => {
    const subcollectionTokens = tokenSnap.docs
      .map((doc) => doc.data() || {})
      .filter((item) => item.enabled !== false && typeof item.token === "string" && item.token.trim())
      .map((item) => item.token.trim());
    const flatTokens = Object.values(userData.pushTokensFlat || {})
      .filter((item) => item?.enabled !== false && typeof item?.token === "string" && item.token.trim())
      .map((item) => item.token.trim());
    return [...subcollectionTokens, ...flatTokens];
  });
  const uniqueTokens = Array.from(new Set(tokens));
  console.log("Push token lookup", {
    requestedUserIds: uniqueIds,
    tokenCount: uniqueTokens.length,
  });
  return uniqueTokens;
}

async function recordPushDispatchDebug(userIds = [], debug = {}) {
  const db = getAdminDb();
  const uniqueIds = await resolveUserIdsForPush(userIds);
  await Promise.all(
    uniqueIds.map((userId) =>
      db
        .collection("users")
        .doc(userId)
        .set(
          {
            pushDispatchDebug: {
              ...debug,
              checkedAt: new Date(),
            },
          },
          { merge: true }
        )
        .catch((error) => {
          console.warn("Failed to write push dispatch debug:", userId, error);
        })
    )
  );
}

async function dispatchDishPosted({ decoded, ownerId, dishId, dishName = "" }) {
  if (decoded.uid !== ownerId) throw new Error("Not allowed to dispatch this dish notification.");
  const db = getAdminDb();
  const ownerSnap = await db.collection("users").doc(ownerId).get();
  const ownerData = ownerSnap.data() || {};
  const followers = Array.isArray(ownerData.followers) ? ownerData.followers : [];
  console.log("Dispatching dish_posted", {
    ownerId,
    followerCount: followers.length,
    dishId,
  });
  const tokens = await getEnabledTokensForUserIds(followers);
  const result = await sendApnsNotifications(tokens, {
    title: `${ownerData.displayName || "Someone"} posted a dish`,
    body: dishName || "Open DishList to see it",
    url: `/dish/${dishId}?source=public&mode=single`,
  });
  await recordPushDispatchDebug(followers, { type: "dish_posted", ownerId, dishId, tokenCount: tokens.length, result });
  return result;
}

async function dispatchStoryPosted({ decoded, ownerId, storyName = "" }) {
  if (decoded.uid !== ownerId) throw new Error("Not allowed to dispatch this story notification.");
  const db = getAdminDb();
  const ownerSnap = await db.collection("users").doc(ownerId).get();
  const ownerData = ownerSnap.data() || {};
  const followers = Array.isArray(ownerData.followers) ? ownerData.followers : [];
  console.log("Dispatching story_posted", {
    ownerId,
    followerCount: followers.length,
  });
  const tokens = await getEnabledTokensForUserIds(followers);
  const result = await sendApnsNotifications(tokens, {
    title: `${ownerData.displayName || "Someone"} added a story`,
    body: storyName || "See what they posted",
    url: `/profile/${encodeURIComponent(ownerId)}`,
  });
  await recordPushDispatchDebug(followers, { type: "story_posted", ownerId, tokenCount: tokens.length, result });
  return result;
}

async function dispatchDirectMessage({ decoded, conversationId, senderId, text = "", type = "text" }) {
  if (decoded.uid !== senderId) throw new Error("Not allowed to dispatch this message notification.");
  const db = getAdminDb();
  const convoSnap = await db.collection("conversations").doc(conversationId).get();
  const convoData = convoSnap.data() || {};
  const recipients = Array.isArray(convoData.participants)
    ? convoData.participants.filter((id) => id && id !== senderId)
    : [];
  console.log("Dispatching direct_message", {
    conversationId,
    senderId,
    recipientCount: recipients.length,
    type,
  });
  if (!recipients.length) return { sent: 0, failed: 0, skipped: 0 };

  const senderSnap = await db.collection("users").doc(senderId).get();
  const senderData = senderSnap.data() || {};
  const tokens = await getEnabledTokensForUserIds(recipients);
  const result = await sendApnsNotifications(tokens, {
    title: senderData.displayName || "New message",
    body: type === "dish" ? "Shared a dish with you" : text || "Sent you a message on DishList",
    url: `/directs/${conversationId}`,
  });
  await recordPushDispatchDebug(recipients, { type: "direct_message", conversationId, senderId, tokenCount: tokens.length, result });
  return result;
}

async function dispatchCommentPosted({
  decoded,
  actorId,
  recipientIds = [],
  dishId = "",
  storyOwnerId = "",
  dishName = "",
  commentText = "",
  isStoryComment = false,
}) {
  if (decoded.uid !== actorId) throw new Error("Not allowed to dispatch this comment notification.");
  const db = getAdminDb();
  const actorSnap = await db.collection("users").doc(actorId).get();
  const actorData = actorSnap.data() || {};
  const tokens = await getEnabledTokensForUserIds(
    recipientIds.filter((id) => id && id !== actorId)
  );
  console.log("Dispatching comment_posted", {
    actorId,
    recipientCount: recipientIds.filter((id) => id && id !== actorId).length,
    tokenCount: tokens.length,
    dishId,
    isStoryComment,
  });
  if (!tokens.length) return { sent: 0, failed: 0, skipped: 0 };
  const result = await sendApnsNotifications(tokens, {
    title: `${actorData.displayName || "Someone"} commented`,
    body: commentText || (isStoryComment ? "Commented on a story" : dishName || "Commented on a dish"),
    url:
      isStoryComment && storyOwnerId
        ? `/profile/${encodeURIComponent(storyOwnerId)}`
        : `/dish/${dishId}?source=public&mode=single`,
  });
  await recordPushDispatchDebug(recipientIds, { type: "comment_posted", actorId, dishId, isStoryComment, tokenCount: tokens.length, result });
  return result;
}

export async function POST(request) {
  try {
    const decoded = await verifyRequest(request);
    const body = await request.json();
    const rawType = String(body?.type || "");
    const type =
      body?.conversationId && body?.senderId && (rawType === "text" || rawType === "dish")
        ? "direct_message"
        : rawType;
    console.log("Push dispatch request received", {
      type,
      rawType,
      actor: decoded.uid,
      sandbox: process.env.APPLE_PUSH_USE_SANDBOX === "1",
      hasApnsTeam: Boolean(process.env.APPLE_TEAM_ID),
      hasApnsKey: Boolean(process.env.APPLE_KEY_ID),
      hasApnsPrivateKey: Boolean(process.env.APPLE_PUSH_PRIVATE_KEY),
      hasFirebaseAdminProject: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
      hasFirebaseAdminEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
      hasFirebaseAdminPrivateKey: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    });

    let result;
    if (type === "dish_posted") {
      result = await dispatchDishPosted({ decoded, ...body });
    } else if (type === "story_posted") {
      result = await dispatchStoryPosted({ decoded, ...body });
    } else if (type === "direct_message") {
      result = await dispatchDirectMessage({ decoded, ...body });
    } else if (type === "comment_posted") {
      result = await dispatchCommentPosted({ decoded, ...body });
    } else {
      return NextResponse.json({ error: "Unsupported notification type." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Push dispatch failed:", error);
    return NextResponse.json(
      { error: error?.message || "Push dispatch failed." },
      { status: 500 }
    );
  }
}
