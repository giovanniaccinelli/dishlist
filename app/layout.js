"use client";

import "./globals.css";
import Script from "next/script";
import { AuthProvider } from "./lib/auth";
import DebugBanner from "../components/DebugBanner";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";
import GoogleAnalytics from "../components/GoogleAnalytics";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RK0GKK67BN"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-RK0GKK67BN');
          `}
        </Script>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DishList" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <AuthProvider>
          <GoogleAnalytics />
          <ServiceWorkerRegister />
          <DebugBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
