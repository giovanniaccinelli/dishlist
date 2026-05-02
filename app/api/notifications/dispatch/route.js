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

async function getEnabledTokensForUserIds(userIds = []) {
  const db = getAdminDb();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const snapshots = await Promise.all(
    uniqueIds.map((userId) => db.collection("users").doc(userId).collection("pushTokens").get())
  );
  return snapshots.flatMap((snap) =>
    snap.docs
      .map((doc) => doc.data() || {})
      .filter((item) => item.enabled !== false && typeof item.token === "string" && item.token.trim())
      .map((item) => item.token.trim())
  );
}

async function dispatchDishPosted({ decoded, ownerId, dishId, dishName = "" }) {
  if (decoded.uid !== ownerId) throw new Error("Not allowed to dispatch this dish notification.");
  const db = getAdminDb();
  const ownerSnap = await db.collection("users").doc(ownerId).get();
  const ownerData = ownerSnap.data() || {};
  const followers = Array.isArray(ownerData.followers) ? ownerData.followers : [];
  const tokens = await getEnabledTokensForUserIds(followers);
  return sendApnsNotifications(tokens, {
    title: `${ownerData.displayName || "Someone"} posted a dish`,
    body: dishName || "Open DishList to see it",
    url: `/dish/${dishId}?source=public&mode=single`,
  });
}

async function dispatchStoryPosted({ decoded, ownerId, storyName = "" }) {
  if (decoded.uid !== ownerId) throw new Error("Not allowed to dispatch this story notification.");
  const db = getAdminDb();
  const ownerSnap = await db.collection("users").doc(ownerId).get();
  const ownerData = ownerSnap.data() || {};
  const followers = Array.isArray(ownerData.followers) ? ownerData.followers : [];
  const tokens = await getEnabledTokensForUserIds(followers);
  return sendApnsNotifications(tokens, {
    title: `${ownerData.displayName || "Someone"} added a story`,
    body: storyName || "See what they posted",
    url: `/profile/${encodeURIComponent(ownerId)}`,
  });
}

async function dispatchDirectMessage({ decoded, conversationId, senderId, text = "", type = "text" }) {
  if (decoded.uid !== senderId) throw new Error("Not allowed to dispatch this message notification.");
  const db = getAdminDb();
  const convoSnap = await db.collection("conversations").doc(conversationId).get();
  const convoData = convoSnap.data() || {};
  const recipients = Array.isArray(convoData.participants)
    ? convoData.participants.filter((id) => id && id !== senderId)
    : [];
  if (!recipients.length) return { sent: 0, failed: 0, skipped: 0 };

  const senderSnap = await db.collection("users").doc(senderId).get();
  const senderData = senderSnap.data() || {};
  const tokens = await getEnabledTokensForUserIds(recipients);
  return sendApnsNotifications(tokens, {
    title: senderData.displayName || "New message",
    body: type === "dish" ? "Shared a dish with you" : text || "Sent you a message on DishList",
    url: `/directs/${conversationId}`,
  });
}

export async function POST(request) {
  try {
    const decoded = await verifyRequest(request);
    const body = await request.json();
    const type = String(body?.type || "");

    let result;
    if (type === "dish_posted") {
      result = await dispatchDishPosted({ decoded, ...body });
    } else if (type === "story_posted") {
      result = await dispatchStoryPosted({ decoded, ...body });
    } else if (type === "direct_message") {
      result = await dispatchDirectMessage({ decoded, ...body });
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
