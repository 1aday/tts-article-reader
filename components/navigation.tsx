"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, Library, Plus, Music } from "lucide-react";

export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show nav on home page
  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-xl font-bold gradient-terminal hover:opacity-80 transition-opacity"
          >
            <Music className="w-6 h-6" />
            <span className="hidden sm:inline">TTS Reader</span>
          </button>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => router.push("/")}
              variant="ghost"
              size="sm"
              className={`${
                pathname === "/"
                  ? "bg-[#00ff88]/20 text-[#00ff88]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>

            <Button
              onClick={() => router.push("/library")}
              variant="ghost"
              size="sm"
              className={`${
                pathname === "/library"
                  ? "bg-[#00ff88]/20 text-[#00ff88]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Library className="w-4 h-4 mr-2" />
              Library
            </Button>

            <Button
              onClick={() => router.push("/create")}
              size="sm"
              className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">New Article</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
