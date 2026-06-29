import React, { useState } from "react";
import { Link2, Check } from "lucide-react";

interface ShareButtonsProps {
  title: string;
  description?: string;
  theme?: "gold" | "cyan";
}

export default function ShareButtons({ title, description, theme = "gold" }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    return typeof window !== "undefined" ? window.location.href : "";
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl = getShareUrl();
  const themeColorClass = theme === "cyan" ? "text-ares-cyan" : "text-ares-gold";

  return (
    <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <h4 className={`text-xs font-black uppercase tracking-wider ${themeColorClass}`}>Share this page</h4>
        <p className="text-[10px] text-marble/60">Spread the word about ARES 23247's engineering journey.</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Share to X */}
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-marble/80 hover:text-ares-cyan hover:border-ares-cyan hover:bg-ares-cyan/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ares-cyan"
          title="Share on X (Twitter)"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.901 1.153h3.68l-8.04 9.79L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-10.378L1.326 1.153h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
          </svg>
        </a>
        {/* Share to Facebook */}
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-marble/80 hover:text-ares-gold hover:border-ares-gold hover:bg-ares-gold/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ares-gold"
          title="Share on Facebook"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </a>
        {/* Share to LinkedIn */}
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-marble/80 hover:text-ares-cyan hover:border-ares-cyan hover:bg-ares-cyan/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ares-cyan"
          title="Share on LinkedIn"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .773 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .773 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center text-marble/80 hover:text-ares-success hover:border-ares-success hover:bg-ares-success/10 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ares-success"
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-ares-success" /> : <Link2 size={14} />}
        </button>
      </div>
    </div>
  );
}
