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
      <div className="flex w-full items-center justify-center py-4">
        <div className="text-sm text-white/50">Loading filters...</div>
      </div>
    );
  }

  if (!hasFilters) {
    return null; // Don't show filter bar if no filters available
  }

  return (
    <div className="relative mb-8 w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.11em] text-[#e50914]">
            Filter Articles
          </h3>
          {activeFilterCount > 0 && (
            <span className="text-xs text-white/45">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 text-xs text-white/55 hover:text-[#e50914]"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="relative group">
        {showLeftScroll && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1c2534]/95 text-[#e50914] opacity-0 backdrop-blur-sm transition-opacity hover:border-[#e50914]/45 group-hover:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((category) => {
            const isActive = activeCategories.includes(category.slug);
            return (
              <button
                key={`category-${category.id}`}
                onClick={() => onCategoryToggle(category.slug)}
                className={`
                  flex-shrink-0 rounded-full border px-4 py-2 text-xs font-medium
                  transition-all duration-300
                  ${
                    isActive
                      ? "scale-105 border-[#e50914]/60 bg-[#e50914]/15 text-[#e50914] shadow-[0_0_16px_rgba(229,9,20,0.35)]"
                      : "border-white/15 bg-surface-1 text-white/70 hover:scale-105 hover:border-[#e50914]/45 hover:text-white"
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

          {tags.map((tag) => {
            const isActive = activeTags.includes(tag.slug);
            return (
              <button
                key={`tag-${tag.id}`}
                onClick={() => onTagToggle(tag.slug)}
                className={`
                  flex-shrink-0 rounded-full border px-4 py-2 text-xs font-medium
                  transition-all duration-300
                  ${
                    isActive
                      ? "scale-105 border-[#f40612]/60 bg-[#f40612]/15 text-[#f40612] shadow-[0_0_16px_rgba(229,9,20,0.32)]"
                      : "border-white/15 bg-surface-1 text-white/70 hover:scale-105 hover:border-[#f40612]/45 hover:text-white"
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

        {showRightScroll && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1c2534]/95 text-[#e50914] opacity-0 backdrop-blur-sm transition-opacity hover:border-[#e50914]/45 group-hover:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
