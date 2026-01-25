"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilterOption {
  id: number;
  name: string;
  slug: string;
  articleCount: number;
}

interface FilterBarProps {
  activeCategories: string[];
  activeTags: string[];
  onCategoryToggle: (slug: string) => void;
  onTagToggle: (slug: string) => void;
  onClearAll: () => void;
}

export function FilterBar({
  activeCategories,
  activeTags,
  onCategoryToggle,
  onTagToggle,
  onClearAll,
}: FilterBarProps) {
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [tags, setTags] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch filter options from API
  useEffect(() => {
    async function fetchFilters() {
      try {
        const response = await fetch("/api/library/filters");
        const data = await response.json();

        if (data.success) {
          setCategories(data.categories || []);
          setTags(data.tags || []);
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFilters();
  }, []);

  // Update scroll button visibility
  useEffect(() => {
    const updateScrollButtons = () => {
      if (!scrollContainerRef.current) return;

      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
    };

    const container = scrollContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);

      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [categories, tags]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = 300;
    const newScrollLeft =
      direction === "left"
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const activeFilterCount = activeCategories.length + activeTags.length;
  const hasFilters = categories.length > 0 || tags.length > 0;

  if (loading) {
    return (
      <div className="w-full py-4 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading filters...</div>
      </div>
    );
  }

  if (!hasFilters) {
    return null; // Don't show filter bar if no filters available
  }

  return (
    <div className="relative w-full mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[#00ff88]">Filter Articles</h3>
          {activeFilterCount > 0 && (
            <span className="text-xs text-gray-400">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 text-xs text-gray-400 hover:text-red-500"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Scrollable Filter Container */}
      <div className="relative group">
        {/* Left Scroll Button */}
        {showLeftScroll && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#242424]/95 backdrop-blur-sm border border-[#00ff4133] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a2a2a] text-[#00ff88]"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable Pills Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Category Pills */}
          {categories.map((category) => {
            const isActive = activeCategories.includes(category.slug);
            return (
              <button
                key={`category-${category.id}`}
                onClick={() => onCategoryToggle(category.slug)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium
                  transition-all duration-300 border
                  ${
                    isActive
                      ? "bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 border-[#00ff88]/50 text-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.3)] scale-105"
                      : "bg-[#1a1a1a] border-[#00ff4133] text-gray-200 hover:bg-[#242424] hover:border-[#00ff88]/30 hover:scale-105"
                  }
                `}
              >
                <span className="capitalize">{category.name}</span>
                <span className="ml-2 text-[10px] opacity-70">
                  {category.articleCount}
                </span>
              </button>
            );
          })}

          {/* Tag Pills */}
          {tags.map((tag) => {
            const isActive = activeTags.includes(tag.slug);
            return (
              <button
                key={`tag-${tag.id}`}
                onClick={() => onTagToggle(tag.slug)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium
                  transition-all duration-300 border
                  ${
                    isActive
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-105"
                      : "bg-[#1a1a1a] border-[#00ff4133] text-gray-200 hover:bg-[#242424] hover:border-purple-500/30 hover:scale-105"
                  }
                `}
              >
                {tag.name}
                <span className="ml-2 text-[10px] opacity-70">
                  {tag.articleCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        {showRightScroll && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#242424]/95 backdrop-blur-sm border border-[#00ff4133] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a2a2a] text-[#00ff88]"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* CSS to hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
