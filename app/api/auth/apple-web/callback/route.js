import { createFirebaseAppleSession } from "../../_apple/server";

export const runtime = "nodejs";

const htmlResponse = (script) =>
  new Response(`<!doctype html><html><body><script>${script}</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

const sendToOpener = (payload) => htmlResponse(`
  if (window.opener) {
    window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
  }
  window.close();
`);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const error = formData.get("error");
    if (error) throw new Error(String(error));

    const identityToken = String(formData.get("id_token") || "");
    const userRaw = formData.get("user");
    let user = {};
    if (userRaw) {
      try {
        user = JSON.parse(String(userRaw));
      } catch {}
    }
    const name = user?.name || {};
    const displayName = [name.firstName, name.lastName].filter(Boolean).join(" ").trim();
    const email = user?.email || "";

    const session = await createFirebaseAppleSession({ identityToken, displayName, email });
    return sendToOpener({ source: "dishlist-apple-auth", ok: true, ...session });
  } catch (error) {
    console.error("Web Apple sign in failed:", error);
    return sendToOpener({
      source: "dishlist-apple-auth",
      ok: false,
      error: error.message || "Apple sign in failed.",
    });
  }
}

export async function GET() {
  return htmlResponse("window.close();");
}
