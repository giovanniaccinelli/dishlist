import crypto from "node:crypto";

const bundleIdentifier = process.env.BUNDLE_ID || "com.giovanniaccinelli.dishlist";
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID || process.env.ASC_ISSUER_ID;
const keyId = process.env.APP_STORE_CONNECT_KEY_IDENTIFIER || process.env.APP_STORE_CONNECT_KEY_ID || process.env.ASC_KEY_ID;
const privateKeyRaw =
  process.env.APP_STORE_CONNECT_PRIVATE_KEY ||
  process.env.APP_STORE_CONNECT_API_KEY ||
  process.env.ASC_PRIVATE_KEY;

const apiBase = "https://api.appstoreconnect.apple.com/v1";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function derToJose(signature) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("Invalid ECDSA signature.");
  const sequenceLength = signature[offset++];
  if (sequenceLength + 2 !== signature.length) throw new Error("Invalid ECDSA signature length.");
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA R marker.");
  const rLength = signature[offset++];
  let r = signature.subarray(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA S marker.");
  const sLength = signature[offset++];
  let s = signature.subarray(offset, offset + sLength);

  if (r.length > 32) r = r.subarray(r.length - 32);
  if (s.length > 32) s = s.subarray(s.length - 32);

  const jose = Buffer.alloc(64);
  r.copy(jose, 32 - r.length);
  s.copy(jose, 64 - s.length);
  return base64url(jose);
}

function normalizePrivateKey(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) return trimmed.replace(/\\n/g, "\n");
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  return decoded.includes("BEGIN PRIVATE KEY") ? decoded : trimmed.replace(/\\n/g, "\n");
}

function makeToken() {
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!issuerId || !keyId || !privateKey) {
    throw new Error(
      "Missing App Store Connect API credentials. Expected APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_KEY_IDENTIFIER, and APP_STORE_CONNECT_PRIVATE_KEY."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = derToJose(signer.sign(privateKey));
  return `${signingInput}.${signature}`;
}

async function request(path, { method = "GET" } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }
  return data;
}

const token = makeToken();

const bundleQuery = new URLSearchParams({ "filter[identifier]": bundleIdentifier, limit: "1" });
const bundleResponse = await request(`/bundleIds?${bundleQuery}`);
const bundle = bundleResponse.data?.[0];

if (!bundle) {
  throw new Error(`No Apple bundle ID found for ${bundleIdentifier}.`);
}

console.log(`Found Apple bundle ID ${bundle.id} for ${bundleIdentifier}.`);

const capabilityQuery = new URLSearchParams({ "filter[capabilityType]": "SIGN_IN_WITH_APPLE" });
const capabilities = await request(`/bundleIds/${bundle.id}/bundleIdCapabilities?${capabilityQuery}`);
const appleSignInCapability = capabilities.data?.find(
  (capability) => capability.attributes?.capabilityType === "SIGN_IN_WITH_APPLE"
);

if (!appleSignInCapability) {
  throw new Error(
    `The Apple App ID ${bundleIdentifier} does not have Sign in with Apple enabled. Enable it on the App ID, then rerun the build.`
  );
}

console.log("Sign in with Apple is enabled on the Apple App ID.");

const profileQuery = new URLSearchParams({
  "filter[bundleId]": bundle.id,
  "filter[profileType]": "IOS_APP_STORE",
  limit: "200",
});
const profilesResponse = await request(`/profiles?${profileQuery}`);
const profiles = profilesResponse.data || [];

if (!profiles.length) {
  console.log("No existing iOS App Store provisioning profiles to delete.");
  process.exit(0);
}

for (const profile of profiles) {
  console.log(`Deleting existing App Store provisioning profile: ${profile.attributes?.name || profile.id}`);
  await request(`/profiles/${profile.id}`, { method: "DELETE" });
}

console.log("Deleted existing App Store provisioning profiles. Codemagic will create a fresh profile with the current entitlements.");
