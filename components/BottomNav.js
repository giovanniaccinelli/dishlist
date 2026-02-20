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
    { href: "/", icon: <Home size={24} />, label: "feed" },
    { href: "/dishlists", icon: <LayoutGrid size={24} />, label: "dishlists" },
    { href: "/dishes", icon: <Utensils size={24} />, label: "dishes" },
    { href: profileHref, icon: <User size={24} />, label: "profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-black/10 flex justify-around items-center py-2 z-50">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center text-xs font-semibold ${
            pathname === item.href ? "text-black" : "text-black/40"
          }`}
        >
          {item.icon}
          <span className="mt-1">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
