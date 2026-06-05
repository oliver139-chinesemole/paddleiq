"use client";

import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

export function TopNav({ title, subtitle, showBack }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1E293B] bg-[#0A0F1E]/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div>
          {title ? (
            <>
              <h1 className="text-base font-bold text-[#F1F5F9]">{title}</h1>
              {subtitle && <p className="text-xs text-[#64748B]">{subtitle}</p>}
            </>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-black gradient-text">PaddleIQ</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#0EA5E9]" />
          </Button>
          <Link href="/profile">
            <Button variant="ghost" size="icon">
              <Settings size={18} />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
