"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../app/lib/auth";
import { useSearchParams } from "next/navigation";

export default function DebugBanner() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [lastSave, setLastSave] = useState(null);

  const enabled = useMemo(() => params?.get("debug") === "1", [params]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof globalThis !== "undefined" && globalThis.__lastSave) {
        setLastSave({ ...globalThis.__lastSave });
      }
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-black text-white text-xs px-3 py-2 flex flex-wrap gap-3">
      <div>projectId: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</div>
      <div>storageBucket: {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}</div>
      <div>authDomain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}</div>
      <div>uid: {user?.uid || "none"}</div>
      {lastSave ? (
        <div>
          lastSave: {lastSave.ok ? "OK" : "FAIL"} · {lastSave.dishId}
          {lastSave.error ? ` · ${lastSave.error}` : ""}
        </div>
      ) : (
        <div>lastSave: none</div>
      )}
    </div>
  );
}
