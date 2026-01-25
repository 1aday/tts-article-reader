import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Enhanced Ambient background glow with animation */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.15),transparent_50%)] animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,212,255,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(168,85,247,0.08),transparent_50%)]" />

      <div className="relative">
        {/* Hero Section */}
        <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-7xl w-full space-y-16 sm:space-y-20 text-center">
            {/* Main Title with Animations */}
            <div className="space-y-8 sm:space-y-10 animate-fadeInUp">
              <div className="inline-block">
                <h1 className="text-7xl sm:text-8xl md:text-9xl font-extrabold tracking-tighter mb-4 sm:mb-6 relative">
                  <span className="bg-gradient-to-br from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,136,0.3)]">
                    TTS
                  </span>
                </h1>
                <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-terminal-green to-terminal-cyan rounded-full animate-shimmer" />
              </div>

              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white/80 max-w-4xl mx-auto leading-[1.7] px-4 font-light">
                Transform any article into{" "}
                <span className="gradient-terminal font-semibold">natural-sounding audio</span>
                {" "}with AI
              </p>
            </div>

            {/* CTA Buttons with Enhanced Interactions */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center pt-8 sm:pt-12 px-4 animate-fadeInUp stagger-1">
              <Link href="/create" className="w-full sm:w-auto group">
                <Button
                  size="xl"
                  className="w-full sm:w-auto bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 text-xl font-bold shadow-2xl shadow-[#00ff88]/30 hover:shadow-[#00ff88]/50 transition-all"
                >
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 rounded-lg bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
              </Link>
              <Link href="/library" className="w-full sm:w-auto">
                <Button
                  size="xl"
                  className="w-full sm:w-auto bg-transparent border-2 border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10 hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] text-xl font-bold transition-all"
                >
                  View Library
                </Button>
              </Link>
            </div>

            {/* Enhanced Features Grid with Animations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pt-16 sm:pt-24 px-4">
              {[
                {
                  icon: "📰",
                  label: "Scrape",
                  desc: "Extract clean text from any article URL",
                  color: "from-[#00ff88]/10 to-[#00d4ff]/10"
                },
                {
                  icon: "🤖",
                  label: "Enhance",
                  desc: "AI optimizes text for natural speech",
                  color: "from-[#a855f7]/10 to-[#ec4899]/10"
                },
                {
                  icon: "🎙️",
                  label: "Generate",
                  desc: "25+ premium ElevenLabs voices",
                  color: "from-[#3b82f6]/10 to-[#00d4ff]/10"
                },
                {
                  icon: "🎧",
                  label: "Listen",
                  desc: "Background playback anywhere",
                  color: "from-[#00ff88]/10 to-[#a855f7]/10"
                }
              ].map((feature, i) => (
                <div
                  key={i}
                  className={`group relative animate-fadeInUp stagger-${i + 2}`}
                >
                  {/* Glow effect on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl`} />

                  {/* Card with glass effect */}
                  <div className="relative bg-surface-1 backdrop-blur-md border-2 border-white/10 rounded-3xl p-8 hover:border-[#00ff88]/30 transition-all duration-300 hover:transform hover:scale-105 hover:-translate-y-2 hover:shadow-2xl">
                    {/* Icon with float animation */}
                    <div className="text-5xl sm:text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>

                    {/* Title with gradient */}
                    <h3 className="text-xl sm:text-2xl font-bold text-[#00ff88] mb-3 group-hover:text-[#00d4ff] transition-colors duration-300">
                      {feature.label}
                    </h3>

                    {/* Description with better line height */}
                    <p className="text-base text-white/70 leading-[1.7]">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="border-t border-white/10 backdrop-blur-xl bg-surface-1/50 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 text-center md:text-left">
              <div className="text-sm sm:text-base text-white/60">
                <span className="text-[#00ff88] font-semibold text-lg">10</span> scrapes • <span className="text-[#00ff88] font-semibold text-lg">5</span> generations per hour
              </div>
              <div className="flex items-center gap-4 sm:gap-8 text-sm text-white/50 flex-wrap justify-center">
                <span className="text-white/60">Powered by</span>
                <span className="text-white/70 font-mono hover:text-[#00ff88] transition-colors cursor-pointer">Firecrawl</span>
                <span className="text-white/30">•</span>
                <span className="text-white/70 font-mono hover:text-[#00d4ff] transition-colors cursor-pointer">OpenAI</span>
                <span className="text-white/30">•</span>
                <span className="text-white/70 font-mono hover:text-[#a855f7] transition-colors cursor-pointer">ElevenLabs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
