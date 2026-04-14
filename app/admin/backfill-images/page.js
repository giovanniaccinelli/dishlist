"use client";

import { useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";

function getSourceUrl(dish) {
  return dish?.imageURL || dish?.imageUrl || dish?.image_url || dish?.image || "";
}

function needsBackfill(dish) {
  const source = getSourceUrl(dish);
  if (!source || source.startsWith("/") || source === "undefined" || source === "null") return false;
  return !dish.cardURL || !dish.thumbURL;
}

async function resizeUrlToBlob(url, maxSize, quality) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  const sourceBlob = await response.blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not resize image");
  return blob;
}

async function uploadBlob(blob, path) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

export default function BackfillDishImagesPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("Idle");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const log = (line) => setLogs((prev) => [line, ...prev].slice(0, 80));

  const runBackfill = async (limit = 0) => {
    if (!user) {
      setStatus("Log in first.");
      return;
    }
    setRunning(true);
    setLogs([]);
    try {
      setStatus("Scanning dishes...");
      const snap = await getDocs(collection(db, "dishes"));
      const candidates = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(needsBackfill);
      const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
      setStatus(`Found ${candidates.length}. Processing ${selected.length}...`);

      let done = 0;
      let failed = 0;
      for (const dish of selected) {
        try {
          const sourceUrl = getSourceUrl(dish);
          const [cardBlob, thumbBlob] = await Promise.all([
            resizeUrlToBlob(sourceUrl, 1400, 0.82),
            resizeUrlToBlob(sourceUrl, 420, 0.72),
          ]);
          const basePath = `dishImageVariants/${dish.id}`;
          const [cardURL, thumbURL] = await Promise.all([
            uploadBlob(cardBlob, `${basePath}/card.jpg`),
            uploadBlob(thumbBlob, `${basePath}/thumb.jpg`),
          ]);
          await updateDoc(doc(db, "dishes", dish.id), { cardURL, thumbURL });
          done += 1;
          log(`OK ${done}/${selected.length}: ${dish.name || dish.id}`);
        } catch (err) {
          failed += 1;
          log(`FAILED ${dish.name || dish.id}: ${err.message}`);
        }
        setStatus(`Updated ${done}, failed ${failed}, remaining ${selected.length - done - failed}.`);
      }
      setStatus(`Done. Updated ${done}, failed ${failed}.`);
    } catch (err) {
      setStatus(`Backfill failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen p-6 text-black">
      <h1 className="text-3xl font-bold mb-3">Dish Image Backfill</h1>
      <p className="mb-5 text-sm text-black/65">
        Adds cardURL and thumbURL to old dishes. It does not delete originals.
      </p>
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm border border-black/10">{status}</div>
      <div className="flex gap-3 mb-6">
        <button
          type="button"
          disabled={running || !user}
          onClick={() => runBackfill(5)}
          className="rounded-full bg-black px-5 py-3 text-white font-semibold disabled:opacity-50"
        >
          Test 5
        </button>
        <button
          type="button"
          disabled={running || !user}
          onClick={() => runBackfill(0)}
          className="rounded-full bg-[#1E8A4C] px-5 py-3 text-white font-semibold disabled:opacity-50"
        >
          Run All
        </button>
      </div>
      {!user ? <div className="text-red-600 font-semibold">You must be logged in.</div> : null}
      <div className="space-y-2 text-sm font-mono">
        {logs.map((line, idx) => (
          <div key={`${line}-${idx}`} className="rounded-xl bg-white p-3 shadow-sm border border-black/5">
            {line}
          </div>
        ))}
      </div>
    </main>
  );
}
