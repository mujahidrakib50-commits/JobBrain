"use client";

import { useState } from "react";
import { Send, Link as LinkIcon, Sparkles, AlertCircle } from "lucide-react";

interface LinkInputHeroProps {
  onLinksSubmitted: () => void;
}

export function LinkInputHero({ onLinksSubmitted }: LinkInputHeroProps) {
  const [linksText, setLinksText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedCount = (() => {
    if (!linksText.trim()) return 0;
    const spaced = linksText.replace(/(https?:\/\/)/gi, " $1");
    const matches = spaced.match(/https?:\/\/[^\s,;"'<>\)\]\}]+/gi);
    return matches ? matches.length : 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksText.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawLinks: linksText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit links");
      }

      setLinksText("");
      onLinksSubmitted();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto mb-8">
      <form
        onSubmit={handleSubmit}
        className="p-4 sm:p-6 rounded-2xl bg-surface border border-surface-border shadow-xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <LinkIcon className="w-4 h-4 text-accent-blue" />
            <span>Job Postings Input</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {detectedCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30 font-medium">
                {detectedCount} {detectedCount === 1 ? "task" : "tasks"} ready to create
              </span>
            ) : (
              <span className="text-gray-400">
                Paste single or multiple links (separated by newlines, spaces, or commas)
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={linksText}
            onChange={(e) => setLinksText(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/...&#10;https://jobs.lever.co/...&#10;https://boards.greenhouse.io/..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-border text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue font-mono text-xs sm:text-sm transition resize-y min-h-[90px]"
          />
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
            <span>International support: automatically translates French, Italian, German & more to English</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !linksText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm text-white shadow-lg shadow-blue-500/20 transition-all font-semibold"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Queuing...</span>
              </span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{detectedCount > 1 ? `Submit ${detectedCount} Tasks` : "Submit Links"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
