import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";

export const runtime = "nodejs";

const APPLE_ISSUER = "https://appleid.apple.com";
const ALLOWED_AUDIENCES = new Set([
  "com.giovanniaccinelli.dishlist",
  "com.giovanniaccinelli.dishlist.web",
]);

const base64UrlDecode = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
};

const parseJwt = (token) => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Invalid Apple identity token.");
  return {
    header: JSON.parse(base64UrlDecode(header).toString("utf8")),
    payload: JSON.parse(base64UrlDecode(payload).toString("utf8")),
    signature: base64UrlDecode(signature),
    signingInput: `${header}.${payload}`,
  };
};

const getAppleKey = async (kid) => {
  const response = await fetch("https://appleid.apple.com/auth/keys", {
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error("Could not fetch Apple sign-in keys.");
  const { keys = [] } = await response.json();
  const key = keys.find((item) => item.kid === kid);
  if (!key) throw new Error("Apple sign-in key not found.");
  return crypto.createPublicKey({ key, format: "jwk" });
};

const verifyAppleToken = async (identityToken, expectedNonce) => {
  const parsed = parseJwt(identityToken);
  if (!["RS256", "ES256"].includes(parsed.header.alg)) {
    throw new Error(`Invalid Apple token algorithm: ${parsed.header.alg}`);
  }

  const publicKey = await getAppleKey(parsed.header.kid);
  const verifier = crypto.createVerify("SHA256");
  verifier.update(parsed.signingInput);
  verifier.end();
  const valid =
    parsed.header.alg === "ES256"
      ? verifier.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, parsed.signature)
      : verifier.verify(publicKey, parsed.signature);
  if (!valid) throw new Error("Invalid Apple identity token signature.");

  const now = Math.floor(Date.now() / 1000);
  if (parsed.payload.iss !== APPLE_ISSUER) throw new Error("Invalid Apple token issuer.");
  if (!ALLOWED_AUDIENCES.has(parsed.payload.aud)) throw new Error("Invalid Apple token audience.");
  if (!parsed.payload.sub) throw new Error("Apple token is missing the user id.");
  if (parsed.payload.exp && parsed.payload.exp < now) throw new Error("Apple token expired.");
  if (expectedNonce && parsed.payload.nonce && parsed.payload.nonce !== expectedNonce) {
    throw new Error("Invalid Apple token nonce.");
  }

  return parsed.payload;
};

const getAdminAuth = () => {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase Admin credentials are missing on the server.");
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getAuth();
};

export async function POST(request) {
  try {
    const { identityToken, displayName = "", email = "", nonce = "" } = await request.json();
    if (!identityToken) throw new Error("Missing Apple identity token.");

    const appleUser = await verifyAppleToken(identityToken, nonce);
    const auth = getAdminAuth();
    const uid = `apple:${appleUser.sub}`;
    const resolvedEmail = email || appleUser.email || undefined;
    const resolvedName = displayName || undefined;

    try {
      await auth.getUser(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
      await auth.createUser({
        uid,
        email: resolvedEmail,
        displayName: resolvedName,
      });
    }

    const updates = {};
    if (resolvedEmail) updates.email = resolvedEmail;
    if (resolvedName) updates.displayName = resolvedName;
    if (Object.keys(updates).length) {
      await auth.updateUser(uid, updates).catch(() => {});
    }

    const customToken = await auth.createCustomToken(uid, {
      provider: "apple.com",
      appleSub: appleUser.sub,
    });

    return Response.json({
      customToken,
      displayName: resolvedName || "",
      email: resolvedEmail || "",
    });
  } catch (error) {
    console.error("Native Apple sign in failed:", error);
    return Response.json({ error: error.message || "Apple sign in failed." }, { status: 400 });
  }
}
