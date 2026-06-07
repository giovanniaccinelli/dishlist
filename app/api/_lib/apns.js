import crypto from "node:crypto";
import http2 from "node:http2";

const APNS_TEAM_ID = process.env.APPLE_TEAM_ID || "";
const APNS_KEY_ID = process.env.APPLE_KEY_ID || "";
const APNS_BUNDLE_ID = process.env.APPLE_PUSH_BUNDLE_ID || "com.giovanniaccinelli.dishlist";
const APNS_HOST_PRODUCTION = "https://api.push.apple.com";
const APNS_HOST_SANDBOX = "https://api.sandbox.push.apple.com";
const APNS_HOST = process.env.APPLE_PUSH_USE_SANDBOX === "1"
  ? APNS_HOST_SANDBOX
  : APNS_HOST_PRODUCTION;

let cachedJwt = "";
let cachedJwtExpiry = 0;

function normalizeApnsPrivateKey(rawValue = "", base64Value = "") {
  const normalizedBase64 = String(base64Value || "").trim();
  if (normalizedBase64) {
    try {
      const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8").trim();
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        return decoded.replace(/\r\n/g, "\n").trim();
      }
    } catch {}
  }

  let value = String(rawValue || "").trim();
  if (!value) return "";

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();

  if (!value.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = Buffer.from(value, "base64").toString("utf8").trim();
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        value = decoded.replace(/\r\n/g, "\n").trim();
      }
    } catch {}
  }

  return value;
}

const APNS_PRIVATE_KEY = normalizeApnsPrivateKey(
  process.env.APPLE_PUSH_PRIVATE_KEY,
  process.env.APPLE_PUSH_PRIVATE_KEY_BASE64
);

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

function buildAttemptHosts() {
  const alternateHost = APNS_HOST === APNS_HOST_PRODUCTION ? APNS_HOST_SANDBOX : APNS_HOST_PRODUCTION;
  return [APNS_HOST, alternateHost];
}

function sendToApnsHost(host, token, jwt, payload) {
  return new Promise((resolve) => {
    let client;
    try {
      client = http2.connect(host);
      client.on("error", (error) => {
        console.warn("APNs client connection failed:", host, error);
        try {
          client?.close();
        } catch {}
        resolve({ ok: false, host, error });
      });

      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });

      let responseHeaders = null;
      let responseBody = "";
      let resolved = false;

      request.setEncoding("utf8");
      request.on("response", (headers) => {
        responseHeaders = headers;
      });
      request.on("data", (chunk) => {
        responseBody += chunk;
      });
      request.on("error", (error) => {
        if (resolved) return;
        resolved = true;
        console.warn("APNs request failed:", host, error);
        try {
          client?.close();
        } catch {}
        resolve({ ok: false, host, error });
      });
      request.on("end", () => {
        if (resolved) return;
        resolved = true;
        const status = Number(responseHeaders?.[":status"] || 0);
        try {
          client?.close();
        } catch {}
        resolve({
          ok: status >= 200 && status < 300,
          host,
          status,
          body: responseBody,
        });
      });

      request.write(payload);
      request.end();
    } catch (error) {
      console.warn("APNs setup failed:", host, error);
      try {
        client?.close();
      } catch {}
      resolve({ ok: false, host, error });
    }
  });
}

export async function sendApnsNotifications(tokens = [], { title, body, url = "/", data = {} } = {}) {
  if (!Array.isArray(tokens) || !tokens.length) return { sent: 0, failed: 0, skipped: 0 };
  if (!isApnsConfigured()) return { sent: 0, failed: 0, skipped: tokens.length };

  console.log("APNs dispatch starting", {
    host: APNS_HOST,
    topic: APNS_BUNDLE_ID,
    sandbox: process.env.APPLE_PUSH_USE_SANDBOX === "1",
    tokenCount: tokens.length,
    title,
  });

  const jwt = getApnsJwt();
  let sent = 0;
  let failed = 0;

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 0,
    },
    data: {
      url,
      ...data,
    },
    url,
    ...data,
  });

  await Promise.all(
    tokens.map(
      (token) =>
        new Promise(async (resolve) => {
          try {
            const attemptHosts = buildAttemptHosts();
            let deliveryResult = null;
            for (const host of attemptHosts) {
              const result = await sendToApnsHost(host, token, jwt, payload);
              if (result.ok) {
                deliveryResult = result;
                break;
              }
              deliveryResult = result;
            }

            if (deliveryResult?.ok) {
              sent += 1;
            } else {
              failed += 1;
              console.warn("APNs send failed after host attempts:", {
                tokenSuffix: String(token || "").slice(-8),
                attempts: attemptHosts,
                lastStatus: deliveryResult?.status || 0,
                lastBody: deliveryResult?.body || "",
                lastHost: deliveryResult?.host || "",
                lastError: deliveryResult?.error?.message || "",
              });
            }
          } catch (error) {
            failed += 1;
            console.warn("APNs unexpected send failure:", error);
          } finally {
            resolve();
          }
        })
    )
  );

  return { sent, failed, skipped: 0 };
}
