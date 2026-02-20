"use client";

import "./globals.css";
import { AuthProvider } from "./lib/auth";
import DebugBanner from "../components/DebugBanner";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DishList" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body>
        <AuthProvider>
          <ServiceWorkerRegister />
          <DebugBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
