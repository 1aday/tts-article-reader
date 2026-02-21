"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Link2, Sparkles, Type } from "lucide-react";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/article/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to scrape article");
        return;
      }

      toast.success("Article scraped successfully!");
      router.push(`/voice-select/${data.article.id}`);
    } catch (error) {
      toast.error("Failed to scrape article");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/article/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to save article");
        return;
      }

      toast.success("Article saved successfully!");
      router.push(`/voice-select/${data.article.id}`);
    } catch (error) {
      toast.error("Failed to save article");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] relative overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#141414] to-[#000000]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-12 sm:mb-16 md:mb-20 animate-fadeInDown">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-white tracking-[0.03em]">
              New Article
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#d2d2d2] leading-relaxed">
              Add a source and produce a premium voice-ready script.
            </p>
          </div>
          <Link href="/">
            <Button
              variant="ghost"
              size="lg"
              className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        </div>

        {/* Main Content */}
        <div className="bg-[#111723]/95 backdrop-blur-md border border-white/10 rounded-3xl p-8 sm:p-10 md:p-14 shadow-2xl animate-fadeInUp">
          <Tabs defaultValue="url" className="space-y-8 sm:space-y-10 md:space-y-12">
            <TabsList className="grid w-full grid-cols-2 bg-[#0f141d] p-2 rounded-2xl border border-white/10 h-auto shadow-lg">
              <TabsTrigger
                value="url"
                className="h-14 sm:h-16 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2"
              >
                <Link2 className="h-5 w-5" />
                <span className="hidden sm:inline">From URL</span>
                <span className="sm:hidden">URL</span>
              </TabsTrigger>
              <TabsTrigger
                value="paste"
                className="h-14 sm:h-16 rounded-xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2"
              >
                <Type className="h-5 w-5" />
                <span className="hidden sm:inline">Paste Text</span>
                <span className="sm:hidden">Text</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-8 sm:space-y-10">
              <form onSubmit={handleUrlSubmit} className="space-y-8 sm:space-y-10">
                <div className="space-y-4 sm:space-y-5">
                  <label className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#e50914]" />
                    Article URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                  />
                  <p className="text-sm sm:text-base text-[#d2d2d2] pl-2 leading-relaxed">
                    Paste any article URL - we will extract the content automatically
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !url}
                  size="xl"
                  className="w-full netflix-button netflix-button-primary font-bold shadow-lg"
                  loading={loading}
                >
                  {!loading && "Scrape Article"}
                </Button>
              </form>

              <div className="bg-[#0f141d] border border-white/10 rounded-2xl p-6 sm:p-8 animate-fadeInUp stagger-1">
                <p className="text-sm sm:text-base font-semibold text-white mb-4 sm:mb-5 flex items-center gap-2">
                  <span className="text-lg">✓</span>
                  Supported Sites
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm sm:text-base text-[#d2d2d2]">
                  <div className="flex items-center gap-3 group hover:text-white transition-colors">
                    <div className="w-2 h-2 bg-[#e50914] rounded-full flex-shrink-0" />
                    NYTimes, Medium
                  </div>
                  <div className="flex items-center gap-3 group hover:text-white transition-colors">
                    <div className="w-2 h-2 bg-[#e50914] rounded-full flex-shrink-0" />
                    TechCrunch, The Verge
                  </div>
                  <div className="flex items-center gap-3 group hover:text-white transition-colors">
                    <div className="w-2 h-2 bg-[#e50914] rounded-full flex-shrink-0" />
                    Substack, Blogs
                  </div>
                  <div className="flex items-center gap-3 group hover:text-white transition-colors">
                    <div className="w-2 h-2 bg-[#e50914] rounded-full flex-shrink-0" />
                    News & Articles
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-8 sm:space-y-10">
              <form onSubmit={handleTextSubmit} className="space-y-8 sm:space-y-10">
                <div className="space-y-4 sm:space-y-5">
                  <label className="text-base sm:text-lg font-semibold text-white">
                    Article Title
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter your article title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-4 sm:space-y-5">
                  <label className="text-base sm:text-lg font-semibold text-white">
                    Article Text
                  </label>
                  <Textarea
                    placeholder="Paste your article text here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    rows={12}
                    className="font-mono text-sm sm:text-base min-h-[280px] sm:min-h-[360px]"
                  />
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 px-2">
                    <span className="text-sm sm:text-base text-[#d2d2d2] font-medium">
                      {text.length.toLocaleString()} characters
                    </span>
                    {text.length > 50000 && (
                      <span className="text-sm sm:text-base text-[#e50914] font-medium flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#e50914] rounded-full animate-pulse" />
                        Long text will be processed in chunks
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !title || !text}
                  size="xl"
                  className="w-full netflix-button netflix-button-primary font-bold shadow-lg"
                  loading={loading}
                >
                  {!loading && "Continue"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
