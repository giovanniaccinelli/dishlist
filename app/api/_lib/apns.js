import crypto from "node:crypto";

const APNS_TEAM_ID = process.env.APPLE_TEAM_ID || "";
const APNS_KEY_ID = process.env.APPLE_KEY_ID || "";
const APNS_PRIVATE_KEY = process.env.APPLE_PUSH_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
const APNS_BUNDLE_ID = process.env.APPLE_PUSH_BUNDLE_ID || "com.giovanniaccinelli.dishlist";
const APNS_HOST = process.env.APPLE_PUSH_USE_SANDBOX === "1"
  ? "https://api.sandbox.push.apple.com"
  : "https://api.push.apple.com";

let cachedJwt = "";
let cachedJwtExpiry = 0;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getApnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwtExpiry - 60 > now) return cachedJwt;
  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_PRIVATE_KEY) {
    throw new Error("APNs credentials are missing.");
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = base64UrlEncode(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign("sha256");
  signer.update(signingInput);
  signer.end();
  const signature = signer
    .sign({ key: APNS_PRIVATE_KEY, dsaEncoding: "ieee-p1363" })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  cachedJwt = `${signingInput}.${signature}`;
  cachedJwtExpiry = now + 50 * 60;
  return cachedJwt;
}

export function isApnsConfigured() {
  return Boolean(APNS_TEAM_ID && APNS_KEY_ID && APNS_PRIVATE_KEY && APNS_BUNDLE_ID);
}

export async function sendApnsNotifications(tokens = [], { title, body, url = "/", data = {} } = {}) {
  if (!Array.isArray(tokens) || !tokens.length) return { sent: 0, failed: 0, skipped: 0 };
  if (!isApnsConfigured()) return { sent: 0, failed: 0, skipped: tokens.length };

  const jwt = getApnsJwt();
  let sent = 0;
  let failed = 0;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const response = await fetch(`${APNS_HOST}/3/device/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${jwt}`,
            "apns-topic": APNS_BUNDLE_ID,
            "apns-push-type": "alert",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            aps: {
              alert: { title, body },
              sound: "default",
            },
            url,
            ...data,
          }),
        });
        if (response.ok) {
          sent += 1;
          return;
        }
        failed += 1;
        const errorText = await response.text().catch(() => "");
        console.warn("APNs send failed:", response.status, errorText);
      } catch (error) {
        failed += 1;
        console.warn("APNs request failed:", error);
      }
    })
  );

  return { sent, failed, skipped: 0 };
}
