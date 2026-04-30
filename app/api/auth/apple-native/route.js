import { createFirebaseAppleSession } from "../_apple/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const session = await createFirebaseAppleSession(body);
    return Response.json(session);
  } catch (error) {
    console.error("Native Apple sign in failed:", error);
    return Response.json({ error: error.message || "Apple sign in failed." }, { status: 400 });
  }
}
