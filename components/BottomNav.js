"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: <Home size={24} />, label: "Home" },
    { href: "/explore", icon: <Search size={24} />, label: "Explore" },
    { href: "/profile", icon: <User size={24} />, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-[#1A1A1A] border-t border-gray-800 flex justify-around items-center py-3">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center ${
            pathname === item.href ? "text-red-500" : "text-gray-400"
          }`}
        >
          {item.icon}
        </Link>
      ))}
    </div>
  );
}
