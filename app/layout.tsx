import type { Metadata } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Navigation } from "@/components/navigation";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { PersistentPlayer } from "@/components/PersistentPlayer";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  weight: "400",
});

export const metadata: Metadata = {
  title: "TTS Reader",
  description:
    "Convert any article into cinematic, natural-sounding audio with AI voice generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${bebasNeue.variable} antialiased pb-24`}
      >
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
