"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

interface FullscreenCardProps {
  title: string;
  children: (isFullscreen: boolean) => React.ReactNode;
  className?: string;
}

export default function FullscreenCard({ title, children, className = "" }: FullscreenCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setIsFullscreen(false);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isFullscreen, handleEscape]);

  return (
    <>
      {/* Inline Card */}
      <div className={`relative group ${className}`}>
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded bg-white/5 hover:bg-white/15 text-marble/40 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          title="Expand to fullscreen"
          aria-label={`Expand ${title} to fullscreen`}
        >
          <Maximize2 size={14} />
        </button>
        {children(false)}
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-obsidian/95 backdrop-blur-xl flex flex-col animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — fullscreen view`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-black uppercase tracking-widest text-white font-heading">
              {title}
            </h2>
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-2 px-3 py-1.5 ares-cut-sm bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-marble hover:text-white cursor-pointer transition-colors"
              aria-label="Exit fullscreen"
            >
              <Minimize2 size={14} /> Exit Fullscreen
            </button>
          </div>
          <div className="flex-grow overflow-auto p-6">
            {children(true)}
          </div>
        </div>
      )}
    </>
  );
}
