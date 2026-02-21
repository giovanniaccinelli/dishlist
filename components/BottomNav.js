"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Utensils, User } from "lucide-react";
import { useAuth } from "../app/lib/auth";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const profileHref = user ? "/profile" : "/?auth=1";

  const navItems = [
    { href: "/", icon: Home, label: "feed" },
    { href: "/dishlists", icon: LayoutGrid, label: "dishlists" },
    { href: "/dishes", icon: Utensils, label: "dishes" },
    { href: profileHref, icon: User, label: "profile" },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/" || pathname === "/feed";
    if (href === "/profile") return pathname.startsWith("/profile");
    return pathname === href;
  };

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-black/10 flex items-center py-2 z-50">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
        <Link
          key={item.href}
          href={item.href}
          className="w-1/4 flex flex-col items-center text-xs font-semibold"
        >
          <div
            className={`w-14 h-9 rounded-2xl flex items-center justify-center transition-colors ${
              active ? "bg-black text-white" : "bg-transparent text-black/45"
            }`}
          >
            <Icon size={22} />
          </div>
          <span className={`mt-1 ${active ? "text-black" : "text-black/45"}`}>{item.label}</span>
        </Link>
      );
      })}
    </div>
  );
}
