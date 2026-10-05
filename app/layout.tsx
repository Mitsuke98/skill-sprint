import "./globals.css";
import type { Metadata, Viewport } from "next";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = { title: "Skill Sprint", description: "Turn YouTube channels into gamified courses with notes, flashcards and real-world practice." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" />
      </head>
      <body>
        <TopBar />
        {children}
        <canvas id="confetti" aria-hidden="true" />
      </body>
    </html>
  );
}
