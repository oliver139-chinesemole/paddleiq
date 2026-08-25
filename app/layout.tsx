import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1 was blocking pinch-zoom. It's a common PWA reflex — it
  // stops iOS zooming when a small input is focused — but it also denies zoom
  // to anyone who needs it. The inputs here are already 16px, which is what
  // actually prevents that auto-zoom.
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0A0F1E",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PaddleIQ — Dragon Boat Training App",
  description:
    "The all-in-one training app for dragon boat athletes. Track erg sessions, water time trials, team practices, and improve your technique.",
  keywords: ["dragon boat", "paddling", "erg training", "water sports", "team training"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PaddleIQ",
  },
  icons: {
    apple: "/icons/icon-192.png",
    icon: "/icons/icon-192.png",
  },
  openGraph: {
    title: "PaddleIQ",
    description: "Train smarter. Paddle faster. Built for dragon boat athletes.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#0A0F1E] text-[#F1F5F9] antialiased">
        {children}
      </body>
    </html>
  );
}
