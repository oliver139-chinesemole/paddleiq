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
    </div>
  );
}
