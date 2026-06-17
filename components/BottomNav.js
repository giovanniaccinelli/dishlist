"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Plus, Search, User } from "lucide-react";
import { useAuth } from "../app/lib/auth";
import { useState } from "react";
import AuthPromptModal from "./AuthPromptModal";
import { useLanguage } from "./LanguageProvider";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const profileHref = "/profile";

  const navItems = [
    { href: "/", icon: Home, label: "feed" },
    { href: "/explore", icon: Search, label: "explore" },
    { href: "/upload?direct=1", icon: Plus, label: "upload", requiresAuth: true, prominent: true },
    { href: "/map", icon: Map, label: "mappa" },
    { href: profileHref, icon: User, label: "profile", requiresAuth: true },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/" || pathname === "/feed";
    if (href === "/profile") return pathname.startsWith("/profile");
    if (href === "/map") return pathname === "/map";
    return pathname === href;
  };

  const getAccent = (label) => {
    if (label === "feed") return "bg-[#E64646]";
    if (label === "mappa") return "bg-[#E64646]";
    if (label === "explore") return "bg-[#E64646]";
    if (label === "profile") return "bg-[#E64646]";
    return "bg-[#E64646]";
  };

  return (
    <>
      <div className="bottom-nav-shell">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const wrapperClass = "bottom-nav-item";
          const accentClass = getAccent(item.label);
          const iconClass = item.prominent
            ? `bottom-nav-upload-btn no-accent-border w-14 h-11 rounded-2xl flex items-center justify-center shadow-md transition-all bg-black text-white ${
                active ? "scale-105" : ""
              }`
            : `no-accent-border w-14 h-11 rounded-2xl flex items-center justify-center transition-all ${
                active ? "bg-[#E64646]/8 text-[#E64646]" : "bg-transparent text-black/45"
              }`;
          if (item.requiresAuth && !user) {
            return (
              <button
                key={item.label}
                onClick={() => setShowAuthPrompt(true)}
                className={wrapperClass}
                type="button"
              >
                <div className="flex flex-col items-center gap-0">
                  <div
                    className={
                      item.prominent
                        ? "bottom-nav-upload-btn no-accent-border w-14 h-11 rounded-2xl flex items-center justify-center bg-black text-white shadow-md"
                        : "no-accent-border w-14 h-11 rounded-2xl flex items-center justify-center transition-colors bg-transparent text-black/45"
                    }
                  >
                    <Icon size={item.prominent ? 26 : 22} />
                  </div>
                  {item.prominent ? <span className="invisible h-[3px] w-5" /> : <div className="h-[3px] w-5 -translate-y-1" />}
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={wrapperClass}
            >
              <div className="flex flex-col items-center gap-0">
                <div className={iconClass}>
                  {item.label === "profile" && user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "Profile"}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <Icon size={item.prominent ? 26 : 22} />
                  )}
                </div>
                {item.prominent ? (
                  <span className="invisible h-[3px] w-5" />
                ) : (
                  <div className="flex h-[3px] w-5 -translate-y-1 items-start justify-center">
                    <span className={`no-accent-border h-1.5 rounded-full transition-all ${active ? `w-5 ${accentClass}` : "w-0 bg-transparent"}`} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </>
  );
}
