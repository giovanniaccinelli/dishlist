"use client";

import "./globals.css";
import { AuthProvider } from "./lib/auth";
import DebugBanner from "../components/DebugBanner";
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DebugBanner />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
