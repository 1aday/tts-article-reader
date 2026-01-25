"use client";

export function ScanLines() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          )`,
          animation: "scan 8s linear infinite",
        }}
      />
    </div>
  );
}
