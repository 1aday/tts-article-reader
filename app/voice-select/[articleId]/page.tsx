"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Pause,
  Search,
  Filter,
  X,
  Settings as SettingsIcon,
  Sliders,
  Star,
  Sparkles,
  Users,
  Briefcase,
  Mic2,
  User,
  Globe
} from "lucide-react";

interface Voice {
  id: string;
  name: string;
  category?: string;
  previewUrl?: string;
  labels?: Record<string, string>;
  isFavorite?: boolean;
}

interface AudioSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export default function VoiceSelectPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.articleId as string;

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "premade" | "cloned" | "professional">("all");

  // Audio generation settings
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
  });

  useEffect(() => {
    loadVoices();

    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, []);

  const loadVoices = async () => {
    try {
      const response = await fetch("/api/voices");
      const data = await response.json();

      if (!response.ok) {
        toast.error("Failed to load voices");
        return;
      }

      setVoices(data.voices || []);
    } catch (error) {
      toast.error("Failed to load voices");
    } finally {
      setLoading(false);
    }
  };

  // Extract unique filter values
  const categories = useMemo(() => {
    const cats = new Set(voices.map(v => v.category).filter(Boolean));
    return Array.from(cats);
  }, [voices]);

  const genders = useMemo(() => {
    const g = new Set(voices.map(v => v.labels?.gender).filter(Boolean));
    return Array.from(g);
  }, [voices]);

  const accents = useMemo(() => {
    const a = new Set(voices.map(v => v.labels?.accent).filter(Boolean));
    return Array.from(a);
  }, [voices]);

  const ages = useMemo(() => {
    const a = new Set(voices.map(v => v.labels?.age).filter(Boolean));
    return Array.from(a);
  }, [voices]);

  const useCases = useMemo(() => {
    const u = new Set(voices.map(v => v.labels?.use_case || v.labels?.["use case"]).filter(Boolean));
    return Array.from(u);
  }, [voices]);

  // Filtered voices
  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      // Tab filter
      if (activeTab !== "all") {
        if (activeTab === "premade" && voice.category !== "premade") return false;
        if (activeTab === "cloned" && voice.category !== "cloned") return false;
        if (activeTab === "professional" && voice.category !== "professional") return false;
      }

      // Search filter
      if (searchQuery && !voice.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory && voice.category !== selectedCategory) {
        return false;
      }

      // Gender filter
      if (selectedGender && voice.labels?.gender !== selectedGender) {
        return false;
      }

      // Accent filter
      if (selectedAccent && voice.labels?.accent !== selectedAccent) {
        return false;
      }

      // Age filter
      if (selectedAge && voice.labels?.age !== selectedAge) {
        return false;
      }

      // Use case filter
      if (selectedUseCase) {
        const voiceUseCase = voice.labels?.use_case || voice.labels?.["use case"];
        if (voiceUseCase !== selectedUseCase) return false;
      }

      return true;
    });
  }, [voices, searchQuery, selectedCategory, selectedGender, selectedAccent, selectedAge, selectedUseCase, activeTab]);

  const playPreview = (voice: Voice) => {
    if (!voice.previewUrl) {
      toast.error("No preview available for this voice");
      return;
    }

    if (playingPreview === voice.id) {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
      setPlayingPreview(null);
      setAudioElement(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }

      const audio = new Audio(voice.previewUrl);
      audio.addEventListener("ended", () => {
        setPlayingPreview(null);
        setAudioElement(null);
      });

      audio.play();
      setPlayingPreview(voice.id);
      setAudioElement(audio);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedGender(null);
    setSelectedAccent(null);
    setSelectedAge(null);
    setSelectedUseCase(null);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedGender || selectedAccent || selectedAge || selectedUseCase;

  const handleContinue = () => {
    if (!selectedVoice) {
      toast.error("Please select a voice");
      return;
    }

    // Encode settings as URL params
    const params = new URLSearchParams({
      voiceId: selectedVoice,
      stability: audioSettings.stability.toString(),
      similarityBoost: audioSettings.similarityBoost.toString(),
      style: audioSettings.style.toString(),
      useSpeakerBoost: audioSettings.useSpeakerBoost.toString(),
    });

    router.push(`/generate/${articleId}?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.08),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 text-xl text-white/60">
            <div className="w-6 h-6 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
            Loading voices...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.08),transparent_50%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
              Select Voice
            </h1>
            <p className="text-sm sm:text-base text-white/60">
              <span className="text-[#00ff88] font-medium">{filteredVoices.length}</span> of {voices.length} voices
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {[
              { id: "all", label: "All Voices", icon: Sparkles },
              { id: "premade", label: "Premade", icon: Star },
              { id: "cloned", label: "Cloned", icon: Users },
              { id: "professional", label: "Professional", icon: Briefcase },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black shadow-lg shadow-[#00ff88]/25"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search voices by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-2 h-11 rounded-xl font-semibold transition-all ${
                showFilters || hasActiveFilters
                  ? "border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10"
                  : "border-white/20 text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>

            {/* Settings Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className={`border-2 h-11 rounded-xl font-semibold transition-all ${
                showSettings
                  ? "border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/10"
                  : "border-white/20 text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>

          {/* Filter Chips */}
          {showFilters && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">Filter by:</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-white/50 hover:text-white/70 underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Category filters */}
              <div className="space-y-2">
                <div className="text-xs text-white/50">Category</div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        if (!cat) return;
                        const newValue: string | null = selectedCategory === cat ? null : cat;
                        setSelectedCategory(newValue);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        selectedCategory === cat
                          ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]"
                          : "border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/80"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender filters */}
              {genders.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/50">Gender</div>
                  <div className="flex flex-wrap gap-2">
                    {genders.map((gender) => (
                      <button
                        key={gender}
                        onClick={() => {
                          if (!gender) return;
                          const newValue: string | null = selectedGender === gender ? null : gender;
                          setSelectedGender(newValue);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedGender === gender
                            ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/80"
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Accent filters */}
              {accents.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/50">Accent</div>
                  <div className="flex flex-wrap gap-2">
                    {accents.map((accent) => (
                      <button
                        key={accent}
                        onClick={() => {
                          if (!accent) return;
                          const newValue: string | null = selectedAccent === accent ? null : accent;
                          setSelectedAccent(newValue);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedAccent === accent
                            ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/80"
                        }`}
                      >
                        {accent}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Age filters */}
              {ages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/50">Age</div>
                  <div className="flex flex-wrap gap-2">
                    {ages.map((age) => (
                      <button
                        key={age}
                        onClick={() => {
                          if (!age) return;
                          const newValue: string | null = selectedAge === age ? null : age;
                          setSelectedAge(newValue);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedAge === age
                            ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/80"
                        }`}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Use Case filters */}
              {useCases.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/50">Use Case</div>
                  <div className="flex flex-wrap gap-2">
                    {useCases.map((useCase) => (
                      <button
                        key={useCase}
                        onClick={() => {
                          if (!useCase) return;
                          const newValue: string | null = selectedUseCase === useCase ? null : useCase;
                          setSelectedUseCase(newValue);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedUseCase === useCase
                            ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]"
                            : "border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white/80"
                        }`}
                      >
                        {useCase}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio Settings Panel */}
          {showSettings && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 space-y-6">
              <div className="flex items-center gap-2 text-white">
                <SettingsIcon className="w-5 h-5 text-[#00d4ff]" />
                <span className="font-semibold">Audio Generation Settings</span>
              </div>

              {/* Stability */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-white/70">
                    Stability
                  </label>
                  <span className="text-sm font-mono text-[#00d4ff]">{audioSettings.stability.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.stability}
                  onChange={(e) => setAudioSettings({...audioSettings, stability: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <p className="text-xs text-white/50">Higher = more stable, lower = more variable</p>
              </div>

              {/* Similarity Boost */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-white/70">
                    Similarity Boost
                  </label>
                  <span className="text-sm font-mono text-[#00d4ff]">{audioSettings.similarityBoost.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.similarityBoost}
                  onChange={(e) => setAudioSettings({...audioSettings, similarityBoost: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <p className="text-xs text-white/50">Enhance similarity to original voice</p>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-white/70">
                    Style Exaggeration
                  </label>
                  <span className="text-sm font-mono text-[#00d4ff]">{audioSettings.style.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.style}
                  onChange={(e) => setAudioSettings({...audioSettings, style: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <p className="text-xs text-white/50">Higher = more expressive/exaggerated</p>
              </div>

              {/* Speaker Boost */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm text-white/70">Speaker Boost</label>
                  <p className="text-xs text-white/50">Enhance voice characteristics</p>
                </div>
                <button
                  onClick={() => setAudioSettings({...audioSettings, useSpeakerBoost: !audioSettings.useSpeakerBoost})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    audioSettings.useSpeakerBoost ? "bg-[#00d4ff]" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      audioSettings.useSpeakerBoost ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Voice Grid */}
        {filteredVoices.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Mic2 className="w-10 h-10 text-white/20" />
            </div>
            <div className="text-white/40 text-lg mb-2">No voices found</div>
            <p className="text-sm text-white/30 mb-4">Try adjusting your filters or search terms</p>
            <button
              onClick={clearFilters}
              className="text-[#00ff88] hover:underline text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mb-32 pb-8">
            {filteredVoices.map((voice) => {
              const gender = voice.labels?.gender;
              const accent = voice.labels?.accent;
              const age = voice.labels?.age;
              const useCase = voice.labels?.use_case || voice.labels?.["use case"];

              return (
                <div
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`group relative cursor-pointer transition-all duration-300 ${
                    selectedVoice === voice.id ? "scale-[1.02]" : "hover:scale-[1.01]"
                  }`}
                >
                  {/* Glow effect for selected */}
                  {selectedVoice === voice.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/20 rounded-2xl blur-2xl" />
                  )}

                  <div
                    className={`relative overflow-hidden bg-gradient-to-br from-white/[0.07] to-white/[0.03] backdrop-blur-sm border rounded-2xl transition-all duration-300 ${
                      selectedVoice === voice.id
                        ? "border-[#00ff88] shadow-xl shadow-[#00ff88]/20"
                        : "border-white/10 hover:border-white/20 hover:shadow-lg"
                    }`}
                  >
                    {/* Accent stripe */}
                    <div className={`h-1 w-full ${
                      selectedVoice === voice.id
                        ? "bg-gradient-to-r from-[#00ff88] via-[#00d4ff] to-[#00ff88]"
                        : "bg-gradient-to-r from-white/10 to-white/5"
                    }`} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate mb-1">
                            {voice.name}
                          </h3>
                          {voice.category && (
                            <div className="text-xs text-white/40 capitalize">
                              {voice.category}
                            </div>
                          )}
                        </div>
                        {selectedVoice === voice.id && (
                          <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full flex items-center justify-center ml-2">
                            <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Characteristics badges */}
                      {(gender || accent || age) && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {gender && (
                            <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-purple-300">
                              <User className="w-3 h-3" />
                              {gender}
                            </div>
                          )}
                          {accent && (
                            <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-300">
                              <Globe className="w-3 h-3" />
                              {accent}
                            </div>
                          )}
                          {age && (
                            <div className="text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 text-orange-300">
                              {age}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Use case tag */}
                      {useCase && (
                        <div className="mb-3 text-xs text-white/50 italic">
                          Best for: <span className="text-white/70">{useCase}</span>
                        </div>
                      )}

                      {/* Preview button */}
                      {voice.previewUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`w-full border-2 transition-all rounded-xl h-10 font-medium text-sm ${
                            playingPreview === voice.id
                              ? "border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/10 shadow-lg shadow-[#00d4ff]/20"
                              : "border-white/20 text-white/70 hover:border-white/30 hover:text-white hover:bg-white/5"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            playPreview(voice);
                          }}
                        >
                          {playingPreview === voice.id ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              <span className="relative">
                                Playing
                                <span className="absolute -right-5 top-0">
                                  <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4ff]"></span>
                                  </span>
                                </span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Preview Voice
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Sticky Continue Button */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className={`pointer-events-auto transition-all duration-300 ${
            selectedVoice ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}>
            <div className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-white font-semibold text-lg">
                    {selectedVoice
                      ? `Selected: ${voices.find(v => v.id === selectedVoice)?.name}`
                      : "No voice selected"}
                  </div>
                  <div className="text-white/50 text-sm">
                    Click continue to start generating audio
                  </div>
                </div>
                <Button
                  size="lg"
                  disabled={!selectedVoice}
                  onClick={handleContinue}
                  className="w-full sm:w-auto bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 h-14 px-12 rounded-xl font-bold text-lg shadow-lg shadow-[#00ff88]/25 transition-all hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue to Generation →
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
