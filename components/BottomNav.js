"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Plus, Search, ShoppingCart, User } from "lucide-react";
import { useAuth } from "../app/lib/auth";
import { useEffect, useState } from "react";
import AuthPromptModal from "./AuthPromptModal";
import { useLanguage } from "./LanguageProvider";
import { DISH_MODE_COOKING } from "./DishModeControls";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [globalDishMode, setGlobalDishModeState] = useState("");
  const profileHref = "/profile";
  const showShoppingListTab = globalDishMode === DISH_MODE_COOKING;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const readMode = (event) => {
      const nextMode = String(event?.detail || window.localStorage.getItem("dish-mode:global") || "").trim().toLowerCase();
      setGlobalDishModeState(nextMode);
    };
    readMode();
    window.addEventListener("dish-mode:change", readMode);
    window.addEventListener("storage", readMode);
    return () => {
      window.removeEventListener("dish-mode:change", readMode);
      window.removeEventListener("storage", readMode);
    };
  }, []);

  const navItems = [
    { href: "/", icon: Home, label: "feed" },
    { href: "/explore", icon: Search, label: "explore" },
    { href: "/upload?direct=1", icon: Plus, label: "upload", requiresAuth: true, prominent: true },
    showShoppingListTab
      ? { href: "/shopping-list", icon: ShoppingCart, label: "lista", requiresAuth: true }
      : { href: "/map", icon: Map, label: "mappa" },
    { href: profileHref, icon: User, label: "profile", requiresAuth: true },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/" || pathname === "/feed";
    if (href === "/profile") return pathname.startsWith("/profile");
    if (href === "/map") return pathname === "/map";
    if (href === "/shopping-list") return pathname === "/shopping-list";
    return pathname === href;
  };

  return (
    <>
      <div className="bottom-nav-shell">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const wrapperClass = "bottom-nav-item";
          const iconClass = item.prominent
            ? `bottom-nav-upload-btn no-accent-border w-[3.45rem] h-[2.55rem] rounded-2xl flex items-center justify-center shadow-md transition-all bg-black text-white ${
                active ? "scale-105" : ""
              }`
            : `no-accent-border w-[4.75rem] h-[3.55rem] rounded-2xl flex items-center justify-center transition-all ${
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
                <div className="flex items-center justify-center">
                  <div
                    className={
                      item.prominent
                        ? "bottom-nav-upload-btn no-accent-border w-[3.45rem] h-[2.55rem] rounded-2xl flex items-center justify-center bg-black text-white shadow-md"
                        : "no-accent-border w-[4.75rem] h-[3.55rem] rounded-2xl flex items-center justify-center transition-colors bg-transparent text-black/45"
                    }
                  >
                    <Icon size={item.prominent ? 25 : 27} />
                  </div>
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
              <div className="flex items-center justify-center">
                <div className={iconClass}>
                  {item.label === "profile" && user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "Profile"}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <Icon size={item.prominent ? 25 : 27} />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <AuthPromptModal open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </>
  );
}
