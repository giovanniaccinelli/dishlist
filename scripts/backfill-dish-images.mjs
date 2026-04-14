import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const execFileAsync = promisify(execFile);

const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback = "") => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};
const dryRun = args.has("--dry-run");
const limit = Number(getArgValue("--limit", "0")) || 0;

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig).filter(([, value]) => !value);
if (missing.length) {
  console.error("Missing Firebase env vars:", missing.map(([key]) => key).join(", "));
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function getSourceUrl(dish) {
  return dish?.imageURL || dish?.imageUrl || dish?.image_url || dish?.image || "";
}

function needsBackfill(dish) {
  const source = getSourceUrl(dish);
  if (!source || source.startsWith("/") || source === "undefined" || source === "null") return false;
  return !dish.cardURL || !dish.thumbURL;
}

async function downloadImage(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(filePath, buffer);
}

async function resizeWithSips(inputPath, outputPath, maxSize) {
  await execFileAsync("sips", ["-s", "format", "jpeg", "-Z", String(maxSize), inputPath, "--out", outputPath]);
}

async function uploadVariant(filePath, storagePath) {
  const buffer = await fs.promises.readFile(filePath);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, buffer, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

const snap = await getDocs(collection(db, "dishes"));
const candidates = snap.docs
  .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
  .filter(needsBackfill);
const selected = limit > 0 ? candidates.slice(0, limit) : candidates;

console.log(`Found ${candidates.length} dishes needing image backfill.`);
console.log(dryRun ? `Dry run: would process ${selected.length}.` : `Processing ${selected.length}.`);

if (dryRun) process.exit(0);

let done = 0;
let failed = 0;

for (const dish of selected) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `dish-${dish.id}-`));
  const originalPath = path.join(tmpDir, "original");
  const cardPath = path.join(tmpDir, "card.jpg");
  const thumbPath = path.join(tmpDir, "thumb.jpg");
  try {
    const sourceUrl = getSourceUrl(dish);
    await downloadImage(sourceUrl, originalPath);
    await Promise.all([
      resizeWithSips(originalPath, cardPath, 1400),
      resizeWithSips(originalPath, thumbPath, 420),
    ]);
    const basePath = `dishImageVariants/${dish.id}`;
    const [cardURL, thumbURL] = await Promise.all([
      uploadVariant(cardPath, `${basePath}/card.jpg`),
      uploadVariant(thumbPath, `${basePath}/thumb.jpg`),
    ]);
    await updateDoc(doc(db, "dishes", dish.id), { cardURL, thumbURL });
    done += 1;
    console.log(`Backfilled ${done}/${selected.length}: ${dish.name || dish.id}`);
  } catch (err) {
    failed += 1;
    console.error(`Failed ${dish.id} (${dish.name || "Untitled"}):`, err.message);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

console.log(`Backfill complete. Updated ${done}, failed ${failed}.`);
