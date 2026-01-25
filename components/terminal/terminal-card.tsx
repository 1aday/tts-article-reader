import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TerminalCardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  glowOnHover?: boolean;
}

export function TerminalCard({
  children,
  title,
  className,
  glowOnHover = true,
}: TerminalCardProps) {
  return (
    <div
      className={cn(
        "terminal-card rounded-lg p-6 relative",
        glowOnHover && "hover:scale-[1.01] transition-transform",
        className
      )}
    >
      {title && (
        <div className="absolute -top-3 left-4 px-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded">
          <span className="text-sm terminal-glow">┌─ {title} ─┐</span>
        </div>
      )}
      <div className="pt-2">{children}</div>
    </div>
  );
}
