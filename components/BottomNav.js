"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Plus, Utensils, User } from "lucide-react";
import { useAuth } from "../app/lib/auth";
import { useState } from "react";
import AuthPromptModal from "./AuthPromptModal";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const profileHref = "/profile";

  const navItems = [
    { href: "/", icon: Home, label: "feed" },
    { href: "/explore", icon: Utensils, label: "explore" },
    { href: "/upload", icon: Plus, label: "upload", requiresAuth: true, prominent: true },
    { href: "/dishlists", icon: LayoutGrid, label: "people" },
    { href: profileHref, icon: User, label: "profile", requiresAuth: true },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/" || pathname === "/feed";
    if (href === "/profile") return pathname.startsWith("/profile");
    return pathname === href;
  };

  const getAccent = (label) => {
    if (label === "feed") return "bg-[#FF7A59]";
    if (label === "people") return "bg-[#FFCC33]";
    if (label === "explore") return "bg-[#7AD957]";
    if (label === "profile") return "bg-black";
    return "bg-black";
  };

  return (
    <>
      <div
        className="fixed left-0 right-0 w-full translate-y-0 will-change-transform border-t border-black/10 bg-white/90 backdrop-blur-xl shadow-[0_-10px_24px_rgba(0,0,0,0.05)] flex items-start pt-0 pb-0 z-50"
        style={{
          bottom: "calc((env(safe-area-inset-bottom, 0px) + 14px) * -1)",
          height: "calc(60px + env(safe-area-inset-bottom, 0px) + 14px)",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const wrapperClass = "w-1/5 flex flex-col items-center justify-end text-xs font-semibold h-[60px]";
          const accentClass = getAccent(item.label);
          const iconClass = item.prominent
            ? `w-14 h-9 rounded-2xl flex items-center justify-center shadow-md transition-all bg-black text-white ${
                active ? "scale-105" : ""
              }`
            : `w-14 h-9 rounded-2xl flex items-center justify-center transition-all ${
                active ? "bg-black/[0.05] text-black" : "bg-transparent text-black/45"
              }`;
          const labelClass = `${active ? "text-black" : "text-black/45"}`;

          if (item.requiresAuth && !user) {
            return (
              <button
                key={item.label}
                onClick={() => setShowAuthPrompt(true)}
                className={wrapperClass}
                type="button"
              >
                <div
                  className={
                    item.prominent
                      ? "w-14 h-9 rounded-2xl flex items-center justify-center bg-black text-white shadow-md"
                      : "w-14 h-9 rounded-2xl flex items-center justify-center transition-colors bg-transparent text-black/45"
                  }
                >
                  <Icon size={item.prominent ? 26 : 22} />
                </div>
                {item.prominent ? (
                  <span className="mt-0.5 invisible">upload</span>
                ) : (
                  <div className="mt-0.5 flex flex-col items-center">
                    <span className="text-black/45">{item.label}</span>
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-transparent" />
                  </div>
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={wrapperClass}
            >
              <div className={iconClass}>
                <Icon size={item.prominent ? 26 : 22} />
              </div>
              {item.prominent ? (
                <span className="mt-0.5 invisible">upload</span>
              ) : (
                <div className="mt-0.5 flex flex-col items-center">
                  <span className={labelClass}>{item.label}</span>
                  <span className={`mt-0.5 h-1.5 rounded-full transition-all ${active ? `w-5 ${accentClass}` : "w-1.5 bg-black/12"}`} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </>
  );
}
