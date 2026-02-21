"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/create", label: "Create" },
];

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all",
        isHome
          ? "bg-gradient-to-b from-black/85 to-black/10 border-b border-transparent"
          : "border-b border-white/10 bg-[#07090d]/92 backdrop-blur-2xl"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-3 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-lg px-1 py-1 text-white transition"
        >
          <span className="font-display text-[2rem] leading-none tracking-[0.06em] text-[#e50914] sm:text-3xl">
            TTS
          </span>
          <span className="hidden text-sm font-semibold uppercase tracking-[0.16em] text-white/65 sm:inline">
            Reader
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          {navItems.map(({ href, label }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative px-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-colors sm:text-sm sm:tracking-[0.11em]",
                  active
                    ? "text-white"
                    : "text-white/65 hover:text-white"
                )}
              >
                {label}
                <span
                  className={cn(
                    "absolute -bottom-1.5 left-0 h-0.5 w-full origin-left bg-[#e50914] transition-transform sm:-bottom-2",
                    active ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
