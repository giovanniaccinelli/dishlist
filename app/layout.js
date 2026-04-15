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
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[#F6F6F2]" />
          <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-[#FFB15E]/35 blur-3xl" />
          <div className="absolute right-[-4rem] top-20 h-64 w-64 rounded-full bg-[#7AD957]/20 blur-3xl" />
          <div className="absolute bottom-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#FF7A59]/15 blur-3xl" />
        </div>
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
