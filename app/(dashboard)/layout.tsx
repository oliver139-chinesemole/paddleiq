import { Toaster } from "sonner";
import { BottomNav } from "@/components/nav/bottom-nav";
import { TopNav } from "@/components/nav/top-nav";
import { InstallBanner } from "@/components/ui/install-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0F1E]">
      <TopNav />
      <main className="flex-1 pb-24 max-w-2xl mx-auto w-full px-4">
        {children}
      </main>
      <BottomNav />
      <InstallBanner />
      {/*
        Sonner was a dependency and eighteen toast() calls were spread across
        the team pages, but no Toaster had ever been mounted — so none of them
        rendered. Every confirmation was invisible, and so was every failure:
        "Failed to create team. Try again." gave the athlete nothing at all.

        Both offsets are set deliberately: sonner ignores `offset` at mobile
        widths and uses `mobileOffset` instead, which defaults to 16px. With
        only `offset` the toast sat over the bottom navigation on exactly the
        phone-sized screens this app is built for — a smoke test measuring the
        gap caught it.
      */}
      <Toaster
        theme="dark"
        position="bottom-center"
        offset="6rem"
        mobileOffset="6rem"
        richColors
        toastOptions={{
          style: {
            background: "#0D1528",
            border: "1px solid #1E293B",
            color: "#F1F5F9",
          },
        }}
      />
    </div>
  );
}
