"use client";

import { useEffect } from "react";

export default function GlobalError({ reset }) {
  useEffect(() => {
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch {}
    })();
  }, []);

  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#050505", color: "white", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>DishList</h1>
            <p style={{ opacity: 0.65, lineHeight: 1.5 }}>Ho pulito la cache dell&apos;app. Riprova ora.</p>
            <button
              type="button"
              onClick={() => {
                reset();
                window.location.reload();
              }}
              style={{
                border: "1px solid rgba(255,255,255,.18)",
                borderRadius: 999,
                background: "white",
                color: "black",
                fontWeight: 800,
                padding: "12px 18px",
              }}
            >
              Ricarica
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
