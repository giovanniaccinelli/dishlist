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
    { href: "/dishlists", icon: LayoutGrid, label: "people" },
    { href: "/upload", icon: Plus, label: "upload", requiresAuth: true, prominent: true },
    { href: "/dishes", icon: Utensils, label: "explore" },
    { href: profileHref, icon: User, label: "profile", requiresAuth: true },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/" || pathname === "/feed";
    if (href === "/profile") return pathname.startsWith("/profile");
    return pathname === href;
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-black/10 flex items-center py-2 z-50">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const wrapperClass = item.prominent
            ? "w-1/5 flex flex-col items-center text-xs font-semibold -mt-7"
            : "w-1/5 flex flex-col items-center text-xs font-semibold";
          const iconClass = item.prominent
            ? `w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${
                active ? "bg-black text-white scale-105" : "bg-black text-white"
              }`
            : `w-14 h-9 rounded-2xl flex items-center justify-center transition-colors ${
                active ? "bg-black text-white" : "bg-transparent text-black/45"
              }`;
          const labelClass = item.prominent
            ? "mt-1 text-[10px] text-black/60"
            : `mt-1 ${active ? "text-black" : "text-black/45"}`;

          if (item.requiresAuth && !user) {
            return (
              <button
                key={item.label}
                onClick={() => setShowAuthPrompt(true)}
                className={wrapperClass}
                type="button"
              >
                <div className={item.prominent ? "w-14 h-14 rounded-2xl flex items-center justify-center bg-black text-white shadow-lg" : "w-14 h-9 rounded-2xl flex items-center justify-center transition-colors bg-transparent text-black/45"}>
                  <Icon size={item.prominent ? 28 : 22} />
                </div>
                {!item.prominent ? <span className="mt-1 text-black/45">{item.label}</span> : <span className={labelClass}>upload</span>}
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
                <Icon size={item.prominent ? 28 : 22} />
              </div>
              {!item.prominent ? <span className={labelClass}>{item.label}</span> : <span className={labelClass}>upload</span>}
            </Link>
          );
        })}
      </div>
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </>
  );
}
