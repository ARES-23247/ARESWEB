import React, { useState, useEffect, useRef } from "react";
import { Copy, Check, Quote as QuoteIcon, Share2 } from "lucide-react";
import { formatQuoteForSharing } from "@/lib/blogSyndication";

interface ArticleQuoteCalloutProps {
  children: React.ReactNode;
  cite?: string;
  className?: string;
}

function extractTextFromChildren(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromChildren).join("");
  if (React.isValidElement(node) && (node.props as { children?: React.ReactNode })?.children) {
    return extractTextFromChildren((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

export default function ArticleQuoteCallout({
  children,
  cite,
  className = "",
}: ArticleQuoteCalloutProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current !== null) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const quoteText = extractTextFromChildren(children).trim();

  const handleCopyQuote = async () => {
    try {
      if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      const pageTitle = typeof document !== "undefined" ? document.title.replace(/\s*\|\s*ARES.*$/, "") : "";
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const formatted = formatQuoteForSharing(quoteText, pageTitle, pageUrl);
      await navigator.clipboard.writeText(formatted || quoteText);
      setCopied(true);
      setFeedback("Quote copied to clipboard.");
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        setCopied(false);
        setFeedback("");
        feedbackTimer.current = null;
      }, 2500);
    } catch {
      setCopied(false);
      setFeedback("Unable to copy quote automatically.");
    }
  };

  const handleShareQuote = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        const pageTitle = typeof document !== "undefined" ? document.title : "ARES 23247 Blog";
        const pageUrl = typeof window !== "undefined" ? window.location.href : "";
        await navigator.share({
          title: pageTitle,
          text: `"${quoteText}"`,
          url: pageUrl,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          await handleCopyQuote();
        }
      }
    } else {
      await handleCopyQuote();
    }
  };

  return (
    <blockquote
      className={`relative my-6 rounded-r-lg border-l-4 border-ares-gold bg-white/5 p-5 text-marble/90 shadow-lg group transition-all hover:bg-white/[0.07] ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <QuoteIcon
            size={20}
            className="text-ares-gold/70 shrink-0 mt-1 select-none"
            aria-hidden="true"
          />
          <div className="italic text-base sm:text-lg leading-relaxed text-marble/90">
            {children}
            {cite && (
              <footer className="mt-2 text-xs font-semibold text-ares-gold/80 not-italic uppercase tracking-wider">
                — {cite}
              </footer>
            )}
          </div>
        </div>

        {/* Quote Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopyQuote}
            className="p-1.5 rounded bg-black/40 hover:bg-ares-gold/20 text-marble/70 hover:text-ares-gold border border-white/10 hover:border-ares-gold/40 transition-all text-xs flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ares-gold"
            aria-label="Copy quote to clipboard"
            title="Copy quote with link"
          >
            {copied ? (
              <>
                <Check size={14} className="text-ares-success" />
                <span className="text-[10px] font-bold text-ares-success hidden sm:inline">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="text-[10px] font-bold hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={handleShareQuote}
              className="p-1.5 rounded bg-black/40 hover:bg-ares-cyan/20 text-marble/70 hover:text-ares-cyan border border-white/10 hover:border-ares-cyan/40 transition-all text-xs flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ares-cyan"
              aria-label="Share quote"
              title="Share quote"
            >
              <Share2 size={14} />
            </button>
          )}
        </div>
      </div>
      <p role="status" aria-atomic="true" className="sr-only">
        {feedback}
      </p>
    </blockquote>
  );
}