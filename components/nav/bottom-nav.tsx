"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Activity, BookOpen, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/analytics", label: "Track", icon: Activity },
  { href: "/technique", label: "Technique", icon: BookOpen },
  { href: "/team", label: "Team", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1E293B] bg-[#0A0F1E]/95 backdrop-blur-md">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors min-w-0",
                isActive
                  ? "text-[#0EA5E9]"
                  : "text-[#7C8AA0] hover:text-[#94A3B8]"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
