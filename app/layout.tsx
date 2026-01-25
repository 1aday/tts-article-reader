import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Navigation } from "@/components/navigation";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { PersistentPlayer } from "@/components/PersistentPlayer";

export const metadata: Metadata = {
  title: "TTS Reader - Transform Articles into Audio",
  description: "Convert any article into natural-sounding audio with AI-powered text-to-speech. Powered by Firecrawl, OpenAI, and ElevenLabs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased pb-24">
        <PlayerProvider>
          <Navigation />
          {children}
          <PersistentPlayer />
          <Toaster />
        </PlayerProvider>
      </body>
    </html>
  );
}
