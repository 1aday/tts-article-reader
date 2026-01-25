"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
}

interface VoiceSelectorProps {
  selectedVoiceId?: string;
  onVoiceSelect: (voiceId: string, voiceName: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceSelector({
  selectedVoiceId,
  onVoiceSelect,
  placeholder = "Select voice...",
  className,
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch voices from API
  useEffect(() => {
    async function fetchVoices() {
      try {
        const response = await fetch("/api/voices");
        const data = await response.json();
        setVoices(data);
      } catch (error) {
        console.error("Failed to fetch voices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchVoices();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Filter voices based on search query
  const filteredVoices = useMemo(() => {
    if (!searchQuery.trim()) return voices;
    const query = searchQuery.toLowerCase();
    return voices.filter((voice) =>
      voice.name.toLowerCase().includes(query)
    );
  }, [voices, searchQuery]);

  // Get selected voice name
  const selectedVoice = voices.find((v) => v.voice_id === selectedVoiceId);
  const displayText = selectedVoice?.name || placeholder;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between bg-[#1a1a1a] border-[#00ff4133] hover:border-[--terminal-cyan] transition-all"
        disabled={loading}
      >
        <span className="truncate">{loading ? "Loading voices..." : displayText}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform text-gray-400",
            isOpen && "transform rotate-180"
          )}
        />
      </Button>

      {/* Dropdown */}
      {isOpen && !loading && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-[#00ff4133] rounded-lg shadow-xl max-h-96 overflow-hidden animate-fadeIn">
          {/* Search Input */}
          <div className="p-3 border-b border-[#00ff4133]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search voices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#0a0a0a] border-[#00ff4133]"
                autoFocus
              />
            </div>
          </div>

          {/* Voice List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {filteredVoices.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No voices found
              </div>
            ) : (
              <div className="p-2">
                {filteredVoices.map((voice) => {
                  const isSelected = voice.voice_id === selectedVoiceId;
                  return (
                    <button
                      key={voice.voice_id}
                      type="button"
                      onClick={() => {
                        onVoiceSelect(voice.voice_id, voice.name);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-all text-left",
                        isSelected
                          ? "bg-[--terminal-cyan]/20 text-[--terminal-cyan]"
                          : "hover:bg-[#151515] text-[#e50914]"
                      )}
                    >
                      <span className="font-medium">{voice.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-[--terminal-cyan]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
