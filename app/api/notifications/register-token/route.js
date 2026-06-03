import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../_lib/firebaseAdmin";

function makeTokenDocId(token) {
  return String(token || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 180);
}

async function verifyRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Missing auth token.");
  return getAdminAuth().verifyIdToken(token);
}

export async function POST(request) {
  try {
    const decoded = await verifyRequest(request);
    const body = await request.json();
    const token = String(body?.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "Missing push token." }, { status: 400 });
    }

    const db = getAdminDb();
    const docId = makeTokenDocId(token);
    await db
      .collection("users")
      .doc(decoded.uid)
      .collection("pushTokens")
      .doc(docId)
      .set(
        {
          token,
          enabled: body?.enabled !== false,
          platform: String(body?.platform || "ios"),
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        { merge: true }
      );

    await db
      .collection("users")
      .doc(decoded.uid)
      .set(
        {
          pushRegistrationDebug: {
            lastServerSaveAt: new Date(),
            lastTokenSuffix: token.slice(-8),
            platform: String(body?.platform || "ios"),
            enabled: body?.enabled !== false,
          },
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push token registration failed:", error);
    return NextResponse.json(
      { error: error?.message || "Push token registration failed." },
      { status: 500 }
    );
  }
}
